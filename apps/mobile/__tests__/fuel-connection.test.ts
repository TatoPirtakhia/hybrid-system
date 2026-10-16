jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }), { virtual: true });
jest.mock('../src/transports', () => ({}));
jest.mock('../src/database', () => ({ logVehicleAction: jest.fn().mockResolvedValue(undefined), appendTripSampleBatch: jest.fn(), upsertTrip: jest.fn() }));
import { connectTransport, disconnect } from '../src/connection';
import { useTelemetryStore } from '../src/stores/app';
import type { ObdTransport } from '@prius/obd-core';

it('polls Toyota fuel even when 012F is absent from the supported PID bitmap', async () => {
  let listener: (chunk: Uint8Array) => void = () => {};
  let header = '7DF';
  const sent: string[] = [];
  const transport: ObdTransport = {
    type: 'SIMULATOR', scan: async () => [{ id: 'test', name: 'test' }], connect: async () => {}, disconnect: async () => {}, getStatus: () => 'CONNECTED',
    subscribe: (fn) => { listener = fn; return () => {}; },
    write: async (data) => {
      const command = new TextDecoder().decode(data).trim(); sent.push(command);
      if (command.startsWith('ATSH')) header = command.slice(4);
      const response = command.startsWith('AT') ? 'OK' : command === '0100' ? '7E8 06 41 00 00 00 00 00' : command === '2129' && header === '7C0' ? '7C8 03 61 29 24' : 'NO DATA';
      listener(new TextEncoder().encode(response + '\r>'));
    },
  };
  const updated = new Promise<void>((resolve) => {
    const unsubscribe = useTelemetryStore.subscribe((state) => { if (state.values.fuelLevel?.quality === 'VALID') { unsubscribe(); resolve(); } });
  });
  try {
    await connectTransport(transport);
    await updated;
    expect(sent).toContain('012F');
    expect(sent).toContain('2129');
    expect(useTelemetryStore.getState().values.fuelLevel?.value).toBe(50);
    expect(header).toBe('7DF');
  } finally { await disconnect(); }
});
