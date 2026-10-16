# iOS 0.1.1 (2)

Installed on the connected iPhone and successfully launched. The signed IPA is in dist/ios/PriusCompanion-0.1.1.ipa.

- iOS grouped light appearance, system font, blue navigation and controls.
- Fixed-size two-column metric rows, tabular digits and fixed text slots prevent telemetry changes from resizing cards. Browser rendering of the actual React Native components kept all six metric rectangles identical for values 9, 100 and 16383. This is layout QA, not a real-car telemetry test.
- Standard supported-PID discovery gates 011F (ECU engine runtime) and 012F (fuel level). Litres are estimated using the stock 36 L tank. Engine runtime is the ECU value, not a claim about hybrid READY duration.
- Session distance begins when speed telemetry is available. RPM classifies distance as engine turning, engine stopped, or unknown. Engine-stopped movement is an EV estimate; combined engine/motor contribution is not measured. Distance before app connection cannot be recovered.
- Distance classes persist in trip history. Database migration passed on the phone and nine existing trip records are present; historical unclassified distance remains unknown.
- 20 tests, mobile typecheck, profile validation, SQLite migration/upsert checks and code-sign verification passed.

Manual fan control remains unavailable: there is no verified Prius C write/readback/restore sequence in this repository. No Gen3 actuator command has been enabled as a Prius C command.

Source/staging workarounds and prior battery limitations remain documented in battery-update-status.md.
