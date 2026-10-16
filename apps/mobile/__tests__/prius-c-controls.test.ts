import { Elm327Client, SimulatorTransport } from '@prius/elm327';
import { decodeFanLevel, decodeToyotaFuel, PriusCControls } from '../src/prius-c-controls';

describe('Prius c fuel and battery fan', () => {
  it('decodes the combination meter fuel in litres, including an empty tank', () => {
    expect(decodeToyotaFuel('7C8 03 61 29 2B\r>')).toBe(21.5);
    expect(decodeToyotaFuel('7C8 03 61 29 00\r>')).toBe(0);
    expect(() => decodeToyotaFuel('7C8 02 61 29\r>')).toThrow();
    expect(() => decodeToyotaFuel('7C8 03 61 29 FF\r>')).toThrow();
    expect(() => decodeToyotaFuel('7E8 03 61 29 2B\r>')).toThrow();
  });
  it('reads the second data byte of 219B, rejects incomplete, wrong-ECU and negative responses', () => {
    expect(decodeFanLevel('7EA 06 61 9B 01 06 00 D9\r>')).toBe(6);
    for (const raw of ['7EA 03 7F 21 12\r>', '7EA 03 61 9B 01\r>', '7E8 06 61 9B 01 06 00 D9\r>', 'NO DATA\r>']) expect(() => decodeFanLevel(raw)).toThrow();
  });
  it('serializes header selection/request/restore against concurrent RPM polling and verifies fan readback', async () => {
    const transport = new SimulatorTransport();
    const commands: string[] = [];
    const elm = new Elm327Client(transport, { initializationSequence: [], onRawLog: (direction, value) => { if (direction === 'OUT') commands.push(value.trim()); } });
    await elm.connect({ id: 'simulator', name: 'Simulator' });
    commands.length = 0;
    const vehicle = new PriusCControls(elm);
    const [litres] = await Promise.all([
      vehicle.readFuelLitres(),
      elm.scheduler.enqueue({ id: 'rpm', command: '010C', priority: 'FAST_TELEMETRY', timeoutMs: 2000 }),
    ]);
    expect(litres).toBe(21.5);
    expect(commands.slice(0, 4)).toEqual(['ATSH7C0', '2129', 'ATSH7DF', '010C']);
    expect(await vehicle.setFanLevel(6)).toBe(6);
    expect(commands).toContain('30810006');
    expect(commands.at(-1)).toBe('ATSH7DF');
    expect(await vehicle.readFuelLitres()).toBe(21.5);
    await expect(vehicle.setFanLevel(0)).rejects.toThrow();
    await expect(vehicle.setFanLevel(7)).rejects.toThrow();
    await expect(vehicle.setFanLevel(3, () => false)).rejects.toThrow('cancelled');
    expect(commands).not.toContain('30810003');
    await elm.disconnect();
  });
  it('restores the functional header after NO DATA and never reports a failed write as success', async () => {
    const transport = new SimulatorTransport();
    const original = transport.write.bind(transport);
    const commands: string[] = [];
    transport.write = async (data) => {
      const command = new TextDecoder().decode(data).trim(); commands.push(command);
      // Unsupported but prompt-complete response: exercise the same failure path as a real adapter.
      await original(new TextEncoder().encode(command.startsWith('3081') ? 'UNSUPPORTED\r' : command + '\r'));
    };
    const elm = new Elm327Client(transport, { initializationSequence: [] });
    await elm.connect({ id: 'simulator', name: 'Simulator' });
    await expect(new PriusCControls(elm).setFanLevel(6)).rejects.toThrow('mismatch');
    expect(commands.at(-1)).toBe('ATSH7DF');
    expect(await new PriusCControls(elm).readFuelLitres()).toBe(21.5);
    await elm.disconnect();
  });
});
