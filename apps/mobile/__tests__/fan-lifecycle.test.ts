jest.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: jest.fn() } }), { virtual: true });
jest.mock('../src/transports', () => ({}));
jest.mock('../src/database', () => ({ logVehicleAction: jest.fn().mockResolvedValue(undefined), appendTripSampleBatch: jest.fn().mockResolvedValue(undefined), upsertTrip: jest.fn().mockResolvedValue(undefined) }));
import { AppState } from 'react-native';
import { connectTransport, disconnect, setBatteryFanLevel, stopBatteryFanControl } from '../src/connection';
import { useFanStore, useTelemetryStore } from '../src/stores/app';
import type { ObdTransport } from '@prius/obd-core';

const changeState = (state: 'active' | 'inactive' | 'background') => {
  const listener = (AppState.addEventListener as jest.Mock).mock.calls[0]![1] as (state: string) => void;
  listener(state);
};
const settle = async (promise: Promise<unknown>) => {
  let done = false; let failure: unknown;
  void promise.then(() => { done = true; }, (error: unknown) => { failure = error; done = true; });
  for (let i = 0; i < 200 && !done; i++) await jest.advanceTimersByTimeAsync(20);
  if (failure) throw failure;
  expect(done).toBe(true);
};
const fixture = () => {
  let receive: (data: Uint8Array) => void = () => {};
  let header = '7DF'; let level = 0;
  const writes: string[] = [];
  const transport: ObdTransport = {
    type: 'BLE', scan: async () => [{ id: 'test', name: 'test' }], connect: async () => {}, disconnect: async () => {}, getStatus: () => 'CONNECTED',
    subscribe: (fn) => { receive = fn; return () => { receive = () => {}; }; },
    write: async (data) => {
      const command = new TextDecoder().decode(data).trim(); writes.push(command);
      if (command.startsWith('ATSH')) header = command.slice(4);
      let response = 'NO DATA';
      if (command.startsWith('AT')) response = 'OK';
      if (command === '0100') response = '7E8 06 41 00 00 00 00 00';
      if (command === '012F') response = '7E8 03 41 2F 80';
      if (command === '219B' && header === '7E2') response = `7EA 06 61 9B 01 0${level} 00 D9`;
      if (/^3081000[1-6]$/.test(command) && header === '7E2') { level = Number(command.at(-1)); response = '7EA 02 70 81'; }
      setTimeout(() => receive(new TextEncoder().encode(response + '\r>')), 10);
    },
  };
  return { transport, writes, fanWrites: () => writes.filter((value) => /^3081/.test(value)).length };
};

beforeEach(() => { jest.useFakeTimers(); changeState('active'); useTelemetryStore.setState({ values: {} }); });
afterEach(async () => { await disconnect(); jest.clearAllTimers(); jest.useRealTimers(); });

it('allows a fan level while moving and does not require speed telemetry', async () => {
  const car = fixture(); await settle(connectTransport(car.transport));
  useTelemetryStore.getState().batch([{ id: 'speed', value: 75, timestamp: Date.now(), unit: 'km/h', quality: 'VALID' }]);
  await settle(setBatteryFanLevel(4));
  expect(useFanStore.getState().level).toBe(4);
  useTelemetryStore.setState({ values: {} });
  await settle(setBatteryFanLevel(5));
  expect(useFanStore.getState().level).toBe(5);
});

it('continues the same level across inactive/background/foreground and stops only on explicit stop', async () => {
  const car = fixture(); await settle(connectTransport(car.transport));
  await settle(setBatteryFanLevel(6));
  const initial = car.fanWrites();
  changeState('inactive'); changeState('background');
  // No fan screen is mounted. Native BLE replies, not the foreground refresh timer, advance the session.
  await jest.advanceTimersByTimeAsync(500);
  expect(car.fanWrites()).toBeGreaterThan(initial + 1);
  expect(useFanStore.getState().level).toBe(6);
  changeState('active');
  await jest.advanceTimersByTimeAsync(200);
  const foreground = car.fanWrites();
  await jest.advanceTimersByTimeAsync(1700);
  expect(car.fanWrites()).toBeGreaterThan(foreground);
  stopBatteryFanControl();
  await jest.advanceTimersByTimeAsync(200);
  const stopped = car.fanWrites();
  changeState('background'); await jest.advanceTimersByTimeAsync(3000);
  expect(car.fanWrites()).toBe(stopped);
  expect(useFanStore.getState().level).toBeNull();
});

it('cancels pending renewals on disconnect without resuming on a lifecycle change', async () => {
  const car = fixture(); await settle(connectTransport(car.transport));
  await settle(setBatteryFanLevel(2));
  await disconnect(); const stopped = car.fanWrites();
  changeState('background'); await jest.advanceTimersByTimeAsync(4000);
  expect(car.fanWrites()).toBe(stopped);
  expect(useFanStore.getState().level).toBeNull();
});
