import { Audio } from "expo-av"

/**
 * The iOS audio session, in one place.
 *
 * This is global device state, not component state — whatever the last component
 * set is what every later recording and every later playback inherits. Leaving it
 * to individual screens produced two bugs that looked unrelated:
 *
 *  - VoiceRecorder set allowsRecordingIOS:true and never set it back. On iOS that
 *    is AVAudioSession category PlayAndRecord, which routes output to the EARPIECE
 *    rather than the speaker. So after recording one voice note, every video in
 *    the app played at earpiece volume — "I can't hear anyone any more", and it
 *    stayed that way for the rest of the session.
 *
 *  - AudioPlayer set allowsRecordingIOS:false, which is category Playback. Start
 *    the camera in that state and the recording can come back with no audio track
 *    at all — "they said they couldn't hear me".
 *
 * The simulator does not model earpiece routing or the recording category, which
 * is why both symptoms were invisible there and only ever showed up on device.
 *
 * Rule: call enterRecordingMode() before capturing, and ALWAYS return to
 * enterPlaybackMode() afterwards — including on failure and on unmount.
 */

/** Speaker output. The default state; everything should end here. */
export async function enterPlaybackMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    })
  } catch {
    // Audio routing is never worth crashing a screen over.
  }
}

/** Microphone available. Only for the duration of an actual capture. */
export async function enterRecordingMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    })
  } catch {
    /* as above */
  }
}
