import type { UnverifiedTelemetryIntent, VehicleProfile } from '../../../types';
import { standardPids } from '../../../standard/pids';

const unverified = (id: string, label: string, unit: string, pollingIntervalMs: number): UnverifiedTelemetryIntent => ({
  id, label, unit, pollingIntervalMs, priority: 'SLOW_TELEMETRY', executable: false,
  verificationStatus: 'UNVERIFIED', verificationNeeded: 'Capture and independently validate request, ECU/header, response length, formula, range and source on a stationary 2013 US Prius C.',
});

const toyotaIntents: UnverifiedTelemetryIntent[] = [
  unverified('hvBatterySoc', 'HV battery state of charge', '%', 750),
  unverified('hvBatteryVoltage', 'HV battery voltage', 'V', 500),
  unverified('hvBatteryCurrent', 'HV battery current', 'A', 300),
  unverified('hvBatteryTemperatureMax', 'Maximum battery temperature', '°C', 1500),
  unverified('hvBatteryBlockVoltages', 'Battery block voltages', 'V', 2000),
  unverified('batteryFanRequestedLevel', 'Battery fan requested level', 'level', 1000),
  unverified('mg1Rpm', 'MG1 speed', 'rpm', 500),
  unverified('mg2Rpm', 'MG2 speed', 'rpm', 500),
];

export const priusCUs2013Profile: VehicleProfile = {
  id: 'toyota-prius-c-us-2013-v1', manufacturer: 'TOYOTA', model: 'PRIUS_C', market: 'US',
  modelYears: { from: 2013, to: 2013 },
  protocolCandidates: ['ISO_15765_4_CAN_11BIT_500K'],
  ecuDefinitions: [{ id: 'powertrain', label: 'Powertrain ECU' }, { id: 'hybrid-control', label: 'Hybrid control ECU' }, { id: 'battery', label: 'Battery ECU' }],
  telemetryDefinitions: [...standardPids, ...toyotaIntents],
  actionDefinitions: [
    { id: 'batteryFanManual', label: 'Battery fan manual level', request: null, requiresStationaryVehicle: false, requiresConfirmation: true, requiresLongPress: false, verificationStatus: 'UNVERIFIED' },
    { id: 'batteryFanOemAuto', label: 'Restore OEM automatic fan control', request: null, requiresStationaryVehicle: false, requiresConfirmation: true, requiresLongPress: false, verificationStatus: 'UNVERIFIED' },
    { id: 'diagnosticMaintenanceMode', label: 'Diagnostic Maintenance Mode', request: null, requiresStationaryVehicle: true, allowedGearPositions: ['P'], requiresConfirmation: true, requiresLongPress: true, verificationStatus: 'UNVERIFIED' },
  ],
};
