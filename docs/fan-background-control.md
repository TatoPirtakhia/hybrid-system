# Fan session lifecycle — 0.1.4 (build 5)

This supersedes the foreground-only fan session described in fuel-fan-fix.md.

- Fan control belongs to the connection session. Leaving/unmounting the battery page does not stop it.
- AppState inactive/background no longer cancels the user's selected level.
- Selection does not depend on vehicle speed or available speed telemetry, as explicitly requested by the user. The same bounded 1–6 commands, confirmation and ECU readback remain.
- Auto cancels the renewal timer and any pending write. Disconnect or a failed command/readback also stops the session and reports the error; continued control is impossible without the adapter.
- No fan choice is persisted or restored after process termination. The existing car-side actuator expiry behavior still applies; this update adds no unverified release/off command.

## iOS Bluetooth background execution

Enable the existing BLE plugin's background mode and declare bluetooth-central in UIBackgroundModes. The BleManager uses a stable restoration identifier. A restored connection in a new process is cancelled, since that new process has no active fan session; an old manual command is never silently restarted.

Foreground fan renewal retains its 1.5-second delay after readback. Background BLE renewal instead immediately starts the next serialized request cycle after the native responses and readback complete. This avoids depending on React Native timers while suspended and does not introduce a second writer or concurrent fan cycles. Non-BLE simulator/Android/Wi-Fi transports retain the normal timer; the iOS background support in this change is specifically BLE.

This uses the BLE background mode, not unrelated audio/location modes or a claim of unlimited iOS execution. Bluetooth disconnection, iOS termination, or failure to deliver background events can interrupt control. Actual sustained foreground-to-other-app/locked-screen operation with this particular adapter needs verification on the car; automated tests do not substitute for that check.

Primary references:
- Apple Core Bluetooth background processing: https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html
- Library background implementation and timer caveats: https://github.com/dotintent/react-native-ble-plx/wiki/Background-mode-%28iOS%29
- Installed react-native-ble-plx plugin source and BleManager options were also checked locally.

## Validation

28 tests across 8 suites pass, including moving/missing speed, a fan session without a mounted screen, inactive/background/foreground transitions, explicit stop, and disconnect cancellation. The BLE lifecycle tests deliver asynchronous simulated notification responses and check actual emitted fan commands. The iOS build's background-mode declaration, icon retention and signing are checked before installation.
