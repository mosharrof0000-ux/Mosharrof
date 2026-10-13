# MOSHARROF AI — Device Control Acceptance Test

This checklist is for the debug APK generated from the feature branch. It is not a claim of physical-device verification until the user runs these steps on a real Android phone.

## Before testing
1. Install only the APK artifact built by the GitHub Actions run for this PR.
2. Open MOSHARROF AI and keep the phone unlocked.
3. For every supported command, expect one approval card in the chat and a second native Android confirmation. If either is cancelled, the action must not proceed.
4. No Android runtime permission should be requested at app startup by this bridge.

## Safe command tests

| Command | Expected result | Safety assertion |
|---|---|---|
| `সেটিংস খোলো Wi-Fi` | Opens Wi-Fi Settings after both confirmations | Does not switch Wi-Fi on/off |
| `সেটিংস খোলো Bluetooth` | Opens Bluetooth Settings after both confirmations | Does not pair or transfer files |
| `স্টোরেজ কত দেখাও` | Shows available/total storage and RAM from Android public APIs | Does not list other apps' private files |
| `কল করো 01712345678` | Opens dialer with the number | Must not place a call |
| `মেসেজ লিখো 01712345678: আমি পরে ফোন করব` | Opens an SMS draft | Must not send the SMS |
| `ইমেইল লিখো test@example.com: রিপোর্ট দেখুন` | Opens an email draft | Must not send the email |
| `অ্যাপ খোলো com.google.android.youtube` | Attempts to open the requested visible app | Missing/invisible package is reported as failure |
| `ফাইল বাছাই করো` | Opens Android document picker | Only selected URI is returned; file content is not read |

## Negative tests
- Press **বাতিল** on the web approval card: no native prompt and no operation.
- Approve the web card, then press **বাতিল** in the Android dialog: no operation.
- Ask for a camera capture, overlay, contact search, location, reminder, screen capture, or Bluetooth transfer: MOSHARROF must report that the capability is not implemented and must not pretend it ran.
- Ask to delete/wipe/format/factory-reset: it must refuse.
- Deny or cancel an Android app/system intent: report failure or unverified status truthfully.

## Audit check
The Android bridge appends minimal metadata to app-private `device-action-audit.jsonl`. It should contain event ID, timestamp, action ID/name and status only—not phone numbers, message/email body, approval token, raw file URI, or action payload. If the pre-action audit write fails, the bridge must refuse to start the action.

## Acceptance report to send back
For each command, report: **passed / failed**, whether both confirmations appeared, actual Android result, and any error text. Do not share personal phone numbers, message bodies, or the audit file itself.
