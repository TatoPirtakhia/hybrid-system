import { Elm327Client, parseElmResponse } from '@prius/elm327';
import { assembleIsoTp } from '@prius/obd-core';

// Prius c/NHP10 sources and validation limits: docs/fuel-fan-fix.md.
const payload = (raw: string, command: string, header: string, service: number, pid: number): Uint8Array => {
  const message = assembleIsoTp(parseElmResponse(raw, command).dataLines).find((item) => item.header === header && item.payload[0] === service && item.payload[1] === pid);
  if (!message) throw new Error(`ECU ${header}: ${parseElmResponse(raw, command).statuses.join(', ') || 'No matching response'}`);
  return message.payload.slice(2);
};
export const decodeToyotaFuel = (raw: string): number => {
  const bytes = payload(raw, '2129', '7C8', 0x61, 0x29);
  if (bytes.length < 1 || bytes[0]! > 100) throw new Error('Invalid fuel level');
  return bytes[0]! / 2;
};
export const decodeFanLevel = (raw: string): number => {
  const bytes = payload(raw, '219B', '7EA', 0x61, 0x9b);
  if (bytes.length < 4 || bytes[1]! > 6) throw new Error('Invalid battery fan response');
  return bytes[1]!;
};
export class PriusCControls {
  constructor(private readonly elm: Elm327Client, private readonly log: (command: string, raw: string) => void = () => {}) {}
  private async request(command: string, header: string, write = false, signal?: AbortSignal): Promise<string> {
    const response = await this.elm.scheduler.enqueue({ id: `prius-c-${command}`, command, header, write, ...(signal ? { signal } : {}), priority: write ? 'CRITICAL_WRITE' : 'SAFETY_READ', timeoutMs: 10000 });
    this.log(`${header}:${command}`, response.raw);
    return response.raw;
  }
  async readFuelLitres(): Promise<number> { return decodeToyotaFuel(await this.request('2129', '7C0')); }
  async readFanLevel(): Promise<number> { return decodeFanLevel(await this.request('219B', '7E2')); }
  async setFanLevel(level: number, stillRequested: () => boolean = () => true, signal?: AbortSignal): Promise<number> {
    if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('Fan level must be 1–6');
    await this.readFanLevel(); // Fail closed if this battery ECU cannot be read.
    if (!stillRequested()) throw new Error('Fan command cancelled');
    const command = `3081000${level}`;
    const raw = await this.request(command, '7E2', true, signal);
    const response = parseElmResponse(raw, command);
    // Some adapters return NO DATA for this actuator request; readback is mandatory.
    if (response.statuses.some((status) => status !== 'NO DATA' && status !== 'OK')) throw new Error('Fan command rejected');
    const messages = assembleIsoTp(response.dataLines);
    if (messages.some((message) => message.payload[0] === 0x7f)) throw new Error('Battery ECU rejected fan command');
    const actual = await this.readFanLevel();
    if (actual !== level) throw new Error(`Fan readback mismatch (${actual} ≠ ${level})`);
    return actual;
  }
}
