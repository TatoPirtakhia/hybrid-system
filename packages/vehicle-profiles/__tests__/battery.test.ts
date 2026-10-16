import { decodeStandardPid, standardPids, priusCUs2013Profile } from '../src';
import { SimulatorTransport, Elm327Client, parseElmResponse } from '@prius/elm327';
import { assembleIsoTp } from '@prius/obd-core';

const soc = standardPids.find((p) => p.id === 'hvBatterySoc')!;
test('standard battery percentage decodes endpoints and intermediate value', () => {
  expect(decodeStandardPid(soc, Uint8Array.of(0))).toBe(0);
  expect(decodeStandardPid(soc, Uint8Array.of(153))).toBe(60);
  expect(decodeStandardPid(soc, Uint8Array.of(255))).toBe(100);
  expect(() => decodeStandardPid(soc, new Uint8Array())).toThrow();
});
test('truncated voltage never becomes a plausible measurement', () => {
  const voltage = standardPids.find((p) => p.id === 'moduleVoltage')!;
  expect(() => decodeStandardPid(voltage, Uint8Array.of(54))).toThrow('Incomplete');
});
test('profile has unique telemetry IDs and no unverified fan write', () => {
  const ids = priusCUs2013Profile.telemetryDefinitions.map((p) => p.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(priusCUs2013Profile.actionDefinitions.filter((a) => a.id.startsWith('batteryFan')).every((a) => a.request === null)).toBe(true);
});
test('simulator advertises and returns battery percentage', async () => {
  const client = new Elm327Client(new SimulatorTransport());
  try {
    await client.connect((await client.scan())[0]!);
    const read = async (command: string) => {
      const result = await client.scheduler.enqueue({ id: command, command, priority: 'NORMAL_TELEMETRY', timeoutMs: 2000 });
      return assembleIsoTp(parseElmResponse(result.raw, command).dataLines)[0]!.payload;
    };
    expect([...await read('0140')]).toEqual([0x41, 0x40, 0x40, 0, 0, 0x24]);
    expect(decodeStandardPid(soc, (await read('015B')).slice(2))).toBe(60);
  } finally { await client.disconnect(); }
});
test('engine uptime uses two bytes and fuel level is a bounded percentage', () => {
  const uptime = standardPids.find((p) => p.id === 'engineRunTime')!;
  const fuel = standardPids.find((p) => p.id === 'fuelLevel')!;
  expect(decodeStandardPid(uptime, Uint8Array.of(0x0e, 0x10))).toBe(3600);
  expect(() => decodeStandardPid(uptime, Uint8Array.of(1))).toThrow('Incomplete');
  expect(decodeStandardPid(fuel, Uint8Array.of(0))).toBe(0);
  expect(decodeStandardPid(fuel, Uint8Array.of(255))).toBe(100);
});
