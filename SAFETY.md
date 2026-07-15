# Safety

OEM automatic battery-fan control is the only default. Manual, smart, maximum cooling, customizations and Diagnostic Maintenance Mode are unavailable because this repository contains no verified Prius C write command.

Any future write must be profile-matched, allow-listed, write-verified, explicitly confirmed, logged, serialized through the one command queue, read before change, and read back after change. Stationary/gear prerequisites must fail closed when data is absent. An emergency stop cancels pending writes. Fan sessions must attempt OEM-auto restore on normal exit and clearly report a failed restore; process termination cannot be assumed to restore an ECU.

Never add commands affecting airbags, pretensioners, ABS, brake or steering calibration, immobilizer/keys, firmware, odometer, or emissions programming. Do not expose arbitrary CAN writes in production.

Users must configure and diagnose while parked. Dashboard information is advisory, can be delayed or wrong because of adapter/vehicle faults, and is not a replacement for qualified service.
