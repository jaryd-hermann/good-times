"use client"

import React, { useRef, useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, ScrollView, TextInput, Platform, Keyboard } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface EmojiPickerProps {
  visible: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
  currentReactions?: string[] // Array of emojis user has already reacted with
}

// Comprehensive emoji library organized by categories
const EMOJI_CATEGORIES = {
  "Smileys & People": [
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😶‍🌫️", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "😶‍🌫️", "😵", "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"
  ],
  "Gestures & Body": [
    "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄"
  ],
  "Animals & Nature": [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🪲", "🪳", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🦣", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐈‍⬛", "🪶", "🐓", "🦃", "🦤", "🦚", "🦜", "🦢", "🦩", "🕊️", "🐇", "🦝", "🦨", "🦡", "🦫", "🦦", "🦥", "🐁", "🐀", "🐿️", "🦔", "🌲", "🌳", "🌴", "🌵", "🌶️", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🌍", "🌎", "🌏", "🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌙", "🌚", "🌛", "🌜", "🌝", "🌞", "⭐", "🌟", "💫", "✨", "☄️", "💥", "🔥", "🌈", "☀️", "⛅", "☁️", "⛈️", "🌤️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "☃️", "⛄", "🌬️", "💨", "💧", "💦", "☔", "☂️", "🌊", "🌫️"
  ],
  "Food & Drink": [
    "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🥞", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "🫖", "☕️", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊"
  ],
  "Activities & Sports": [
    "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🥅", "⛳", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️‍♀️", "🏋️", "🏋️‍♂️", "🤼‍♀️", "🤼", "🤼‍♂️", "🤸‍♀️", "🤸", "🤸‍♂️", "⛹️‍♀️", "⛹️", "⛹️‍♂️", "🤺", "🤾‍♀️", "🤾", "🤾‍♂️", "🏌️‍♀️", "🏌️", "🏌️‍♂️", "🏇", "🧘‍♀️", "🧘", "🧘‍♂️", "🏄‍♀️", "🏄", "🏄‍♂️", "🏊‍♀️", "🏊", "🏊‍♂️", "🤽‍♀️", "🤽", "🤽‍♂️", "🚣‍♀️", "🚣", "🚣‍♂️", "🧗‍♀️", "🧗", "🧗‍♂️", "🚵‍♀️", "🚵", "🚵‍♂️", "🚴‍♀️", "🚴", "🚴‍♂️", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️", "🎫", "🎟️", "🎪", "🤹‍♀️", "🤹", "🤹‍♂️", "🎭", "🩰", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎲", "♟️", "🎯", "🎳", "🎮", "🎰", "🧩"
  ],
  "Travel & Places": [
    "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🦽", "🦼", "🛴", "🚲", "🛵", "🏍️", "🛺", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛩️", "💺", "🚁", "🚟", "🚠", "🚡", "🛸", "🚀", "🛎️", "🧳", "⌛", "⏳", "⌚", "⏰", "⏲️", "⏱️", "🧭", "🌍", "🌎", "🌏", "🌐", "🗺️", "🧭", "🏔️", "⛰️", "🌋", "🗻", "🏕️", "🏖️", "🏜️", "🏝️", "🏞️", "🏟️", "🏛️", "🏗️", "🧱", "🏘️", "🏚️", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🕋", "⛲", "⛺", "🌁", "🌃", "🏙️", "🌄", "🌅", "🌆", "🌇", "🌉", "♨️", "🎠", "🎡", "🎢", "💈", "🎪", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚟", "🚠", "🚡", "🚀", "🚁", "✈️", "🛩️", "🛫", "🛬", "🪂", "💺", "🚢", "🛥️", "🛳️", "⛴️", "🚤", "🛶", "🪝", "⛵", "🚣", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "⚓", "⛽", "🚧", "🚦", "🚥", "🗺️", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️", "⛺", "🏠", "🏡", "🏘️", "🏚️", "🏗️", "🏭", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪", "🏫", "🏩", "💒", "🏛️", "⛪", "🕌", "🕍", "🛕", "🕋", "⛩️", "🛤️", "🛣️", "🗾", "🎑", "🏞️", "🌅", "🌄", "🌠", "🎇", "🎆", "🌇", "🌆", "🏙️", "🌃", "🌌", "🌉", "🌁"
  ],
  "Objects": [
    "⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "💎", "⚖️", "🪜", "🧰", "🪛", "🔧", "🔨", "⚒️", "🛠️", "⛏️", "🪚", "🔩", "⚙️", "🪤", "🧱", "⛓️", "🧲", "🔫", "💣", "🧨", "🪓", "🔪", "🗡️", "⚔️", "🛡️", "🚬", "⚰️", "🪦", "⚱️", "🏺", "🔮", "📿", "🧿", "💈", "⚗️", "🔭", "🔬", "🕳️", "🩹", "🩺", "💊", "💉", "🩸", "🧬", "🦠", "🧫", "🧪", "🌡️", "🧹", "🪠", "🧺", "🧻", "🚽", "🚿", "🛁", "🛀", "🧼", "🪥", "🪒", "🧽", "🪣", "🧴", "🛎️", "🔑", "🗝️", "🚪", "🪑", "🛋️", "🛏️", "🛌", "🧸", "🪆", "🖼️", "🪞", "🪟", "🛍️", "🛒", "🎁", "🎈", "🎏", "🎀", "🪄", "🪅", "🎊", "🎉", "🎎", "🏮", "🎐", "🧧", "✉️", "📩", "📨", "📧", "💌", "📥", "📤", "📦", "🏷️", "🪧", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃", "📄", "📑", "🧾", "📊", "📈", "📉", "🗒️", "🗓️", "📆", "📅", "🗑️", "📇", "🗃️", "🗳️", "🗄️", "📋", "📁", "📂", "🗂️", "🗞️", "📰", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📖", "🔖", "🧷", "🔗", "📎", "🖇️", "📐", "📏", "🧮", "📌", "📍", "✂️", "🖊️", "🖋️", "✒️", "🖌️", "🖍️", "📝", "✏️", "🔍", "🔎", "🔏", "🔐", "🔒", "🔓"
  ],
  "Symbols": [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳", "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "💮", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑", "🅾️", "🆘", "❌", "⭕", "🛑", "⛔", "📛", "🚫", "💯", "💢", "♨️", "🚷", "🚯", "🚳", "🚱", "🔞", "📵", "🚭", "❗", "❓", "❕", "❔", "‼️", "⁉️", "🔅", "🔆", "〽️", "⚠️", "🚸", "🔱", "⚜️", "🔰", "♻️", "✅", "🈯", "💹", "❇️", "✳️", "❎", "🌐", "💠", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿", "🅿️", "🈳", "🈂️", "🛂", "🛃", "🛄", "🛅", "🚹", "🚺", "🚼", "🚻", "🚮", "🎦", "📶", "🈁", "🔣", "ℹ️", "🔤", "🔡", "🔠", "🔢", "🔟", "🔢", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "🔠", "🔡", "🔤", "🔣", "🎵", "🎶", "➕", "➖", "➗", "✖️", "💲", "💱", "™️", "©️", "®️", "〰️", "➰", "➿", "🔚", "🔙", "🔛", "🔜", "🔝", "🛐", "⚛️", "🕉️", "✡️", "☸️", "☯️", "✝️", "☦️", "☪️", "☮️", "🕎", "🔯", "🆔", "⚕️", "♻️", "✅", "❌", "💚", "🆕", "🆓", "🆒", "🆗", "🆙", "🆖", "🈶", "🈸", "🈺", "🈷️", "✴️", "🆚", "🎦", "🈁", "🈂️", "🈳", "🈴", "🈵", "🈯", "🈲", "🈹", "🈺", "🈶", "🈚", "🈸", "🈷️", "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "🉑", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑", "🅾️", "🆘", "⛔", "📛", "🚫", "❌", "⭕", "💢", "♨️", "🚷", "🚯", "🚳", "🚱", "🔞", "📵", "🚭", "❗", "❓", "❕", "❔", "‼️", "⁉️", "🔅", "🔆", "〽️", "⚠️", "🚸", "🔱", "⚜️", "🔰", "♻️", "✅", "🈯", "💹", "❇️", "✳️", "❎", "🌐", "💠", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿", "🅿️", "🈳", "🈂️", "🛂", "🛃", "🛄", "🛅", "🚹", "🚺", "🚼", "🚻", "🚮", "🎦", "📶", "🈁", "🔣", "ℹ️", "🔤", "🔡", "🔠", "🔢", "🔟", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "🔠", "🔡", "🔤", "🔣", "🎵", "🎶", "➕", "➖", "➗", "✖️", "💲", "💱", "™️", "©️", "®️", "〰️", "➰", "➿", "🔚", "🔙", "🔛", "🔜", "🔝"
  ]
}

