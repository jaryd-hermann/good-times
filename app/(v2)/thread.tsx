import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
  Modal,
  Keyboard,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
  type TextInputSelectionChangeEventData,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { Image } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import * as haptics from "../../lib/v2/haptics"
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context"
import { useAuth } from "../../components/AuthProvider"
import {
  useThread,
  useThreadRealtime,
  useSendMessage,
  useToggleReaction,
  useMarkThreadRead,
} from "../../lib/v2/queries"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { AvatarStack } from "../../components/v2/AvatarStack"
import { ThreadItem } from "../../components/v2/ThreadItem"
import { VideoRecorder } from "../../components/v2/VideoRecorder"
import { VoiceRecorder } from "../../components/v2/VoiceRecorder"
import { EmojiPicker } from "../../components/EmojiPicker"
import { GroupSheet } from "../../components/v2/GroupSheet"
import { InviteSheet } from "../../components/v2/InviteSheet"
import { MembersSheet } from "../../components/v2/MembersSheet"
import { LockedThread } from "../../components/v2/LockedThread"
import { uploadMedia } from "../../lib/storage"
import { v2Analytics } from "../../lib/v2/analytics"
import { MentionBar } from "../../components/v2/MentionBar"
import {
  activeMentionQuery,
  applyMention,
  matchMembers,
  resolveMentions,
} from "../../lib/v2/mentions"
import type { ThreadMessage } from "../../lib/v2/types"

/**
 * Thread — designs 2C / 2D / 4A.
 *
 * Answers and chat share one stream; replies carry a quote stub. There is no
 * answer detail page (decision 7) — long answers expand inline, so all context
 * and every reply live here.
 *
 * Virtualised with FlatList. v1 rendered every card in a ScrollView, which is the
 * single biggest cause of scroll jank in the current app.
 */
