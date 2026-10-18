# Standalone Android Control App and MOSHARROF Integration

## Direct answer

Yes: the target is a separately installable native Android app, with a versioned plugin boundary so MOSHARROF AI can integrate later. The native Android project already lives in `android-agent/` and has its own Android application ID, Gradle project and launcher activity. It is separate from the web/PWA runtime.

**Current repository limitation:** this project is currently a dedicated module/feature branch inside the MOSHARROF repository, not a separately provisioned GitHub repository. Do not describe a new repository as created. The GitHub integration available for this task can commit files and create branches/PRs but does not expose repository creation.

## Installing a test build

The Android Agent CI workflow runs these steps against the PR head:

1. Build `assembleDebug`.
2. Run JVM unit tests.
3. Run Android emulator instrumentation tests.
4. Only if all prior steps succeed, upload `mosharrof-android-agent-debug` as a seven-day workflow artifact.

The debug APK is a test build, not a release-signed production APK. Do not distribute it as a stable release until CI is green and physical-device acceptance is complete. To install a successful artifact, download it from the successful Android Agent CI run, extract the APK, transfer it to the Android device, and install it with Android's package installer. Android may require the user to permit installation from the chosen source. The user must explicitly grant each special permission inside Android Settings.

## Integration boundary status

Implemented on the current feature branch:
- Typed Kotlin command/capability contract.
- Local command-shape validation.
- Per-request local approval with expiry.
- Rejection of common English and Bengali externally visible/destructive action labels.
- Unit tests for invalid parameters, mismatched/expired approvals and risky labels.

Not implemented by this bridge yet:
- Authenticated phone pairing or a remote transport.
- A MOSHARROF chat UI/plugin registration.
- Replay prevention, server-side authorization, transport rate limits and request expiry across the network.
- A complete result/status callback from the live executor.
- Universal control of every third-party app.

The app is intentionally limited to Android device control: voice commands, approved UI/navigation actions, and local battery/charging diagnostics. Photo/video capture, media browsing/editing/generation, camera/media permissions, screenshot preview/AI image analysis and file-management tools are out of scope. The existing Android agent has an initial user-directed local automation MVP. It must not be described as full unrestricted control of every app or device function. Android permissions, app-specific UI, OS/OEM restrictions and user confirmation still apply.

## Intended integration phases

1. Keep the native app independently buildable and testable.
2. Pass Android build, unit, emulator and physical-device checks.
3. Implement explicit secure pairing and authenticated, expiring request/response transport.
4. Add a MOSHARROF plugin adapter that sends only typed commands to the Android app.
5. Keep the final permission and confirmation gate on the device.
6. Verify supported workflows end-to-end (app launch, screen inspection, navigation, approved bounded UI actions, cancellation and result reporting).
7. Provision a dedicated repository when repository-creation access is available, then move the standalone Android project without changing MOSHARROF Live Pages.
8. Publish a release-signed APK only after review and install/upgrade validation.

The Live web/PWA must not gain device-control authority merely by embedding a web button. Device control is performed by the separately installed Android app and only after explicit owner permissions and approvals.