// Flatten all emojis for search
const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat()

// Comprehensive emoji name mapping for search
const EMOJI_NAMES: Record<string, string[]> = {
  // Smileys & People
  "😀": ["grinning", "face", "happy", "smile"],
  "😃": ["grinning", "eyes", "big", "smile"],
  "😄": ["grinning", "smiling", "eyes", "happy"],
  "😁": ["beaming", "smiling", "eyes", "grin"],
  "😆": ["grinning", "squinting", "face", "laugh"],
  "😅": ["grinning", "sweat", "relieved"],
  "🤣": ["rolling", "floor", "laughing", "laugh"],
  "😂": ["face", "tears", "joy", "laugh", "crying"],
  "🙂": ["slightly", "smiling", "face"],
  "🙃": ["upside", "down", "face"],
  "😉": ["winking", "face", "wink"],
  "😊": ["smiling", "eyes", "happy", "blush"],
  "😇": ["smiling", "halo", "angel", "innocent"],
  "🥰": ["smiling", "hearts", "love"],
  "😍": ["heart", "eyes", "love", "crush"],
  "🤩": ["star", "struck", "eyes"],
  "😘": ["blowing", "kiss", "love"],
  "😗": ["kissing", "face"],
  "☺️": ["smiling", "face"],
  "😚": ["kissing", "closed", "eyes"],
  "😙": ["kissing", "smiling", "eyes"],
  "🥲": ["smiling", "tear"],
  "😋": ["face", "savoring", "food", "yum"],
  "😛": ["face", "tongue"],
  "😜": ["winking", "tongue", "playful"],
  "🤪": ["zany", "face", "crazy"],
  "😝": ["squinting", "tongue"],
  "🤑": ["money", "mouth", "face", "rich"],
  "🤗": ["hugging", "face", "hug"],
  "🤭": ["face", "hand", "over", "mouth", "shush"],
  "🤫": ["shushing", "face", "quiet"],
  "🤔": ["thinking", "face", "think", "ponder"],
  "🤐": ["zipper", "mouth", "face", "sealed"],
  "🤨": ["face", "raised", "eyebrow", "skeptical"],
  "😐": ["neutral", "face"],
  "😑": ["expressionless", "face"],
  "😶": ["face", "without", "mouth"],
  "😏": ["smirking", "face", "smirk"],
  "😒": ["unamused", "face"],
  "🙄": ["face", "rolling", "eyes"],
  "😬": ["grimacing", "face"],
  "😮‍💨": ["face", "exhaling"],
  "🤥": ["lying", "face", "liar"],
  "😌": ["relieved", "face"],
  "😔": ["pensive", "face", "sad"],
  "😪": ["sleepy", "face", "tired"],
  "🤤": ["drooling", "face", "drool"],
  "😴": ["sleeping", "face", "sleep", "tired"],
  "😷": ["face", "medical", "mask", "sick"],
  "🤒": ["face", "thermometer", "sick", "fever"],
  "🤕": ["face", "bandage", "injured"],
  "🤢": ["nauseated", "face", "sick", "vomit"],
  "🤮": ["face", "vomiting", "sick"],
  "🤧": ["sneezing", "face", "sneeze"],
  "🥵": ["hot", "face", "sweat"],
  "🥶": ["cold", "face", "freeze"],
  "😵": ["dizzy", "face"],
  "😵‍💫": ["face", "spiral", "eyes", "dizzy"],
  "🤯": ["exploding", "head", "mind", "blown"],
  "🤠": ["cowboy", "hat", "face"],
  "🥳": ["partying", "face", "party", "celebration"],
  "🥸": ["disguised", "face"],
  "😎": ["smiling", "sunglasses", "cool"],
  "🤓": ["nerd", "face", "geek"],
  "🧐": ["face", "monocle"],
  "😕": ["confused", "face"],
  "😟": ["worried", "face"],
  "🙁": ["slightly", "frowning", "face"],
  "☹️": ["frowning", "face"],
  "😮": ["face", "open", "mouth", "surprised"],
  "😯": ["hushed", "face", "surprised"],
  "😲": ["astonished", "face"],
  "😳": ["flushed", "face", "embarrassed"],
  "🥺": ["pleading", "face", "puppy", "eyes"],
  "😦": ["frowning", "open", "mouth"],
  "😧": ["anguished", "face"],
  "😨": ["fearful", "face", "scared"],
  "😰": ["anxious", "sweat", "face"],
  "😥": ["sad", "relieved", "face"],
  "😢": ["crying", "face", "tears", "sad"],
  "😭": ["loudly", "crying", "face", "sob"],
  "😱": ["face", "screaming", "fear", "shocked"],
  "😖": ["confounded", "face"],
  "😣": ["persevering", "face"],
  "😞": ["disappointed", "face"],
  "😓": ["downcast", "sweat", "face"],
  "😩": ["weary", "face", "tired"],
  "😫": ["tired", "face"],
  "🥱": ["yawning", "face", "yawn"],
  "😤": ["face", "steam", "nose", "angry"],
  "😡": ["pouting", "face", "angry"],
  "😠": ["angry", "face"],
  "🤬": ["face", "symbols", "mouth", "swearing"],
  "😈": ["smiling", "horns", "devil"],
  "👿": ["angry", "horns", "devil"],
  "💀": ["skull", "death"],
  "☠️": ["skull", "crossbones", "death"],
  "💩": ["pile", "poo", "poop"],
  "🤡": ["clown", "face"],
  "👹": ["ogre", "monster"],
  "👺": ["goblin", "monster"],
  "👻": ["ghost", "spooky"],
  "👽": ["alien", "extraterrestrial"],
  "👾": ["alien", "monster", "space"],
  "🤖": ["robot", "bot"],
  
  // Gestures & Body
  "👋": ["waving", "hand", "wave", "hello", "hi"],
  "🤚": ["raised", "back", "hand"],
  "🖐": ["hand", "fingers", "splayed"],
  "✋": ["raised", "hand", "stop", "high", "five"],
  "🖖": ["vulcan", "salute", "spock"],
  "👌": ["ok", "hand", "perfect"],
  "🤌": ["pinched", "fingers"],
  "🤏": ["pinching", "hand"],
  "✌️": ["victory", "hand", "peace"],
  "🤞": ["crossed", "fingers", "luck"],
  "🤟": ["love", "you", "gesture"],
  "🤘": ["sign", "horns", "rock"],
  "🤙": ["call", "me", "hand"],
  "👈": ["backhand", "index", "pointing", "left"],
  "👉": ["backhand", "index", "pointing", "right"],
  "👆": ["backhand", "index", "pointing", "up"],
  "🖕": ["middle", "finger", "flip"],
  "👇": ["backhand", "index", "pointing", "down"],
  "☝️": ["index", "pointing", "up"],
  "👍": ["thumbs", "up", "like", "good", "yes", "approve"],
  "👎": ["thumbs", "down", "dislike", "no", "bad"],
  "✊": ["raised", "fist", "power"],
  "👊": ["oncoming", "fist", "punch"],
  "🤛": ["left", "facing", "fist"],
  "🤜": ["right", "facing", "fist"],
  "👏": ["clapping", "hands", "clap", "applause", "bravo"],
  "🙌": ["raising", "hands", "celebration", "hallelujah"],
  "👐": ["open", "hands"],
  "🤲": ["palms", "together", "pray"],
  "🤝": ["handshake", "deal", "agreement"],
  "🙏": ["folded", "hands", "pray", "please"],
  "✍️": ["writing", "hand", "write"],
  "💪": ["flexed", "biceps", "muscle", "strong"],
  "🦾": ["mechanical", "arm"],
  "🦿": ["mechanical", "leg"],
  "🦵": ["leg"],
  "🦶": ["foot"],
  "👂": ["ear"],
  "🦻": ["ear", "hearing", "aid"],
  "👃": ["nose"],
  "🧠": ["brain"],
  "🫀": ["anatomical", "heart"],
  "🫁": ["lungs"],
  "🦷": ["tooth"],
  "🦴": ["bone"],
  "👀": ["eyes", "look", "see", "watch"],
  "👁️": ["eye"],
  "👅": ["tongue"],
  "👄": ["mouth", "lips"],
  
  // Animals & Nature
  "🐶": ["dog", "face", "puppy"],
  "🐱": ["cat", "face", "kitten"],
  "🐭": ["mouse", "face"],
  "🐹": ["hamster", "face"],
  "🐰": ["rabbit", "face", "bunny"],
  "🦊": ["fox", "face"],
  "🐻": ["bear", "face"],
  "🐼": ["panda", "face"],
  "🐻‍❄️": ["polar", "bear"],
  "🐨": ["koala"],
  "🐯": ["tiger", "face"],
  "🦁": ["lion", "face"],
  "🐮": ["cow", "face"],
  "🐷": ["pig", "face"],
  "🐽": ["pig", "nose"],
  "🐸": ["frog", "face"],
  "🐵": ["monkey", "face"],
  "🙈": ["see", "no", "evil", "monkey"],
  "🙉": ["hear", "no", "evil", "monkey"],
  "🙊": ["speak", "no", "evil", "monkey"],
  "🐒": ["monkey"],
  "🐔": ["chicken"],
  "🐧": ["penguin"],
  "🐦": ["bird"],
  "🐤": ["baby", "chick"],
  "🐣": ["hatching", "chick"],
  "🐥": ["front", "facing", "baby", "chick"],
  "🦆": ["duck"],
  "🦅": ["eagle"],
  "🦉": ["owl"],
  "🦇": ["bat"],
  "🐺": ["wolf", "face"],
  "🐗": ["boar"],
  "🐴": ["horse", "face"],
  "🦄": ["unicorn", "face"],
  "🐝": ["honeybee", "bee"],
  "🪱": ["worm"],
  "🐛": ["bug"],
  "🦋": ["butterfly"],
  "🐌": ["snail"],
  "🐞": ["lady", "beetle"],
  "🐜": ["ant"],
  "🪰": ["fly"],
  "🪲": ["beetle"],
  "🪳": ["cockroach"],
  "🦟": ["mosquito"],
  "🦗": ["cricket"],
  "🕷️": ["spider"],
  "🕸️": ["spider", "web"],
  "🦂": ["scorpion"],
  "🐢": ["turtle"],
  "🐍": ["snake"],
  "🦎": ["lizard"],
  "🦖": ["t", "rex", "dinosaur"],
  "🦕": ["sauropod", "dinosaur"],
  "🐙": ["octopus"],
  "🦑": ["squid"],
  "🦐": ["shrimp"],
  "🦞": ["lobster"],
  "🦀": ["crab"],
  "🐡": ["blowfish"],
  "🐠": ["tropical", "fish"],
  "🐟": ["fish"],
  "🐬": ["dolphin"],
  "🐳": ["spouting", "whale"],
  "🐋": ["whale"],
  "🦈": ["shark"],
  "🐊": ["crocodile"],
  "🐅": ["tiger"],
  "🐆": ["leopard"],
  "🦓": ["zebra"],
  "🦍": ["gorilla"],
  "🦧": ["orangutan"],
  "🦣": ["mammoth"],
  "🐘": ["elephant"],
  "🦛": ["hippopotamus"],
  "🦏": ["rhinoceros"],
  "🐪": ["camel", "one", "hump"],
  "🐫": ["camel", "two", "humps"],
  "🦒": ["giraffe"],
  "🦘": ["kangaroo"],
  "🦬": ["bison"],
  "🐃": ["water", "buffalo"],
  "🐂": ["ox"],
  "🐄": ["cow"],
  "🐎": ["horse"],
  "🐖": ["pig"],
  "🐏": ["ram"],
  "🐑": ["ewe", "sheep"],
  "🦙": ["llama"],
  "🐐": ["goat"],
  "🦌": ["deer"],
  "🐕": ["dog"],
  "🐩": ["poodle"],
  "🦮": ["guide", "dog"],
  "🐕‍🦺": ["service", "dog"],
  "🐈": ["cat"],
  "🐈‍⬛": ["black", "cat"],
  "🪶": ["feather"],
  "🐓": ["rooster"],
  "🦃": ["turkey"],
  "🦤": ["dodo"],
  "🦚": ["peacock"],
  "🦜": ["parrot"],
  "🦢": ["swan"],
  "🦩": ["flamingo"],
  "🕊️": ["dove", "peace"],
  "🐇": ["rabbit"],
  "🦝": ["raccoon"],
  "🦨": ["skunk"],
  "🦡": ["badger"],
  "🦫": ["beaver"],
  "🦦": ["otter"],
  "🦥": ["sloth"],
  "🐁": ["mouse"],
  "🐀": ["rat"],
  "🐿️": ["chipmunk"],
  "🦔": ["hedgehog"],
  "🌲": ["evergreen", "tree"],
  "🌳": ["deciduous", "tree"],
  "🌴": ["palm", "tree"],
  "🌵": ["cactus"],
  "🌶️": ["hot", "pepper", "chili"],
  "🌾": ["sheaf", "rice"],
  "🌿": ["herb"],
  "☘️": ["shamrock"],
  "🍀": ["four", "leaf", "clover", "luck"],
  "🍁": ["maple", "leaf"],
  "🍂": ["fallen", "leaf"],
  "🍃": ["leaf", "fluttering", "wind"],
  "🌍": ["globe", "showing", "europe", "africa"],
  "🌎": ["globe", "showing", "americas"],
  "🌏": ["globe", "showing", "asia", "australia"],
  "🌐": ["globe", "meridians"],
  "🗺️": ["world", "map"],
  "🧭": ["compass"],
  "🏔️": ["snow", "capped", "mountain"],
  "⛰️": ["mountain"],
  "🌋": ["volcano"],
  "🗻": ["mount", "fuji"],
  "🏕️": ["camping"],
  "🏖️": ["beach", "umbrella"],
  "🏜️": ["desert"],
  "🏝️": ["desert", "island"],
  "🏞️": ["national", "park"],
  "🏟️": ["stadium"],
  "🏛️": ["classical", "building"],
  "🏗️": ["building", "construction"],
  "🧱": ["brick"],
  "🏘️": ["houses"],
  "🏚️": ["derelict", "house"],
  "🏠": ["house"],
  "🏡": ["house", "garden"],
  "🏢": ["office", "building"],
  "🏣": ["japanese", "post", "office"],
  "🏤": ["post", "office"],
  "🏥": ["hospital"],
  "🏦": ["bank"],
  "🏨": ["hotel"],
  "🏩": ["love", "hotel"],
  "🏪": ["convenience", "store"],
  "🏫": ["school"],
  "🏬": ["department", "store"],
  "🏭": ["factory"],
  "🏯": ["japanese", "castle"],
  "🏰": ["castle"],
  "💒": ["wedding"],
  "🗼": ["tokyo", "tower"],
  "🗽": ["statue", "liberty"],
  "⛪": ["church"],
  "🕌": ["mosque"],
  "🛕": ["hindu", "temple"],
  "🕍": ["synagogue"],
  "⛩️": ["shinto", "shrine"],
  "🕋": ["kaaba"],
  "⛲": ["fountain"],
  "⛺": ["tent", "camping"],
  "🌁": ["foggy"],
  "🌃": ["night", "stars"],
  "🏙️": ["cityscape"],
  "🌄": ["sunrise", "mountains"],
  "🌅": ["sunrise"],
  "🌆": ["cityscape", "dusk"],
  "🌇": ["sunset"],
  "🌉": ["bridge", "night"],
  "♨️": ["hot", "springs"],
  "🎠": ["carousel", "horse"],
  "🎡": ["ferris", "wheel"],
  "🎢": ["roller", "coaster"],
  "💈": ["barber", "pole"],
  "🎪": ["circus", "tent"],
  "🚂": ["locomotive", "train"],
  "🚃": ["railway", "car"],
  "🚄": ["high", "speed", "train"],
  "🚅": ["bullet", "train"],
  "🚆": ["train"],
  "🚇": ["metro", "subway"],
  "🚈": ["light", "rail"],
  "🚉": ["station"],
  "🚊": ["tram"],
  "🚝": ["monorail"],
  "🚞": ["mountain", "railway"],
  "🚟": ["suspension", "railway"],
  "🚠": ["mountain", "cableway"],
  "🚡": ["aerial", "tramway"],
  "🛸": ["flying", "saucer", "ufo"],
  "🚀": ["rocket"],
  "🛎️": ["bellhop", "bell"],
  "🧳": ["luggage"],
  "⌛": ["hourglass", "done"],
  "⏳": ["hourglass", "not", "done"],
  "⌚": ["watch"],
  "⏰": ["alarm", "clock"],
  "⏲️": ["timer", "clock"],
  "⏱️": ["stopwatch"],
  "🧭": ["compass"],
  
  // Food & Drink
  "🍏": ["green", "apple"],
  "🍎": ["red", "apple"],
  "🍐": ["pear"],
  "🍊": ["tangerine", "orange"],
  "🍋": ["lemon"],
  "🍌": ["banana"],
  "🍉": ["watermelon"],
  "🍇": ["grapes"],
  "🍓": ["strawberry"],
  "🫐": ["blueberries"],
  "🍈": ["melon"],
  "🍒": ["cherries"],
  "🍑": ["peach"],
  "🥭": ["mango"],
  "🍍": ["pineapple"],
  "🥥": ["coconut"],
  "🥝": ["kiwi", "fruit"],
  "🍅": ["tomato"],
  "🍆": ["eggplant", "aubergine"],
  "🥑": ["avocado"],
  "🥦": ["broccoli"],
  "🥬": ["leafy", "green"],
  "🥒": ["cucumber"],
  "🌶️": ["hot", "pepper"],
  "🫑": ["bell", "pepper"],
  "🌽": ["corn", "ear"],
  "🥕": ["carrot"],
  "🫒": ["olive"],
  "🧄": ["garlic"],
  "🧅": ["onion"],
  "🥔": ["potato"],
  "🍠": ["roasted", "sweet", "potato"],
  "🥐": ["croissant"],
  "🥯": ["bagel"],
  "🍞": ["bread"],
  "🥖": ["baguette", "bread"],
  "🥨": ["pretzel"],
  "🧀": ["cheese", "wedge"],
  "🥚": ["egg"],
  "🍳": ["cooking", "fried", "egg"],
  "🥞": ["pancakes"],
  "🥓": ["bacon"],
  "🥩": ["cut", "meat"],
  "🍗": ["poultry", "leg"],
  "🍖": ["meat", "bone"],
  "🦴": ["bone"],
  "🌭": ["hot", "dog"],
  "🍔": ["hamburger", "burger"],
  "🍟": ["french", "fries"],
  "🍕": ["pizza", "slice"],
  "🫓": ["flatbread"],
  "🥪": ["sandwich"],
  "🥙": ["stuffed", "flatbread"],
  "🧆": ["falafel"],
  "🌮": ["taco"],
  "🌯": ["burrito"],
  "🫔": ["tamale"],
  "🥗": ["green", "salad"],
  "🥘": ["shallow", "pan", "food"],
  "🫕": ["fondue"],
  "🥫": ["canned", "food"],
  "🍝": ["spaghetti"],
  "🍜": ["steaming", "bowl"],
  "🍲": ["pot", "food"],
  "🍛": ["curry", "rice"],
  "🍣": ["sushi"],
  "🍱": ["bento", "box"],
  "🥟": ["dumpling"],
  "🦪": ["oyster"],
  "🍤": ["fried", "shrimp"],
  "🍙": ["rice", "ball"],
  "🍚": ["cooked", "rice"],
  "🍘": ["rice", "cracker"],
  "🍥": ["fish", "cake", "swirl"],
  "🥠": ["fortune", "cookie"],
  "🥮": ["moon", "cake"],
  "🍢": ["oden"],
  "🍡": ["dango"],
  "🍧": ["shaved", "ice"],
  "🍨": ["ice", "cream"],
  "🍦": ["soft", "ice", "cream"],
  "🥧": ["pie"],
  "🧁": ["cupcake"],
  "🍰": ["birthday", "cake"],
  "🎂": ["birthday", "cake", "candles"],
  "🍮": ["custard"],
  "🍭": ["lollipop"],
  "🍬": ["candy"],
  "🍫": ["chocolate", "bar"],
  "🍿": ["popcorn"],
  "🍩": ["doughnut"],
  "🍪": ["cookie"],
  "🌰": ["chestnut"],
  "🥜": ["peanuts"],
  "🍯": ["honey", "pot"],
  "🥛": ["glass", "milk"],
  "🍼": ["baby", "bottle"],
  "🫖": ["teapot"],
  "☕️": ["hot", "beverage", "coffee", "tea"],
  "🍵": ["teacup", "handle"],
  "🧃": ["beverage", "box"],
  "🥤": ["cup", "straw"],
  "🧋": ["bubble", "tea"],
  "🍶": ["sake", "bottle", "cup"],
  "🍺": ["beer", "mug"],
  "🍻": ["clinking", "beer", "mugs"],
  "🥂": ["clinking", "glasses"],
  "🍷": ["wine", "glass"],
  "🥃": ["tumbler", "glass"],
  "🍸": ["cocktail", "glass"],
  "🍹": ["tropical", "drink"],
  "🧉": ["mate"],
  "🍾": ["bottle", "popping", "cork"],
  "🧊": ["ice"],
  
  // Activities & Sports
  "⚽": ["soccer", "ball", "football"],
  "🏀": ["basketball"],
  "🏈": ["american", "football"],
  "⚾": ["baseball"],
  "🥎": ["softball"],
  "🎾": ["tennis"],
  "🏐": ["volleyball"],
  "🏉": ["rugby", "football"],
  "🥏": ["flying", "disc"],
  "🎱": ["pool", "ball", "8"],
  "🏓": ["ping", "pong", "table", "tennis"],
  "🏸": ["badminton"],
  "🏒": ["ice", "hockey", "stick", "puck"],
  "🏑": ["field", "hockey"],
  "🥍": ["lacrosse"],
  "🏏": ["cricket", "game"],
  "🥅": ["goal", "net"],
  "⛳": ["flag", "hole", "golf"],
  "🏹": ["bow", "arrow"],
  "🎣": ["fishing", "pole"],
  "🤿": ["diving", "mask"],
  "🥊": ["boxing", "glove"],
  "🥋": ["martial", "arts", "uniform"],
  "🎽": ["running", "shirt"],
  "🛹": ["skateboard"],
  "🛷": ["sled"],
  "⛸️": ["ice", "skate"],
  "🥌": ["curling", "stone"],
  "🎿": ["skis"],
  "⛷️": ["skier"],
  "🏂": ["snowboarder"],
  "🪂": ["parachute"],
  "🏋️‍♀️": ["woman", "lifting", "weights"],
  "🏋️": ["person", "lifting", "weights"],
  "🏋️‍♂️": ["man", "lifting", "weights"],
  "🤼‍♀️": ["women", "wrestling"],
  "🤼": ["people", "wrestling"],
  "🤼‍♂️": ["men", "wrestling"],
  "🤸‍♀️": ["woman", "cartwheeling"],
  "🤸": ["person", "cartwheeling"],
  "🤸‍♂️": ["man", "cartwheeling"],
  "⛹️‍♀️": ["woman", "bouncing", "ball"],
  "⛹️": ["person", "bouncing", "ball"],
  "⛹️‍♂️": ["man", "bouncing", "ball"],
  "🤺": ["person", "fencing"],
  "🤾‍♀️": ["woman", "playing", "handball"],
  "🤾": ["person", "playing", "handball"],
  "🤾‍♂️": ["man", "playing", "handball"],
  "🏌️‍♀️": ["woman", "golfing"],
  "🏌️": ["person", "golfing"],
  "🏌️‍♂️": ["man", "golfing"],
  "🏇": ["horse", "racing"],
  "🧘‍♀️": ["woman", "lotus", "position"],
  "🧘": ["person", "lotus", "position"],
  "🧘‍♂️": ["man", "lotus", "position"],
  "🏄‍♀️": ["woman", "surfing"],
  "🏄": ["person", "surfing"],
  "🏄‍♂️": ["man", "surfing"],
  "🏊‍♀️": ["woman", "swimming"],
  "🏊": ["person", "swimming"],
  "🏊‍♂️": ["man", "swimming"],
  "🤽‍♀️": ["woman", "playing", "water", "polo"],
  "🤽": ["person", "playing", "water", "polo"],
  "🤽‍♂️": ["man", "playing", "water", "polo"],
  "🚣‍♀️": ["woman", "rowing", "boat"],
  "🚣": ["person", "rowing", "boat"],
  "🚣‍♂️": ["man", "rowing", "boat"],
  "🧗‍♀️": ["woman", "climbing"],
  "🧗": ["person", "climbing"],
  "🧗‍♂️": ["man", "climbing"],
  "🚵‍♀️": ["woman", "mountain", "biking"],
  "🚵": ["person", "mountain", "biking"],
  "🚵‍♂️": ["man", "mountain", "biking"],
  "🚴‍♀️": ["woman", "biking"],
  "🚴": ["person", "biking"],
  "🚴‍♂️": ["man", "biking"],
  "🏆": ["trophy"],
  "🥇": ["1st", "place", "medal", "gold"],
  "🥈": ["2nd", "place", "medal", "silver"],
  "🥉": ["3rd", "place", "medal", "bronze"],
  "🏅": ["sports", "medal"],
  "🎖️": ["military", "medal"],
  "🏵️": ["reminder", "ribbon"],
  "🎗️": ["reminder", "ribbon"],
  "🎫": ["ticket"],
  "🎟️": ["admission", "tickets"],
  "🎪": ["circus", "tent"],
  "🤹‍♀️": ["woman", "juggling"],
  "🤹": ["person", "juggling"],
  "🤹‍♂️": ["man", "juggling"],
  "🎭": ["performing", "arts"],
  "🩰": ["ballet", "shoes"],
  "🎨": ["artist", "palette"],
  "🎬": ["clapper", "board"],
  "🎤": ["microphone"],
  "🎧": ["headphone"],
  "🎼": ["musical", "score"],
  "🎹": ["musical", "keyboard"],
  "🥁": ["drum"],
  "🪘": ["long", "drum"],
  "🎷": ["saxophone"],
  "🎺": ["trumpet"],
  "🪗": ["accordion"],
  "🎸": ["guitar"],
  "🪕": ["banjo"],
  "🎻": ["violin"],
  "🎲": ["game", "die"],
  "♟️": ["chess", "pawn"],
  "🎯": ["direct", "hit", "dart", "target"],
  "🎳": ["bowling"],
  "🎮": ["video", "game"],
  "🎰": ["slot", "machine"],
  "🧩": ["puzzle", "piece"],
  
  // Travel & Places
  "🚗": ["automobile", "car"],
  "🚕": ["taxi"],
  "🚙": ["sport", "utility", "vehicle", "suv"],
  "🚌": ["bus"],
  "🚎": ["trolleybus"],
  "🏎️": ["racing", "car"],
  "🚓": ["police", "car"],
  "🚑": ["ambulance"],
  "🚒": ["fire", "engine"],
  "🚐": ["minivan"],
  "🛻": ["pickup", "truck"],
  "🚚": ["delivery", "truck"],
  "🚛": ["articulated", "lorry"],
  "🚜": ["tractor"],
  "🦽": ["manual", "wheelchair"],
  "🦼": ["motorized", "wheelchair"],
  "🛴": ["kick", "scooter"],
  "🚲": ["bicycle", "bike"],
  "🛵": ["motor", "scooter"],
  "🏍️": ["motorcycle"],
  "🛺": ["auto", "rickshaw"],
  "🚨": ["police", "car", "light"],
  "🚔": ["oncoming", "police", "car"],
  "🚍": ["oncoming", "bus"],
  "🚘": ["oncoming", "automobile"],
  "🚖": ["oncoming", "taxi"],
  "🚡": ["aerial", "tramway"],
  "🚟": ["suspension", "railway"],
  "🚠": ["mountain", "cableway"],
  "🚡": ["aerial", "tramway"],
  "🛸": ["flying", "saucer"],
  "🚀": ["rocket"],
  "🛎️": ["bellhop", "bell"],
  "🧳": ["luggage"],
  "⌛": ["hourglass", "done"],
  "⏳": ["hourglass", "not", "done"],
  "⌚": ["watch"],
  "⏰": ["alarm", "clock"],
  "⏲️": ["timer", "clock"],
  "⏱️": ["stopwatch"],
  "🧭": ["compass"],
  "🌍": ["globe", "europe", "africa"],
  "🌎": ["globe", "americas"],
  "🌏": ["globe", "asia", "australia"],
  "🌐": ["globe", "meridians"],
  "🗺️": ["world", "map"],
  "🧭": ["compass"],
  "🏔️": ["snow", "capped", "mountain"],
  "⛰️": ["mountain"],
  "🌋": ["volcano"],
  "🗻": ["mount", "fuji"],
  "🏕️": ["camping"],
  "🏖️": ["beach", "umbrella"],
  "🏜️": ["desert"],
  "🏝️": ["desert", "island"],
  "🏞️": ["national", "park"],
  "🏟️": ["stadium"],
  "🏛️": ["classical", "building"],
  "🏗️": ["building", "construction"],
  "🧱": ["brick"],
  "🏘️": ["houses"],
  "🏚️": ["derelict", "house"],
  "🏠": ["house"],
  "🏡": ["house", "garden"],
  "🏢": ["office", "building"],
  "🏣": ["japanese", "post", "office"],
  "🏤": ["post", "office"],
  "🏥": ["hospital"],
  "🏦": ["bank"],
  "🏨": ["hotel"],
  "🏩": ["love", "hotel"],
  "🏪": ["convenience", "store"],
  "🏫": ["school"],
  "🏬": ["department", "store"],
  "🏭": ["factory"],
  "🏯": ["japanese", "castle"],
  "🏰": ["castle"],
  "💒": ["wedding"],
  "🗼": ["tokyo", "tower"],
  "🗽": ["statue", "liberty"],
  "⛪": ["church"],
  "🕌": ["mosque"],
  "🛕": ["hindu", "temple"],
  "🕍": ["synagogue"],
  "⛩️": ["shinto", "shrine"],
  "🕋": ["kaaba"],
  "⛲": ["fountain"],
  "⛺": ["tent"],
  "🌁": ["foggy"],
  "🌃": ["night", "stars"],
  "🏙️": ["cityscape"],
  "🌄": ["sunrise", "mountains"],
  "🌅": ["sunrise"],
  "🌆": ["cityscape", "dusk"],
  "🌇": ["sunset"],
  "🌉": ["bridge", "night"],
  "♨️": ["hot", "springs"],
  "🎠": ["carousel", "horse"],
  "🎡": ["ferris", "wheel"],
  "🎢": ["roller", "coaster"],
  "💈": ["barber", "pole"],
  "🎪": ["circus", "tent"],
  
  // Objects
  "⌚": ["watch"],
  "📱": ["mobile", "phone"],
  "📲": ["mobile", "phone", "arrow"],
  "💻": ["laptop", "computer"],
  "⌨️": ["keyboard"],
  "🖥️": ["desktop", "computer"],
  "🖨️": ["printer"],
  "🖱️": ["computer", "mouse"],
  "🖲️": ["trackball"],
  "🕹️": ["joystick"],
  "🗜️": ["clamp"],
  "💾": ["floppy", "disk"],
  "💿": ["optical", "disk"],
  "📀": ["dvd"],
  "📼": ["videocassette"],
  "📷": ["camera"],
  "📸": ["camera", "flash"],
  "📹": ["video", "camera"],
  "🎥": ["movie", "camera"],
  "📽️": ["film", "projector"],
  "🎞️": ["film", "frames"],
  "📞": ["telephone", "receiver"],
  "☎️": ["telephone"],
  "📟": ["pager"],
  "📠": ["fax", "machine"],
  "📺": ["television"],
  "📻": ["radio"],
  "🎙️": ["studio", "microphone"],
  "🎚️": ["level", "slider"],
  "🎛️": ["control", "knobs"],
  "⏱️": ["stopwatch"],
  "⏲️": ["timer", "clock"],
  "⏰": ["alarm", "clock"],
  "🕰️": ["mantelpiece", "clock"],
  "⌛": ["hourglass", "done"],
  "⏳": ["hourglass", "not", "done"],
  "📡": ["satellite", "antenna"],
  "🔋": ["battery"],
  "🔌": ["electric", "plug"],
  "💡": ["light", "bulb"],
  "🔦": ["flashlight"],
  "🕯️": ["candle"],
  "🧯": ["fire", "extinguisher"],
  "🛢️": ["oil", "drum"],
  "💸": ["money", "wings"],
  "💵": ["dollar", "banknote"],
  "💴": ["yen", "banknote"],
  "💶": ["euro", "banknote"],
  "💷": ["pound", "banknote"],
  "💰": ["money", "bag"],
  "💳": ["credit", "card"],
  "💎": ["gem", "stone", "diamond"],
  "⚖️": ["balance", "scale"],
  "🪜": ["ladder"],
  "🧰": ["toolbox"],
  "🪛": ["screwdriver"],
  "🔧": ["wrench"],
  "🔨": ["hammer"],
  "⚒️": ["hammer", "pick"],
  "🛠️": ["hammer", "wrench"],
  "⛏️": ["pick"],
  "🪚": ["carpenter", "saw"],
  "🔩": ["nut", "bolt"],
  "⚙️": ["gear"],
  "🪤": ["mouse", "trap"],
  "🧱": ["brick"],
  "⛓️": ["chains"],
  "🧲": ["magnet"],
  "🔫": ["water", "pistol"],
  "💣": ["bomb"],
  "🧨": ["firecracker"],
  "🪓": ["axe"],
  "🔪": ["kitchen", "knife"],
  "🗡️": ["dagger"],
  "⚔️": ["crossed", "swords"],
  "🛡️": ["shield"],
  "🚬": ["cigarette"],
  "⚰️": ["coffin"],
  "🪦": ["headstone"],
  "⚱️": ["funeral", "urn"],
  "🏺": ["amphora"],
  "🔮": ["crystal", "ball"],
  "📿": ["prayer", "beads"],
  "🧿": ["nazar", "amulet"],
  "💈": ["barber", "pole"],
  "⚗️": ["alembic"],
  "🔭": ["telescope"],
  "🔬": ["microscope"],
  "🕳️": ["hole"],
  "🩹": ["adhesive", "bandage"],
  "🩺": ["stethoscope"],
  "💊": ["pill"],
  "💉": ["syringe"],
  "🩸": ["drop", "blood"],
  "🧬": ["dna"],
  "🦠": ["microbe"],
  "🧫": ["petri", "dish"],
  "🧪": ["test", "tube"],
  "🌡️": ["thermometer"],
  "🧹": ["broom"],
  "🪠": ["plunger"],
  "🧺": ["basket"],
  "🧻": ["roll", "toilet", "paper"],
  "🚽": ["toilet"],
  "🚿": ["shower"],
  "🛁": ["bathtub"],
  "🛀": ["person", "bathing"],
  "🧼": ["soap"],
  "🪥": ["toothbrush"],
  "🪒": ["razor"],
  "🧽": ["sponge"],
  "🪣": ["bucket"],
  "🧴": ["lotion", "bottle"],
  "🛎️": ["bellhop", "bell"],
  "🔑": ["key"],
  "🗝️": ["old", "key"],
  "🚪": ["door"],
  "🪑": ["chair"],
  "🛋️": ["couch", "lamp"],
  "🛏️": ["bed"],
  "🛌": ["person", "bed"],
  "🧸": ["teddy", "bear"],
  "🪆": ["nesting", "dolls"],
  "🖼️": ["framed", "picture"],
  "🪞": ["mirror"],
  "🪟": ["window"],
  "🛍️": ["shopping", "bags"],
  "🛒": ["shopping", "cart"],
  "🎁": ["wrapped", "gift"],
  "🎈": ["balloon"],
  "🎏": ["carp", "streamer"],
  "🎀": ["ribbon"],
  "🪄": ["magic", "wand"],
  "🪅": ["pinata"],
  "🎊": ["confetti", "ball"],
  "🎉": ["party", "popper", "celebration"],
  "🎎": ["japanese", "dolls"],
  "🏮": ["red", "paper", "lantern"],
  "🎐": ["wind", "chime"],
  "🧧": ["red", "envelope"],
  "✉️": ["envelope"],
  "📩": ["envelope", "arrow"],
  "📨": ["incoming", "envelope"],
  "📧": ["e", "mail"],
  "💌": ["love", "letter"],
  "📥": ["inbox", "tray"],
  "📤": ["outbox", "tray"],
  "📦": ["package"],
  "🏷️": ["label"],
  "🪧": ["placard"],
  "📪": ["closed", "mailbox", "lowered", "flag"],
  "📫": ["closed", "mailbox", "raised", "flag"],
  "📬": ["open", "mailbox", "raised", "flag"],
  "📭": ["open", "mailbox", "lowered", "flag"],
  "📮": ["postbox"],
  "📯": ["postal", "horn"],
  "📜": ["scroll"],
  "📃": ["page", "curl"],
  "📄": ["page", "facing", "up"],
  "📑": ["bookmark", "tabs"],
  "🧾": ["receipt"],
  "📊": ["bar", "chart"],
  "📈": ["chart", "increasing"],
  "📉": ["chart", "decreasing"],
  "🗒️": ["spiral", "notepad"],
  "🗓️": ["spiral", "calendar"],
  "📆": ["tear", "off", "calendar"],
  "📅": ["calendar"],
  "🗑️": ["wastebasket"],
  "📇": ["card", "index"],
  "🗃️": ["card", "file", "box"],
  "🗳️": ["ballot", "box", "ballot"],
  "🗄️": ["file", "cabinet"],
  "📋": ["clipboard"],
  "📁": ["file", "folder"],
  "📂": ["open", "file", "folder"],
  "🗂️": ["card", "index", "dividers"],
  "🗞️": ["rolled", "up", "newspaper"],
  "📰": ["newspaper"],
  "📓": ["notebook"],
  "📔": ["notebook", "decorative", "cover"],
  "📒": ["ledger"],
  "📕": ["closed", "book"],
  "📗": ["green", "book"],
  "📘": ["blue", "book"],
  "📙": ["orange", "book"],
  "📚": ["books"],
  "📖": ["open", "book"],
  "🔖": ["bookmark"],
  "🧷": ["safety", "pin"],
  "🔗": ["link"],
  "📎": ["paperclip"],
  "🖇️": ["linked", "paperclips"],
  "📐": ["triangular", "ruler"],
  "📏": ["straight", "ruler"],
  "🧮": ["abacus"],
  "📌": ["pushpin"],
  "📍": ["round", "pushpin"],
  "✂️": ["scissors"],
  "🖊️": ["pen"],
  "🖋️": ["fountain", "pen"],
  "✒️": ["black", "nib"],
  "🖌️": ["paintbrush"],
  "🖍️": ["crayon"],
  "📝": ["memo"],
  "✏️": ["pencil"],
  "🔍": ["left", "pointing", "magnifying", "glass"],
  "🔎": ["right", "pointing", "magnifying", "glass"],
  "🔏": ["locked", "pen", "nib"],
  "🔐": ["locked", "key"],
  "🔒": ["locked"],
  "🔓": ["unlocked"],
  
  // Symbols
  "❤️": ["red", "heart", "love", "like"],
  "🧡": ["orange", "heart"],
  "💛": ["yellow", "heart"],
  "💚": ["green", "heart"],
  "💙": ["blue", "heart"],
  "💜": ["purple", "heart"],
  "🖤": ["black", "heart"],
  "🤍": ["white", "heart"],
  "🤎": ["brown", "heart"],
  "💔": ["broken", "heart"],
  "❣️": ["heart", "exclamation"],
  "💕": ["two", "hearts"],
  "💞": ["revolving", "hearts"],
  "💓": ["beating", "heart"],
  "💗": ["growing", "heart"],
  "💖": ["sparkling", "heart"],
  "💘": ["heart", "arrow"],
  "💝": ["heart", "ribbon"],
  "💟": ["heart", "decoration"],
  "☮️": ["peace", "symbol"],
  "✝️": ["latin", "cross"],
  "☪️": ["star", "crescent"],
  "🕉️": ["om"],
  "☸️": ["wheel", "dharma"],
  "✡️": ["star", "david"],
  "🔯": ["dotted", "six", "pointed", "star"],
  "🕎": ["menorah"],
  "☯️": ["yin", "yang"],
  "☦️": ["orthodox", "cross"],
  "🛐": ["place", "worship"],
  "⛎": ["ophiuchus"],
  "♈": ["aries"],
  "♉": ["taurus"],
  "♊": ["gemini"],
  "♋": ["cancer"],
  "♌": ["leo"],
  "♍": ["virgo"],
  "♎": ["libra"],
  "♏": ["scorpio"],
  "♐": ["sagittarius"],
  "♑": ["capricorn"],
  "♒": ["aquarius"],
  "♓": ["pisces"],
  "🆔": ["identification", "card"],
  "⚛️": ["atom", "symbol"],
  "🉑": ["japanese", "acceptable", "button"],
  "☢️": ["radioactive"],
  "☣️": ["biohazard"],
  "📴": ["mobile", "phone", "off"],
  "📳": ["vibration", "mode"],
  "🈶": ["japanese", "not", "free", "charge", "button"],
  "🈚": ["japanese", "free", "charge", "button"],
  "🈸": ["japanese", "application", "button"],
  "🈺": ["japanese", "open", "business", "hours", "button"],
  "🈷️": ["japanese", "monthly", "amount", "button"],
  "✴️": ["eight", "pointed", "star"],
  "🆚": ["vs", "button"],
  "💮": ["white", "flower"],
  "🉐": ["japanese", "bargain", "button"],
  "㊙️": ["japanese", "secret", "button"],
  "㊗️": ["japanese", "congratulations", "button"],
  "🈴": ["japanese", "passing", "grade", "button"],
  "🈵": ["japanese", "no", "vacancy", "button"],
  "🈹": ["japanese", "discount", "button"],
  "🈲": ["japanese", "prohibited", "button"],
  "🅰️": ["a", "blood", "type", "button"],
  "🅱️": ["b", "blood", "type", "button"],
  "🆎": ["ab", "blood", "type", "button"],
  "🆑": ["cl", "button"],
  "🅾️": ["o", "blood", "type", "button"],
  "🆘": ["sos", "button"],
  "❌": ["cross", "mark"],
  "⭕": ["heavy", "large", "circle"],
  "🛑": ["stop", "sign"],
  "⛔": ["no", "entry"],
  "📛": ["name", "badge"],
  "🚫": ["prohibited"],
  "💯": ["hundred", "points", "100", "perfect"],
  "💢": ["anger", "symbol"],
  "♨️": ["hot", "springs"],
  "🚷": ["no", "pedestrians"],
  "🚯": ["no", "littering"],
  "🚳": ["no", "bicycles"],
  "🚱": ["non", "potable", "water"],
  "🔞": ["no", "one", "under", "eighteen"],
  "📵": ["no", "mobile", "phones"],
  "🚭": ["no", "smoking"],
  "❗": ["exclamation", "mark"],
  "❓": ["question", "mark"],
  "❕": ["white", "exclamation", "mark"],
  "❔": ["white", "question", "mark"],
  "‼️": ["double", "exclamation", "mark"],
  "⁉️": ["exclamation", "question", "mark"],
  "🔅": ["dim", "button"],
  "🔆": ["bright", "button"],
  "〽️": ["part", "alternation", "mark"],
  "⚠️": ["warning"],
  "🚸": ["children", "crossing"],
  "🔱": ["trident", "emblem"],
  "⚜️": ["fleur", "de", "lis"],
  "🔰": ["japanese", "symbol", "beginner"],
  "♻️": ["recycling", "symbol"],
  "✅": ["check", "mark", "button"],
  "🈯": ["japanese", "reserved", "button"],
  "💹": ["chart", "increasing", "yen"],
  "❇️": ["sparkle"],
  "✳️": ["eight", "spoked", "asterisk"],
  "❎": ["cross", "mark", "button"],
  "🌐": ["globe", "meridians"],
  "💠": ["diamond", "dot"],
  "Ⓜ️": ["circled", "m"],
  "🌀": ["cyclone"],
  "💤": ["zzz"],
  "🏧": ["atm", "sign"],
  "🚾": ["water", "closet"],
  "♿": ["wheelchair", "symbol"],
  "🅿️": ["p", "button"],
  "🈳": ["japanese", "vacancy", "button"],
  "🈂️": ["japanese", "service", "charge", "button"],
  "🛂": ["passport", "control"],
  "🛃": ["customs"],
  "🛄": ["baggage", "claim"],
  "🛅": ["left", "luggage"],
  "🚹": ["mens", "room"],
  "🚺": ["womens", "room"],
  "🚼": ["baby", "symbol"],
  "🚻": ["restroom"],
  "🚮": ["litter", "bin", "sign"],
  "🎦": ["cinema"],
  "📶": ["antenna", "bars"],
  "🈁": ["japanese", "here", "button"],
  "🔣": ["input", "symbols"],
  "ℹ️": ["information"],
  "🔤": ["input", "latin", "letters"],
  "🔡": ["input", "latin", "lowercase"],
  "🔠": ["input", "latin", "uppercase"],
  "🔢": ["input", "numbers"],
  "🔟": ["keycap", "10"],
  "#️⃣": ["keycap", "hash"],
  "*️⃣": ["keycap", "asterisk"],
  "0️⃣": ["keycap", "0"],
  "1️⃣": ["keycap", "1"],
  "2️⃣": ["keycap", "2"],
  "3️⃣": ["keycap", "3"],
  "4️⃣": ["keycap", "4"],
  "5️⃣": ["keycap", "5"],
  "6️⃣": ["keycap", "6"],
  "7️⃣": ["keycap", "7"],
  "8️⃣": ["keycap", "8"],
  "9️⃣": ["keycap", "9"],
  "🔟": ["keycap", "10"],
  "🔠": ["input", "latin", "uppercase"],
  "🔡": ["input", "latin", "lowercase"],
  "🔤": ["input", "latin", "letters"],
  "🔣": ["input", "symbols"],
  "🎵": ["musical", "note"],
  "🎶": ["musical", "notes"],
  "➕": ["plus"],
  "➖": ["minus"],
  "➗": ["divide"],
  "✖️": ["multiply"],
  "💲": ["heavy", "dollar", "sign"],
  "💱": ["currency", "exchange"],
  "™️": ["trade", "mark"],
  "©️": ["copyright"],
  "®️": ["registered"],
  "〰️": ["wavy", "dash"],
  "➰": ["curly", "loop"],
  "➿": ["double", "curly", "loop"],
  "🔚": ["end", "arrow"],
  "🔙": ["back", "arrow"],
  "🔛": ["on", "arrow"],
  "🔜": ["soon", "arrow"],
  "🔝": ["top", "arrow"],
}

