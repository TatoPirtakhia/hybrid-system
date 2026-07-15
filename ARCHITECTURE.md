# Architecture

## Data flow

`ObdTransport → PromptAssembler → Elm327Client → CommandScheduler → response validation/decoder → telemetry store → UI + batched SQLite writer`

All transports expose scanning, connection, byte writes, byte subscriptions and status. The ELM client owns initialization and enforces a single pending prompt-delimited command. The scheduler adds priority, timeout, retry, cancellation and overload feedback. UI polling doubles its interval under queue pressure.

High-frequency samples enter one Zustand batch rather than individual component state. Trip calculation is elapsed-time based and caps gaps at ten seconds to prevent reconnection gaps from inflating totals. SQLite uses WAL and separates trip metadata from batched samples.

## Trust boundary

Vehicle profiles use a discriminated union. An `executable: false` Toyota intent has no ECU, service, PID, request or decoder fields. It therefore cannot accidentally enter polling. Write actions are separately allow-listed: only `TESTED_WRITE` and `PRODUCTION_APPROVED` may execute, and identity/safety state must also pass.

Formula strings are not evaluated. Standard formulas map to reviewed built-in decoder names.

## Recovery design

On loss: stop polling, mark values stale, cancel pending commands, close transport, back off (1/2/5/10/30 seconds), reconnect, rerun initialization and supported-PID discovery, then resume reads. Writes and maintenance/manual modes never resume automatically. Full backoff orchestration and UI confirmation are scheduled after Milestone 3.

## Platform boundary

- BLE: `react-native-ble-plx`, dynamic service/characteristic discovery and optional explicit UUIDs.
- Wi-Fi: configurable TCP socket (defaults are constructor defaults, not fixed requirements).
- Android Classic: local Expo module using RFCOMM SPP and version-gated permission enforcement.
- iOS: BLE and Wi-Fi only unless an Apple-supported accessory protocol is available.
