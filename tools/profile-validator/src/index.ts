import { priusCUs2013Profile } from '@prius/vehicle-profiles';
import { isWriteApproved } from '@prius/shared';
const errors: string[] = [];
for (const definition of priusCUs2013Profile.telemetryDefinitions) {
  if (definition.executable && (!/^[0-9A-F]+$/.test(definition.request) || definition.request.length % 2)) errors.push(`${definition.id}: invalid request`);
}
for (const action of priusCUs2013Profile.actionDefinitions) {
  if (!isWriteApproved(action.verificationStatus) && action.request !== null) errors.push(`${action.id}: unapproved action must not contain a request`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log(`Profile valid: ${priusCUs2013Profile.id} (${priusCUs2013Profile.telemetryDefinitions.length} telemetry entries; no unapproved executable writes)`);
