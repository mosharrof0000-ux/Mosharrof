# Android Agent Bridge

Connects explicit Mosharrof Web chat package commands to the Android Agent through a signed, expiring custom-scheme command. The Android app verifies HMAC-SHA256, expiry, and persistent nonce replay state before acting. Android's own installer/uninstaller confirmation remains mandatory.

## Pairing

1. In Android Agent, tap **Mosharrof Web-এর সঙ্গে যুক্ত করুন** and copy the pairing key.
2. In Mosharrof Web, send **Android যুক্ত করুন** and paste the key.
3. Use **install apk** to select an APK, **install App Name** to open Play Store search, or **uninstall com.example.package** for a package ID.
4. Use **disconnect android** to clear this browser's key. Rotate the key in Android to revoke other copies.

The shared key is encrypted at rest on Android using Android Keystore. On the web it is stored in this browser's localStorage, so do not pair on shared/untrusted browsers.

## Trust boundary

A command launch is not a successful operation. The Android Agent returns a callback signed with the paired key, and the web organ verifies the signature. The Android app reports success only when the package state is verified after the system confirmation screen returns.
