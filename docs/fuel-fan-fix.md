# Fuel / fan fix — 0.1.2 (build 3)

Fan lifecycle update: see [fan-background-control.md](fan-background-control.md) for 0.1.4; page exit/background no longer stop the session and speed is no longer a prerequisite.

Scope: fuel-level acquisition and Prius c battery-fan control only. Existing card sizes, colors, trip logic and other battery PIDs are unchanged.

## Fuel

The old connection code only scheduled 012F if advertised in the supported-PID bitmap. The new dedicated poll probes 012F regardless of that bitmap, then falls back to the Prius c combination meter: ATSH7C0 / 2129; accept only 7C8 / 6129; A/2 litres. It restores ATSH7DF before any other queued request. Dashboard shows estimated litres and percent of the nominal 36-litre tank. Empty fuel is valid; missing, negative, wrong-ECU and out-of-range responses are not treated as zero. Failed subsequent readings mark the displayed value stale.

Sources (read 2026-10-16):
- Prius c owner's actual OBD project and accompanying PID sheet: https://github.com/aomanchuria/SeniorPrius/blob/main/PRIUS_C_Metric.ods (Fuel Input: 2129, A/2, 7C0).
- Firsthand Prius c discussion: https://priuschat.com/threads/prius-c-panel-displays-to-odb-event-mapping.126929/page-2

## Fan

The old UI had no fan action. The new battery section offers levels 1–6 with confirmation. Only the published NHP10 commands 30810001 through 30810006 on 7E2 are allowed. It reads 219B from 7EA before the write and requires its second data byte to equal the selected level afterwards. Negative ECU replies and missing/mismatched readback stop the session and show failure. This confirms the ECU requested mode, not fan RPM or physical airflow. The initial selection requires fresh zero speed. Commands are repeated while the foreground battery screen is active; pending writes are aborted on stop. Header/request/7DF-restore are one queued operation, preventing telemetry interleaving. Adapter timeouts require reconnection rather than attributing a late reply to a new command.

Sources:
- Prius c owner's NHP10 fan command file: https://attachments.priuschat.com/attachment-files/2024/06/252271_Fan-Control-NHP10.txt
- Source discussion: https://priuschat.com/threads/hybrid-battery-cooling-fan-set-to-max-speed.238431/
- Prius c 219B readback byte layout and real response in SeniorPrius PRIUS_C_Metric.ods above.

Auto stops repeating manual requests. There is no sourced independent NHP10 release command in the above file. A report of ScanGauge behavior says selecting a different gauge returns fan control to normal: https://priuschat.com/threads/scanguage-command-to-turn-on-hv-battery-cooling-fan.111231/ . This is not proof of a Prius c release timeout. The UI does not claim that an automatic-control transition has been independently confirmed, and advises a vehicle power cycle if the manual setting remains. No level-zero/off command is sent. Simulator lease expiry is a test fixture, not measured car behavior.

## Validation

Automated checks cover Toyota fuel fallback without an advertised 012F, empty/range/malformed/wrong ECU fuel replies, fan response decoding and cancellation, unsupported writes/mismatched readback, atomic header routing with concurrent RPM and subsequent fuel queries. Full workspace typecheck and profile validation are run. No physical ECU trace or actual airflow test is available on this Mac; first real-car verification is still required. The vehicle profile's UNVERIFIED actions are retained rather than falsely marked physically tested.
