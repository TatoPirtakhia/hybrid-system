# Battery update status

Implemented:
- Poll standard Mode 01 PID 5B only if advertised in the ECU support bitmap.
- Decode its reported percentage as `A * 100 / 255`; do not use it as a health or capacity measurement.
- Show reported charge, separately labeled HV and ECU-supply voltage fields, factory pack specifications, and explicit availability of cooling/block telemetry.
- Suppress disconnected, invalid and older-than-ten-second measurements on the battery screen.
- Reject truncated two-byte standard PID data and assemble ISO-TP before decoding it.
- Simulator support discovery now includes the 0x40 bitmap and PID 5B (60%).

Still unavailable on a real vehicle:
- HV pack voltage/current, individual battery-block voltages and temperatures: Toyota definitions remain unverified and non-executable.
- Actual remaining capacity in Ah/kWh: no validated measurement procedure is implemented.
- Manual cooling-fan control: no verified write/readback/restore sequence is available.

Before enabling Toyota reads, complete PID_VERIFICATION_GUIDE.md with a stationary 2013 US Prius C and known-good diagnostic comparison. Do not substitute Gen2/Gen3 formulas or infer individual-module charge percentages from voltage.

Factory source: Toyota Prius c Emergency Response Guide (20 modules, 7.2 V each, approximately 144 V nominal):
https://techinfo.toyota.com/techInfoPortal/staticcontent/en/techinfo/html/prelogin/docs/priusc.pdf

Validation on 2026-10-16:
- Workspace typecheck: passed.
- Jest: 4 suites / 14 tests passed.
- Profile validator: passed.
- Expo iOS export: passed (1615 modules, Hermes bundle in apps/mobile/dist-export-ios).
- Native iOS Release build: passed. Apple Development identity and a provisioning profile for the connected iPhone were created using the configured Personal Team. CocoaPods 1.16.2 was installed in a task-local gem cache.
- Updated app.priuscompanion.mobile 0.1.0 (build 1) successfully installed on the connected iPhone. After developer trust was completed, launch succeeded and the new app process was observed running on the phone.

Factory capacity: Toyota 2013 Prius c Owner’s Manual, p. 495, specifies 6.5 Ah (3HR), 20 modules and 144 V. The screen labels 0.94 kWh as nominal energy calculated from 144 V × 6.5 Ah, not measured remaining capacity. Manufacturer manual mirror: https://manuals.plus/m/25ec108c3c22fd3534104254af876eeae59e173cd6162ac2e49e9b74ffc037e9

## Local build and installation artifacts

- Signed app: `dist/ios/Payload/PriusCompanion.app`
- IPA: `dist/ios/PriusCompanion.ipa`
- Verification: `dist/ios/verification.json`
- `codesign --verify --deep --strict`: passed. Profile includes the connected phone; bundle contains the updated capacity label and matches the workspace battery screen source.
- Build staging: `/tmp/prius-companion-build` (avoids the apostrophe in the original workspace path). Build log and tooling: `/tmp/prius-build-tools`.
- This local staging build uses the existing icon as legacy PNG resources and a system launch-screen dictionary because the host's AssetCatalogSimulatorAgent stalled. Development-only asset catalogs were excluded in the staged native projects. Shell phases use Bash in the staged projects. These native build workarounds are not changes to the checked-in app screens.
- Vehicle battery data and fan control have not been verified on a real vehicle.
