# Prius Companion

Offline-first React Native companion for a 2013 US-market Toyota Prius C and ELM327-compatible adapters. This repository implements Milestones 1–3: project foundation, connection architecture, simulator, standard OBD-II polling, dashboard foundations, fuel/trip calculations, SQLite schema, and standard DTC parsing. Toyota-specific telemetry and writes are modeled but disabled until verified.

## Safety boundary

- No Toyota-specific PID, header, formula, response, or write command has been invented.
- Unverified telemetry definitions are non-executable TypeScript variants with no request field.
- Unverified actions have `request: null`; the validator rejects otherwise.
- There is no production raw CAN terminal and no remote/backend control.
- Simulator and standard OBD-II reads work independently of Toyota command validation.

## Requirements

- Node.js 24+
- pnpm 11.10.0
- Android Studio/JDK 17 for local Android builds
- Expo/EAS account for cloud builds
- Apple Developer membership for device and App Store iOS builds

Expo Go is not supported. Native BLE, TCP, SQLite and Android Classic SPP require a development build.

## Run

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm validate:profiles
pnpm --filter @prius/mobile prebuild
pnpm --filter @prius/mobile start
```

Open the generated development build and choose Simulator. The simulator implements fragmented ELM responses and standard PIDs for speed, RPM, coolant, MAF, module voltage, fuel rate, supported-PID discovery and DTC scenarios.

## Android local and EAS builds

Install Android Studio, accept SDK licenses, create an emulator or enable USB debugging, then:

```sh
pnpm --filter @prius/mobile prebuild
pnpm --filter @prius/mobile android
```

For signed cloud artifacts, install EAS CLI, run `eas login`, replace the placeholder EAS project ID (or run `eas init`), then from `apps/mobile`:

```sh
eas build --platform android --profile development
eas build --platform android --profile preview
eas build --platform android --profile production
```

Development and preview produce internally distributed builds; preview is configured as an APK for direct installation. Download it on the Android device, allow installation from that source, and open the APK. Production produces an AAB for Play Console. Create the Play app with package `app.priuscompanion.mobile`, complete store/privacy declarations, upload the AAB to an internal test track, and promote only after vehicle acceptance testing.

## iPhone registration and builds from Windows

1. Join the Apple Developer Program and create an App ID for `app.priuscompanion.mobile` in Certificates, Identifiers & Profiles.
2. Install EAS CLI on Windows, run `eas login`, then `eas device:create`. Open the displayed registration URL on the iPhone and install the temporary profile so its UDID is registered.
3. From `apps/mobile`, run `eas build --platform ios --profile development` or `--profile preview`. Allow EAS to manage distribution certificates and the ad hoc provisioning profile.
4. Open the EAS install URL on the registered iPhone. Only devices included in the profile can install an ad hoc build.
5. For App Store Connect, create the app record using the same bundle identifier, then run `eas build --platform ios --profile production`. Submit with `eas submit --platform ios` or upload the resulting archive through the supported Apple workflow.

An iOS build cannot use generic Bluetooth Classic SPP. Use BLE or local Wi-Fi unless the adapter participates in an Apple-supported accessory program.

## Repository map

- `apps/mobile`: Expo Router UI, native transports, stores and SQLite
- `packages/obd-core`: transport contract, priority scheduler, ISO-TP assembly
- `packages/elm327`: prompt parser, handshake/state machine, simulator
- `packages/vehicle-profiles`: standard PIDs and non-executable Prius C intents
- `packages/telemetry`: fuel, trip, DTC and write-safety logic
- `tools/profile-validator`: production profile invariant checks
- `tools/log-replayer`: exported response replay
- `fixtures`: standard fixtures and Toyota capture placeholder

See [ARCHITECTURE.md](ARCHITECTURE.md), [SAFETY.md](SAFETY.md), and [TESTING_ON_REAL_CAR.md](TESTING_ON_REAL_CAR.md).

## Current milestone boundary

BLE probing, configurable Wi-Fi transport and Android Classic native I/O are implemented at code level. The current setup screen exposes Simulator first; production UX for BLE scanning/manual GATT configuration, Wi-Fi forms, permission education, adapter persistence, and full reconnect orchestration remain subsequent product work. Automatic trip recording, ten-second sample batching, trip history, stored-DTC scans and diagnostic persistence are wired for the active adapter. No release should be represented as meeting all Milestones 4–8.