// Generate keywords for all emojis (fallback to emoji name)
function getEmojiKeywords(emoji: string): string[] {
  const keywords: string[] = []
  
  // Add explicit emoji names if available
  if (EMOJI_NAMES[emoji]) {
    keywords.push(...EMOJI_NAMES[emoji])
  }
  
  // Find category and add category keywords
  for (const [category, emojis] of Object.entries(EMOJI_CATEGORIES)) {
    if (emojis.includes(emoji)) {
      // Add category name words
      const categoryWords = category.toLowerCase().split(/\s+/)
      keywords.push(...categoryWords)
      
      // Add category synonyms
      if (category.includes("Smileys")) keywords.push("smiley", "emotion", "face", "happy", "sad")
      if (category.includes("People")) keywords.push("person", "people", "human")
      if (category.includes("Gestures")) keywords.push("gesture", "hand", "wave", "point")
      if (category.includes("Body")) keywords.push("body", "part")
      if (category.includes("Animals")) keywords.push("animal", "pet", "dog", "cat")
      if (category.includes("Nature")) keywords.push("nature", "plant", "tree", "flower")
      if (category.includes("Food")) keywords.push("food", "eat", "meal", "drink")
      if (category.includes("Activities")) keywords.push("activity", "sport", "game", "play")
      if (category.includes("Travel")) keywords.push("travel", "place", "location", "car", "plane")
      if (category.includes("Objects")) keywords.push("object", "thing", "item")
      if (category.includes("Symbols")) keywords.push("symbol", "sign", "mark")
      
      break
    }
  }
  
  // Always include the emoji itself as a keyword
  keywords.push(emoji)
  
  return keywords
}