export default function ThreadScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { c, isDark } = useV2Colors()
  const params = useLocalSearchParams<{ groupId: string; date: string }>()
  const groupId = params.groupId
  const date = params.date

  const { data, isLoading } = useThread(groupId, date, user?.id)
  useThreadRealtime(groupId, date)
  const sendMessage = useSendMessage(user?.id)
  const toggleReaction = useToggleReaction(user?.id, groupId, date)
  const markRead = useMarkThreadRead(user?.id)

  const [draft, setDraft] = useState("")
  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null)
  const [showVideo, setShowVideo] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  /**
   * What the recorder shows in its yellow context strip.
   *
   * Replying to something with text quotes the author and the text; to media, just
   * the author (there is no text to quote); to nothing in particular, the group —
   * which is who will see it.
   */
  const replyContext = replyTo
    ? replyTo.text?.trim()
      ? `${replyTo.author?.name ?? "Someone"}: ${replyTo.text.trim()}`
      : (replyTo.author?.name ?? "Someone")
    : (data?.group?.name ?? "your group")

  const sendMediaRef = useRef<((uri: string, type: "video" | "audio" | "photo") => void) | null>(null)
  /** Photos staged in the composer, sent with the message text on ↑. */
  const [pending, setPending] = useState<string[]>([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [emojiTarget, setEmojiTarget] = useState<ThreadMessage | null>(null)
  const [sendingMedia, setSendingMedia] = useState(false)
  const [showGroupSheet, setShowGroupSheet] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  /** Caret position, so we know which "@query" the user is actually inside. */
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const listRef = useRef<FlatList<ThreadMessage>>(null)
  /**
   * Whether the newest message is currently in view.
   *
   * The list lives inside a KeyboardAvoidingView using "padding", so opening the
   * keyboard SHRINKS the viewport from the bottom while the list keeps its scroll
   * offset — the newest messages slide out of sight behind the keyboard and there
   * is no remaining scroll range to bring them back. Following the keyboard fixes
   * that, but only for someone already at the bottom: yanking a person who has
   * scrolled up to read history down to the newest message just because they
   * tapped the composer would be worse than the bug.
   */
  const nearBottomRef = useRef(true)
  const s = useMemo(() => makeStyles(c), [c])

  // Mark read on open, but only once the thread is actually visible/unlocked.
  const openTracked = useRef<string | null>(null)
  useEffect(() => {
    if (data && !data.locked && groupId && date) {
      // Read the unseen state BEFORE marking read, or hadUnseen is always false.
      const hadUnseen = liveFirstUnreadIndex >= 0
      markRead.mutate({ groupId, threadDate: date })

      // Once per group+date: this effect re-runs as `data` settles, and an open
      // counted three times would make thread engagement look triple what it is.
      const key = `${groupId}:${date}`
      if (openTracked.current !== key) {
        openTracked.current = key
        v2Analytics.threadOpened({ groupId, hadUnseen })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.locked, groupId, date])

  /**
   * The divider's position is frozen on open.
   *
   * Opening the thread marks it read, which moves last_read_at and would make the
   * live index collapse to -1 — the divider flickered out the moment it appeared.
   * Freezing the first value keeps it stable for the ten seconds it is shown.
   */
  const frozenUnread = useRef<number | null>(null)
  const [showDivider, setShowDivider] = useState(true)

  const liveFirstUnreadIndex = useMemo(() => {
    if (!data?.messages || !data.last_read_at) return -1
    const cutoff = new Date(data.last_read_at).getTime()
    return data.messages.findIndex(
      (m) => m.author?.id !== user?.id && new Date(m.created_at).getTime() > cutoff
    )
  }, [data?.messages, data?.last_read_at, user?.id])

  if (frozenUnread.current === null && data?.messages?.length) {
    frozenUnread.current = liveFirstUnreadIndex
  }
  const firstUnreadIndex = showDivider ? (frozenUnread.current ?? -1) : -1

  // Ten seconds is enough to register where you left off; after that it is clutter.
  useEffect(() => {
    if (firstUnreadIndex < 0) return
    const t = setTimeout(() => setShowDivider(false), 10000)
    return () => clearTimeout(t)
  }, [firstUnreadIndex])

  const scrollToLatest = useCallback(() => {
    if (!nearBottomRef.current) return
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }, [])

  /**
   * The list getting SHORTER is the actual event that hides the newest messages —
   * the KeyboardAvoidingView shrinks it, the scroll offset stays put, and the
   * bottom slides out of view. Reacting to the height change catches it whatever
   * the cause and whatever order the keyboard events arrive in.
   */
  const listHeightRef = useRef(0)
  const onListLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height
      const shrank = listHeightRef.current > 0 && h < listHeightRef.current - 1
      listHeightRef.current = h
      if (shrank) scrollToLatest()
    },
    [scrollToLatest],
  )

  const onListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    // 120px of slack: "near enough the bottom that you are following the
    // conversation" rather than requiring a pixel-perfect rest position.
    nearBottomRef.current =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120
  }, [])

  useEffect(() => {
    // Both events, deliberately. willShow fires BEFORE the KeyboardAvoidingView
    // applies its padding, so scrolling there alone lands against the still
    // full-height viewport and the view then shrinks underneath it — putting the
    // newest messages straight back behind the keyboard. willShow gives the scroll
    // something to animate with; didShow corrects it once the layout has settled.
    const subs = [
      Keyboard.addListener("keyboardWillShow", scrollToLatest),
      Keyboard.addListener("keyboardDidShow", scrollToLatest),
    ]
    return () => subs.forEach((sub) => sub.remove())
  }, [scrollToLatest])

  /**
   * Mentions are resolved from the text at send time, not tracked as the user
   * types — someone can delete half a name, and a mention list that still
   * claimed them would notify a person whose name is no longer in the message.
   */
  const mentionCtx = useMemo(
    () => activeMentionQuery(draft, selection.start),
    [draft, selection.start],
  )
  const mentionCandidates = useMemo(
    () =>
      mentionCtx
        ? matchMembers(
            (data?.group.members ?? []).filter((m) => m.id !== user?.id),
            mentionCtx.query,
          )
        : [],
    [mentionCtx, data?.group.members, user?.id],
  )

  /**
   * Where we have just asked the caret to go, while native catches up.
   *
   * `selection` is a controlled prop, so changing the text makes the input emit
   * onSelectionChange with its PRE-insert caret position. Writing that back into
   * state yanked the caret to where the "@" had been, and the user had to tap
   * past the inserted name to carry on typing. Ignore native's reports until it
   * reports the position we asked for.
   */
  const wantedCaret = useRef<number | null>(null)

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const sel = e.nativeEvent.selection
      if (wantedCaret.current !== null) {
        if (sel.start === wantedCaret.current) wantedCaret.current = null
        return
      }
      setSelection(sel)
    },
    [],
  )

  const pickMention = useCallback(
    (m: ThreadMessage["author"]) => {
      if (!mentionCtx || !m?.name) return
      haptics.tap()
      const next = applyMention(draft, mentionCtx.at, selection.start, m.name)
      wantedCaret.current = next.cursor
      setDraft(next.text)
      setSelection({ start: next.cursor, end: next.cursor })
      // Safety net: if native never reports the position we asked for, clearing
      // the guard keeps caret tracking alive rather than freezing it forever.
      setTimeout(() => {
        wantedCaret.current = null
      }, 400)
    },
    [draft, mentionCtx, selection.start],
  )

  const onReply = useCallback((m: ThreadMessage) => setReplyTo(m), [])
  /**
   * Stable identities, or ThreadItem's memo() is worthless.
   *
   * These were inline arrows, so every keystroke in the composer handed each row
   * new props and re-rendered the whole list — which is why the images flashed
   * while you typed.
   */
  /**
   * Held in a ref, NOT a dependency.
   *
   * useMutation returns a fresh object every render, so `[toggleReaction]` made
   * this callback new every render too — memo() on ThreadItem kept failing and the
   * images kept flashing on each keystroke. The ref stays current without ever
   * changing the callback's identity.
   */
  const toggleReactionRef = useRef(toggleReaction)
  toggleReactionRef.current = toggleReaction
  const onToggleReaction = useCallback(
    (messageId: string, emoji: string) =>
      toggleReactionRef.current.mutate({ messageId, emoji }),
    []
  )
  const onAddReaction = useCallback((m: ThreadMessage) => setEmojiTarget(m), [])

  const onSend = useCallback(async () => {
    const text = draft.trim()
    if ((!text && pending.length === 0) || !groupId) return
    haptics.commit()
    const photos = pending
    const target = replyTo
    setDraft("")
    setPending([])
    setReplyTo(null)

    // Text and photos go as ONE message — staging them separately would split a
    // caption from the picture it belongs to.
    let mediaUrls: string[] | undefined
    if (photos.length > 0) {
      setSendingMedia(true)
      try {
        mediaUrls = await Promise.all(
          photos.map((uri) => uploadMedia(groupId, `msg-${Date.now()}`, uri, "photo"))
        )
      } catch (e) {
        console.warn("[thread] photo send failed:", (e as Error).message)
        Alert.alert("Couldn't send", "Those photos didn't upload. Try again.")
        setSendingMedia(false)
        return
      }
      setSendingMedia(false)
    }

    sendMessage.mutate({
      groupId,
      threadDate: date,
      text: text || null,
      mediaUrls,
      mediaTypes: mediaUrls?.map(() => "photo" as const),
      mentions: resolveMentions(text, data?.group.members ?? []),
      replyToMessageId: target?.id ?? null,
    })
    v2Analytics.messageSent({
      groupId,
      kind: target ? "reply" : "open",
      hasMedia: !!mediaUrls?.length,
    })
  }, [draft, pending, groupId, date, replyTo, sendMessage])

  /**
   * Photo into the thread: camera or library, the user's choice.
   *
   * An ActionSheet rather than two more round buttons — the composer row already
   * carries video and voice, and a third icon that only opens a picker would crowd
   * the text field on smaller phones.
   */
  const attachPhoto = useCallback(async (fromCamera: boolean) => {
    setShowAttachMenu(false)
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(
        fromCamera ? "Camera permission needed" : "Photos permission needed",
        "Allow access to send a photo."
      )
      return
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          // Multi-select: picking one at a time made sending a set tedious.
          allowsMultipleSelection: true,
          quality: 0.8,
        })
    if (res.canceled) return
    // Staged, not sent. Previously the picker fired straight off to sendMedia, so
    // nothing appeared in the composer and the photo went out without your text.
    setPending((prev) => [...prev, ...res.assets.map((a) => a.uri)])
  }, [])

  /** Upload then post as a chat message — same media types v1 supported on comments. */
  const sendMedia = useCallback(
    async (uri: string, type: "video" | "audio" | "photo") => {
      if (!groupId) return
      setSendingMedia(true)
      try {
        const url = await uploadMedia(groupId, `msg-${Date.now()}`, uri, type)
        const target = replyTo
        setReplyTo(null)
        sendMessage.mutate({
          groupId,
          threadDate: date,
          text: null,
          mediaUrls: [url],
          mediaTypes: [type],
          replyToMessageId: target?.id ?? null,
        })
        v2Analytics.messageSent({
          groupId,
          kind: target ? "reply" : "open",
          hasMedia: true,
        })
      } catch (e) {
        console.warn("[thread] media send failed:", (e as Error).message)
      } finally {
        setSendingMedia(false)
      }
    },
    [groupId, date, replyTo, sendMessage]
  )
  sendMediaRef.current = sendMedia

  if (isLoading || !data) {
    return (
      <SafeAreaView style={s.screen}>
        <ActivityIndicator style={{ marginTop: 64 }} color={c.text} />
      </SafeAreaView>
    )
  }

  if (data.error === "not_a_member") {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.centered}>
          <Text style={s.lockTitle}>You&rsquo;re not in this group</Text>
          <TouchableOpacity style={s.cta} onPress={() => router.back()}>
            <Text style={s.ctaText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const answeredCount = data.group.answered_count
  const memberCount = data.group.member_count

  if (data.locked) {
    return (
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.back}>‹</Text>
          </TouchableOpacity>
          <AvatarStack
            members={data.group.members}
            size={30}
            max={3}
            overflow
            onPress={() => setShowMembers(true)}
          />
          <View style={{ flex: 1 }}>
            <View style={s.groupNameRow}>
              <Text style={s.groupName} numberOfLines={1}>
                {data.group.name}
              </Text>
              {/* Invite and settings stay available while locked. Answering is not
                  a prerequisite for adding people or checking the group — and a
                  locked thread is exactly where someone realises it is too empty. */}
              <TouchableOpacity
                onPress={() => {
                  haptics.tap()
                  setShowInvite(true)
                }}
                hitSlop={8}
                style={s.invitePlus}
                accessibilityLabel="Invite to group"
              >
                <MaterialCommunityIcons name="plus" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={s.groupSub}>Locked</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowGroupSheet(true)}
            hitSlop={10}
            accessibilityLabel="Group info"
            style={{ marginLeft: sp.md }}
          >
            <MaterialCommunityIcons name="dots-horizontal" size={24} color={c.text} />
          </TouchableOpacity>
        </View>
        <LockedThread
          answeredCount={answeredCount}
          question={data.question.text}
          onAnswer={() =>
            router.push({
              pathname: "/(v2)/compose",
              params: { promptId: data.question.prompt_id, date },
            })
          }
        />

        {/* The locked branch returns early, so these must be mounted here as well
            as in the unlocked tree — otherwise the header's + and menu open
            nothing at all. */}
        <InviteSheet
          visible={showInvite}
          groupId={groupId!}
          groupName={data.group.name}
          userId={user?.id}
          onClose={() => setShowInvite(false)}
        />
        <GroupSheet
          visible={showGroupSheet}
          group={data.group}
          userId={user?.id}
          threadDate={date}
          onClose={() => setShowGroupSheet(false)}
        />
        <MembersSheet
          visible={showMembers}
          groupId={groupId!}
          groupName={data.group.name}
          currentUserId={user?.id}
          onClose={() => setShowMembers(false)}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      {/* ---- header ---- */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <AvatarStack
          members={data.group.members}
          size={30}
          max={3}
          overflow
          onPress={() => setShowMembers(true)}
        />
        <View style={{ flex: 1 }}>
          <View style={s.groupNameRow}>
            <Text style={s.groupName} numberOfLines={1}>
              {data.group.name}
            </Text>
            {/* Invite lives one tap from the group name, not buried in settings —
                an empty group is the problem this app has to solve fastest. */}
            <TouchableOpacity
              onPress={() => {
                haptics.tap()
                setShowInvite(true)
              }}
              hitSlop={8}
              style={s.invitePlus}
              accessibilityLabel="Invite to group"
            >
              <MaterialCommunityIcons name="plus" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={s.groupSub}>
            {data.locked
              ? `${answeredCount} answer${answeredCount === 1 ? "" : "s"} waiting`
              : `${answeredCount} of ${memberCount} answered`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: "/(v2)/history", params: { groupId } })
          }
          hitSlop={10}
          accessibilityLabel="History for this group"
        >
          <Image
            source={require("../../assets/images/history.png")}
            style={[s.headerIcon, isDark ? { tintColor: c.text } : null]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowGroupSheet(true)}
          hitSlop={10}
          accessibilityLabel="Group info"
          style={{ marginLeft: sp.md }}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={c.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          // listRef was wired up but never used, so the thread opened on the
          // OLDEST message and you had to scroll down to find what's new.
          // Deferred a frame: content size settles before images finish laying
          // out, so scrolling immediately lands short.
          // Land on the divider when there is unseen activity — that is the point
          // of marking it. Only fall through to the newest message otherwise.
          onContentSizeChange={() =>
            requestAnimationFrame(() => {
              const i = frozenUnread.current ?? -1
              if (i >= 0) {
                listRef.current?.scrollToIndex({ index: i, viewPosition: 0.25, animated: false })
              } else {
                listRef.current?.scrollToEnd({ animated: false })
              }
            })
          }
          // Rows are variable height, so an offset can be wrong before layout
          // settles; retry once measured rather than silently landing nowhere.
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, viewPosition: 0.25, animated: false })
            }, 250)
          }}
          data={data.messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: sp.lg, paddingBottom: sp.xl }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={11}
          removeClippedSubviews
          onLayout={onListLayout}
          onScroll={onListScroll}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <View style={s.questionCard}>
              <View style={s.dateChip}>
                <Text style={s.dateChipMonth}>
                  {new Date(date + "T00:00:00").toLocaleString([], { month: "short" }).toUpperCase()}
                </Text>
                <Text style={s.dateChipDay}>{new Date(date + "T00:00:00").getDate()}</Text>
              </View>
              <Text style={s.questionText}>{data.question.text}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <>
              {index === firstUnreadIndex ? (
                <View style={s.newDivider}>
                  <View style={s.newLine} />
                  <Text style={s.newLabel}>NEW — YOU HAVEN&rsquo;T SEEN THIS</Text>
                  <View style={s.newLine} />
                </View>
              ) : null}
              <ThreadItem
                message={item}
                isMine={item.author?.id === user?.id}
                members={data.group.members}
                onReply={onReply}
                onToggleReaction={onToggleReaction}
                onAddReaction={onAddReaction}
              />
            </>
          )}
          ListEmptyComponent={
            <Text style={s.emptyText}>
              {data.locked ? "" : "No one has answered yet. Be first."}
            </Text>
          }
        />

        {(
          <View style={s.composerWrap}>
            {replyTo ? (
              <View style={s.replyBar}>
                <View style={{ flex: 1 }}>
                  <Text style={s.replyBarLabel}>
                    Replying to {replyTo.author?.name ?? "message"}
                  </Text>
                  <Text style={s.replyBarText} numberOfLines={1}>
                    {replyTo.answer?.text_content || replyTo.text || "…"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10}>
                  <Text style={s.replyBarClose}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {showAttachMenu ? (
              <View style={s.attachFan}>
                {[
                  { icon: "image-multiple-outline", label: "Add media", run: () => attachPhoto(false) },
                  { icon: "camera-outline", label: "Take a photo", run: () => attachPhoto(true) },
                  { icon: "video-outline", label: "Video reply", run: () => { setShowAttachMenu(false); setShowVideo(true) } },
                  { icon: "waveform", label: "Voice note", run: () => { setShowAttachMenu(false); setShowVoice(true) } },
                ].map((o) => (
                  <TouchableOpacity
                    key={o.label}
                    style={s.attachFanRow}
                    onPress={() => {
                      haptics.selection()
                      o.run()
                    }}
                  >
                    <View style={s.attachFanIcon}>
                      <MaterialCommunityIcons name={o.icon as any} size={19} color={c.text} />
                    </View>
                    <Text style={s.attachFanLabel}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {pending.length > 0 ? (
              <View style={s.pendingRow}>
                {pending.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={s.pendingThumb}>
                    <Image source={{ uri }} style={s.pendingImg} />
                    <TouchableOpacity
                      style={s.pendingX}
                      hitSlop={8}
                      onPress={() => setPending((prev) => prev.filter((_, n) => n !== i))}
                    >
                      <MaterialCommunityIcons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Directly above the field, so the faces sit between the thread and
                the keyboard where the eye already is. */}
            {mentionCandidates.length > 0 ? (
              <MentionBar members={mentionCandidates} onPick={pickMention} />
            ) : null}

            <View style={s.composerRow}>
              {/* One "+" instead of three icons — the row was eating the width the
                  message field needed. Options fan up on tap. */}
              <TouchableOpacity
                style={s.attachBtn}
                onPress={() => {
                  haptics.tap()
                  setShowAttachMenu((v) => !v)
                }}
                accessibilityLabel="Add to message"
              >
                <MaterialCommunityIcons
                  name={showAttachMenu ? "close" : "plus"}
                  size={22}
                  color={c.text}
                />
              </TouchableOpacity>
              <TextInput
                style={s.input}
                value={draft}
                onChangeText={setDraft}
                selection={selection}
                onSelectionChange={onSelectionChange}
                placeholder="Message…"
                placeholderTextColor={c.textSecondary}
                multiline
              />
              <TouchableOpacity
                style={[
                  s.sendBtn,
                  !draft.trim() && pending.length === 0 ? s.sendBtnDisabled : null,
                ]}
                onPress={onSend}
                disabled={!draft.trim() && pending.length === 0}
              >
                <Text style={s.sendGlyph}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Same recorders as the answer flow, not v1's comment modals — replying with
          video or voice should look and behave exactly like answering with them. */}
      {/* In the answer flow these ARE the screen. Here they are siblings of the
          thread, so without a full-screen Modal they rendered as a half-height
          panel below the composer. */}
      {/* SafeAreaProvider inside the Modal: RN Modals do not inherit the outer
          inset context, so the recorders' top controls sat under the notch and the
          ✕ was unreachable. */}
      <Modal visible={showVideo} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaProvider>
        <VideoRecorder
          reviewBeforeSend
          question={replyContext}
          onClose={() => setShowVideo(false)}
          onComplete={(uri) => {
            setShowVideo(false)
            void sendMedia(uri, "video")
          }}
        />
        </SafeAreaProvider>
      </Modal>

      <Modal visible={showVoice} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaProvider>
        <VoiceRecorder
          reviewBeforeSend
          question={replyContext}
          onClose={() => setShowVoice(false)}
          onComplete={(uri) => {
            setShowVoice(false)
            void sendMedia(uri, "audio")
          }}
        />
        </SafeAreaProvider>
      </Modal>

      <InviteSheet
        visible={showInvite}
        groupId={groupId!}
        groupName={data.group.name}
        userId={user?.id}
        onClose={() => setShowInvite(false)}
      />

      <MembersSheet
        visible={showMembers}
        groupId={groupId!}
        groupName={data.group.name}
        currentUserId={user?.id}
        onClose={() => setShowMembers(false)}
      />

      <GroupSheet
        visible={showGroupSheet}
        group={data.group}
        userId={user?.id}
        threadDate={date}
        onClose={() => setShowGroupSheet(false)}
      />

      <EmojiPicker
        visible={!!emojiTarget}
        onClose={() => setEmojiTarget(null)}
        currentReactions={(emojiTarget?.reactions ?? []).filter((r) => r.mine).map((r) => r.emoji)}
        onSelectEmoji={(emoji) => {
          if (emojiTarget) toggleReaction.mutate({ messageId: emojiTarget.id, emoji })
          setEmojiTarget(null)
        }}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: sp.xl },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.sm,
      paddingHorizontal: sp.lg,
      paddingVertical: sp.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    back: { fontSize: 30, color: c.text, marginRight: 2, lineHeight: 32 },
    // flexShrink on the name is the fix. Yoga defaults flexShrink to 0 (unlike the
    // web's 1), so a long name held its full intrinsic width and pushed the invite
    // + rightward into the history and menu icons. numberOfLines only clips the
    // rendered text; it does not stop the element claiming the space.
    groupNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    invitePlus: {
      flexShrink: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.pink,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    groupName: { fontSize: 16, fontWeight: "800", color: c.text, flexShrink: 1, minWidth: 0 },
    groupSub: { fontSize: 12, color: c.textSecondary },
    headerIcon: { width: 24, height: 24 },

    questionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.lg,
    },
    dateChip: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: "center",
      minWidth: 44,
    },
    dateChipMonth: { fontSize: 9, fontWeight: "800", color: c.text },
    dateChipDay: { fontSize: 17, fontWeight: "800", color: c.text, lineHeight: 19 },
    questionText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: c.accentInk,
      lineHeight: 21,
    },

    newDivider: { flexDirection: "row", alignItems: "center", gap: sp.sm, marginVertical: sp.md },
    newLine: { flex: 1, height: 1, backgroundColor: c.red, opacity: 0.5 },
    newLabel: { fontSize: 10, fontWeight: "800", color: c.red, letterSpacing: 0.4 },

    emptyText: { color: c.textSecondary, textAlign: "center", marginTop: sp.xl },

    lockFooter: {
      borderTopWidth: 2,
      borderTopColor: c.border,
      backgroundColor: c.bg,
      padding: sp.lg,
      alignItems: "center",
    },
    lockTitle: { fontSize: 16, fontWeight: "800", color: c.text, textAlign: "center" },
    lockSub: { color: c.textSecondary, marginTop: 2, marginBottom: sp.md },
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 26,
      paddingVertical: 14,
      paddingHorizontal: sp.xl,
      alignItems: "center",
      alignSelf: "stretch",
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },

    composerWrap: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
      paddingHorizontal: sp.md,
      paddingTop: sp.sm,
      // Was sp.sm — the round attach buttons sat under the home indicator and
      // their lower half wasn't tappable.
      paddingBottom: sp.lg,
    },
    replyBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.sm,
      borderLeftWidth: 3,
      borderLeftColor: c.red,
      paddingLeft: sp.sm,
      marginBottom: sp.sm,
    },
    replyBarLabel: { fontSize: 11, fontWeight: "800", color: c.red },
    replyBarText: { fontSize: 12, color: c.textSecondary },
    replyBarClose: { fontSize: 16, color: c.textSecondary, paddingHorizontal: 4 },
    composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
    attachFan: {
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: sp.sm,
    },
    attachFanRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: sp.md,
      paddingHorizontal: sp.md,
      paddingVertical: sp.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    attachFanIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    attachFanLabel: { fontSize: 15, fontWeight: "800", color: c.text },

    pendingRow: { flexDirection: "row", flexWrap: "wrap", gap: sp.sm, marginBottom: sp.sm },
    pendingThumb: { position: "relative" },
    pendingImg: {
      width: 58,
      height: 58,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    pendingX: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.75)",
      alignItems: "center",
      justifyContent: "center",
    },
    attachBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    input: {
      flex: 1,
      maxHeight: 110,
      minHeight: 42,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 21,
      paddingHorizontal: sp.md,
      paddingTop: 10,
      paddingBottom: 10,
      color: c.text,
      fontSize: 15,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.blue,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendGlyph: { color: "#fff", fontSize: 19, fontWeight: "800" },
  })
}
