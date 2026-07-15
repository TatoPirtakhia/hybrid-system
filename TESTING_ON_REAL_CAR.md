# Testing on a Real Car

Use only a stationary 2013 US Prius C in a ventilated, safe area. Chock wheels as appropriate, keep the parking brake applied, and have a qualified operator ready to power the vehicle off.

Order: connect adapter; inspect adapter identity/capabilities/voltage; detect protocol; ask consent before reading/storing VIN; discover standard PIDs; compare speed/RPM/coolant/MAF/voltage/fuel-rate with known-good equipment; test reconnection and corrupt/slow responses; capture Toyota reads; compare every decoded Toyota value independently.

Do not test fan writes, customizations or maintenance mode from this Milestone 1–3 repository: commands are absent and disabled. When independently verified later, test one action at a time: read current value, request only a safer/higher fan level, verify readback, restore OEM AUTO, verify restore, restart vehicle and confirm normal state. Maintenance testing requires a separate checklist, five-second hold, speed zero, P gear, available state data and immediate restart afterward.

Record app commit, profile version, adapter/firmware, ambient conditions, raw redacted log, expected/actual values, result and tester/date.
