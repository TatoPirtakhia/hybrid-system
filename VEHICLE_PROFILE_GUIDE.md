# Vehicle Profile Guide

Standard, published OBD-II definitions are executable and cite their standard. Toyota-specific unknowns begin as `UnverifiedTelemetryIntent`: label, unit, cadence and verification instructions only.

To promote telemetry, create captured fixtures, document the ECU/header/request/response/length/formula/range and independent source, replace the intent with an executable definition, and assign `TESTED_READ_ONLY`. Never use a guessed request or formula. Built-in typed decoders are preferred; add reviewed decoder code instead of evaluating formula text.

To add a write, first create separate read-current and readback definitions. Add safety prerequisites and restore semantics, validate on the exact vehicle while stationary, then use `TESTED_WRITE`. `PRODUCTION_APPROVED` requires review of source, fixture, negative/failure cases and real-car results.

Run `pnpm validate:profiles` before every build.
