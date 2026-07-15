# PID Verification Guide

1. Confirm Toyota Prius C, 2013, US market, ECU and detected CAN protocol.
2. Capture raw timestamped request/response data with headers enabled. Redact VIN/device identifiers before sharing.
3. Record request header, request, expected responder, negative responses, response length and adapter setup.
4. Derive the formula only from an authorized source or controlled comparison. Do not copy proprietary app traffic or data without permission.
5. Compare across low/mid/high values with known-good diagnostic equipment; test signedness, byte order, missing frames and range rejection.
6. Add fixture request, raw response, expected value/unit, tolerance, profile, date and validation source.
7. Mark reads `TESTED_READ_ONLY`. Writes require read-before, acknowledgement, readback match, restore and failure tests before `TESTED_WRITE`.
8. Complete `docs/verified-commands.md` and have another reviewer reproduce the result.
