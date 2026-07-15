import type { CommandPriority, VerificationStatus } from '@prius/shared';

export interface DecodeDefinition {
  kind: 'BUILT_IN';
  decoder: 'A' | 'AB_DIV_4' | 'A_MINUS_40' | 'AB_DIV_100' | 'AB_TIMES_005' | 'BITMAP';
}

interface TelemetryBase {
  id: string;
  label: string;
  unit: string;
  pollingIntervalMs: number;
  priority: CommandPriority;
  validRange?: { min: number; max: number };
}

export interface ExecutableTelemetryDefinition extends TelemetryBase {
  executable: true;
  ecuId: string;
  service: number;
  pid: number;
  request: string;
  decode: DecodeDefinition;
  verificationStatus: Exclude<VerificationStatus, 'UNVERIFIED'>;
  sourceReference: string;
}

export interface UnverifiedTelemetryIntent extends TelemetryBase {
  executable: false;
  verificationStatus: 'UNVERIFIED';
  verificationNeeded: string;
}

export type TelemetryDefinition = ExecutableTelemetryDefinition | UnverifiedTelemetryIntent;

export interface VehicleActionDefinition {
  id: string;
  label: string;
  request: string | null;
  requiresStationaryVehicle: boolean;
  allowedGearPositions?: Array<'P' | 'N'>;
  requiresConfirmation: boolean;
  requiresLongPress: boolean;
  verificationStatus: VerificationStatus;
  verifyAfterWriteCommandId?: string;
  restoreActionId?: string;
}

export interface VehicleProfile {
  id: string;
  manufacturer: 'TOYOTA';
  model: 'PRIUS_C';
  market: 'US';
  modelYears: { from: number; to: number };
  protocolCandidates: string[];
  ecuDefinitions: Array<{ id: string; label: string }>;
  telemetryDefinitions: TelemetryDefinition[];
  actionDefinitions: VehicleActionDefinition[];
}