export function EmojiPicker({ visible, onClose, onSelectEmoji, currentReactions = [] }: EmojiPickerProps) {
  const insets = useSafeAreaInsets()
  const { colors: themeColors, isDark } = useTheme()
  const slideAnim = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  // Popular emojis for quick access carousel
  const POPULAR_EMOJIS = ["❤️", "😂", "🙏", "😍", "🔥", "👍", "😊", "🎉", "💯", "😭", "🤣", "😮", "😢", "😱", "🥰", "😴", "🤔", "😎", "🥳", "🙌"]
  const searchInputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (visible) {
      // Immediately set to final position to avoid lag - no animation delay
      slideAnim.setValue(1)
      // Use a very fast spring animation for instant feel
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100, // Increased tension for faster animation
        friction: 8, // Reduced friction for snappier feel
      }).start()
      // Reset search and category when opened
      setSearchQuery("")
      setSelectedCategory(null)
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false })
      // Focus search input immediately to open keyboard faster
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50) // Small delay to ensure modal is mounted
    } else {
      slideAnim.setValue(0)
    }
  }, [visible, slideAnim])

  // Track keyboard height
  useEffect(() => {
    let isMounted = true
    
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        if (isMounted) {
          setKeyboardHeight((prevHeight) => {
            // Only update if height actually changed
            return prevHeight !== e.endCoordinates.height ? e.endCoordinates.height : prevHeight
          })
        }
      }
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        if (isMounted) {
          setKeyboardHeight((prevHeight) => {
            // Only update if height actually changed
            return prevHeight !== 0 ? 0 : prevHeight
          })
        }
      }
    )

    return () => {
      isMounted = false
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })
  
  // Adjust container position based on keyboard height - move up immediately when keyboard appears
  const containerBottomOffset = keyboardHeight > 0 ? keyboardHeight : 0

  const handleSelectEmoji = (emoji: string) => {
    onSelectEmoji(emoji)
    onClose()
  }

  // Filter emojis based on search query
  const filteredEmojis = useMemo(() => {
    let emojis: string[] = []
    
    if (!searchQuery.trim()) {
      // If no search, show selected category or all categories
      if (selectedCategory) {
        emojis = EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES] || []
      } else {
        // Show ALL emojis from all categories when no category is selected
        // Users can swipe through everything
        emojis = ALL_EMOJIS
      }
    } else {
      const query = searchQuery.toLowerCase().trim()
      emojis = ALL_EMOJIS.filter((emoji) => {
        const keywords = getEmojiKeywords(emoji)
        return keywords.some((keyword) => keyword.toLowerCase().includes(query))
      })
    }
    
    // Remove duplicates while preserving order
    return Array.from(new Set(emojis))
  }, [searchQuery, selectedCategory])

  // Group filtered emojis into pages
  // When keyboard is open: 5 per page (1 row x 5 columns)
  // When no keyboard: 20 per page (4 rows x 5 columns)
  const emojiPages = useMemo(() => {
    const pages: string[][] = []
    const emojisPerPage = keyboardHeight > 0 ? 5 : 20
    for (let i = 0; i < filteredEmojis.length; i += emojisPerPage) {
      pages.push(filteredEmojis.slice(i, i + emojisPerPage))
    }
    return pages.length > 0 ? pages : [[]]
  }, [filteredEmojis, keyboardHeight])

  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    setCurrentPage(0)
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false })
  }, [searchQuery, selectedCategory, keyboardHeight])

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const pageWidth = SCREEN_WIDTH
    const page = Math.round(offsetX / pageWidth)
    setCurrentPage(page)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
              marginBottom: containerBottomOffset,
            },
            // Immediately remove margin when keyboard closes to avoid lag
            keyboardHeight === 0 && { marginBottom: 0 },
          ]}
        >
          <View style={[
            styles.content, 
            { 
              backgroundColor: isDark ? themeColors.gray[900] : themeColors.white,
              paddingBottom: keyboardHeight > 0 ? spacing.xs : insets.bottom + spacing.md,
              maxHeight: keyboardHeight > 0
                ? undefined // Don't restrict height when keyboard is open - let it size naturally
                : Dimensions.get("window").height * 0.7,
            }
          ]}>
            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: themeColors.gray[700] }]} />
            
            {/* Popular emoji carousel - show immediately for quick access, positioned above keyboard */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.popularEmojiCarousel,
                { marginBottom: keyboardHeight > 0 ? spacing.sm : spacing.md }
              ]}
              contentContainerStyle={styles.popularEmojiCarouselContent}
            >
              {POPULAR_EMOJIS.map((emoji) => {
                const isSelected = currentReactions.includes(emoji)
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.popularEmojiButton,
                      isSelected && styles.popularEmojiButtonSelected,
                      isSelected && { backgroundColor: isDark ? themeColors.gray[800] : themeColors.gray[200] },
                      isSelected && { borderColor: themeColors.accent },
                    ]}
                    onPress={() => handleSelectEmoji(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.popularEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            {/* Search bar */}
            <View style={[styles.searchContainer, { backgroundColor: isDark ? themeColors.gray[800] : themeColors.gray[200] }]}>
              <FontAwesome name="search" size={16} color={isDark ? themeColors.gray[400] : themeColors.gray[600]} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: isDark ? themeColors.white : themeColors.gray[900], backgroundColor: isDark ? themeColors.gray[800] : themeColors.gray[200] }]}
                placeholder="Search emojis..."
                placeholderTextColor={isDark ? themeColors.gray[400] : themeColors.gray[500]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
                  <FontAwesome name="times-circle" size={18} color={isDark ? themeColors.gray[400] : themeColors.gray[600]} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category tabs (only show when not searching) */}
            {!searchQuery.trim() && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContainer}
              >
                {Object.keys(EMOJI_CATEGORIES).map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryTab,
                      { backgroundColor: selectedCategory === category ? themeColors.accent : (isDark ? themeColors.gray[800] : themeColors.gray[200]) },
                      selectedCategory === category && styles.categoryTabActive,
                    ]}
                    onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  >
                    <Text style={[
                      styles.categoryTabText,
                      { color: selectedCategory === category ? themeColors.white : (isDark ? themeColors.gray[300] : themeColors.gray[700]) }
                    ]}>
                      {category.split(" ")[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Scrollable emoji pages */}
            {emojiPages.length > 0 && emojiPages[0].length > 0 ? (
              <>
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  style={[
                    styles.scrollView,
                    {
                      height: keyboardHeight > 0 
                        ? (() => {
                            // Calculate height for 1 row
                            const buttonWidth = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 4) / 5
                            const buttonHeight = buttonWidth
                            return buttonHeight + spacing.sm * 2
                          })()
                        : (() => {
                            // Calculate height for 4 rows
                            const buttonWidth = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 4) / 5
                            const buttonHeight = buttonWidth
                            return (buttonHeight * 4) + (spacing.sm * 5) + spacing.sm * 2
                          })(),
                    }
                  ]}
                  contentContainerStyle={styles.scrollViewContent}
                  decelerationRate="fast"
                  snapToInterval={SCREEN_WIDTH}
                  snapToAlignment="start"
                  keyboardShouldPersistTaps="handled"
                >
                  {emojiPages.map((page, pageIndex) => {
                    // Calculate emoji button size
                    const buttonWidth = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 4) / 5
                    const buttonHeight = buttonWidth
                    const rowsToShow = keyboardHeight > 0 ? 1 : 4
                    // Calculate grid height: rows * buttonHeight + gaps between rows + padding
                    // Reduce padding when keyboard is open
                    const gridPadding = keyboardHeight > 0 ? spacing.xs : spacing.sm
                    const gridHeight = rowsToShow * buttonHeight + (rowsToShow > 1 ? (rowsToShow - 1) * spacing.sm : 0) + gridPadding * 2
                    
                    return (
                      <View key={pageIndex} style={styles.emojiPage}>
                        <View style={[
                          styles.emojiGrid, 
                          { 
                            height: gridHeight,
                            maxHeight: gridHeight,
                            minHeight: gridHeight, // Ensure minimum height so emojis are visible
                            paddingVertical: keyboardHeight > 0 ? spacing.xs : spacing.sm, // Reduce padding when keyboard is open
                          }
                        ]}>
                          {page.map((emoji, emojiIndex) => {
                            const isSelected = currentReactions.includes(emoji)
                            // Use combination of emoji and index for unique key
                            const uniqueKey = `${emoji}-${pageIndex}-${emojiIndex}`
                            return (
                              <TouchableOpacity
                                key={uniqueKey}
                                style={[
                                  styles.emojiButton,
                                  isSelected && styles.emojiButtonSelected,
                                  isSelected && { backgroundColor: isDark ? themeColors.gray[800] : themeColors.gray[200] },
                                  isSelected && { borderColor: themeColors.accent },
                                ]}
                                onPress={() => handleSelectEmoji(emoji)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.emoji}>{emoji}</Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      </View>
                    )
                  })}
                </ScrollView>
              </>
            ) : (
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: isDark ? themeColors.gray[400] : themeColors.gray[600] }]}>
                  No emojis found
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    width: "100%",
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 40,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  categoryScroll: {
    marginBottom: spacing.sm,
  },
  categoryContainer: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  categoryTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    marginRight: spacing.xs,
  },
  categoryTabActive: {
    // Background color is set inline based on theme
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scrollView: {
    width: SCREEN_WIDTH,
  },
  scrollViewContent: {
    flexDirection: "row",
  },
  emojiPage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: spacing.lg,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "flex-start",
    overflow: "hidden",
  },
  emojiButton: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 4) / 5,
    height: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 4) / 5,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  pageIndicators: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray[700],
  },
  pageIndicatorActive: {
    width: 20,
  },
  emojiButtonSelected: {
    borderWidth: 2,
    // borderColor is set inline based on theme
  },
  emoji: {
    fontSize: 32,
  },
  noResults: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 16,
  },
  popularEmojiCarousel: {
    maxHeight: 60,
  },
  popularEmojiCarouselContent: {
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
    alignItems: "center",
  },
  popularEmojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  popularEmojiButtonSelected: {
    borderWidth: 2,
  },
  popularEmoji: {
    fontSize: 28,
  },
})
