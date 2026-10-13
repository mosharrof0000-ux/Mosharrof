# MOSHARROF Voice Companion Setup (Android)

## What this change adds

- A narrow cyan/violet edge tab on the website; tap to reveal the voice control, then use the microphone. The dock tucks back to the screen edge after handoff.
- An optional Android floating launcher. It begins as a narrow edge tab; tap once to reveal the MOSHARROF orb, then tap the orb to open the app and request the existing voice input. The native tab returns to the edge before handoff.
- An Android Quick Settings tile that opens MOSHARROF and requests the same voice-input handoff.
- The existing chat and voice-input implementation remains the voice engine; this feature is a launcher, not a new speech recognizer.

## Enable the Android floating launcher

1. Install the MOSHARROF debug APK from the successful **Build MOSHARROF Android APK** GitHub Actions run artifact.
2. Open MOSHARROF, open the right-side **Android ডিভাইস নিয়ন্ত্রণ** menu, and tap **ভাসমান ভয়েস বাটন চালু**.
3. Android may first open the “Display over other apps” permission page. Explicitly allow MOSHARROF there.
4. Return to MOSHARROF and tap **ভাসমান ভয়েস বাটন চালু** again.
5. Confirm a narrow tab is visible at the screen edge. Tap once to reveal the orb; tap the orb to open voice input. Use **ভাসমান বাটন বন্ধ** in the same menu to stop it completely.

## Add Quick Settings

1. Swipe down twice from the top of Android.
2. Tap Edit / the pencil icon.
3. Find **MOSHARROF AI** and drag it into the active tiles.
4. Tap the tile to open MOSHARROF and request voice input.

Android manufacturers label these steps differently. If the tile is not listed, check whether the installed APK has been updated and restart the app.

## Safety and limits

- Overlay permission is opt-in; the app does not read screen contents, use Accessibility Services, or bypass Android security controls.
- Android may require notification permission or background-service allowances. Battery optimizers can stop persistent services on some OEMs.
- Voice handoff depends on the existing composer microphone, microphone permission, network availability for server-side transcription, and the app's current state. The launcher itself does not prove that transcription or Gemini/TTS succeeded.
- Website edge dock works in the browser. A cross-app overlay and Quick Settings tile require the Android APK; a normal website cannot draw over other apps or add system tiles.
- The APK workflow and contract tests verify compilation and wiring, not OEM behavior. Before production rollout, install on a real phone and verify enable/disable, lock/unlock, app switching, microphone permission prompts, Quick Settings, and battery-optimization behavior.
