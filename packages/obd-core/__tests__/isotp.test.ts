import { assembleIsoTp, CommandScheduler } from '../src';

describe('ISO-TP assembly', () => {
  it('assembles a multi-frame payload', () => {
    const [message] = assembleIsoTp(['7E8 10 0A 49 02 01 57 50 30', '7E8 21 5A 5A 5A 39 39']);
    expect([...message!.payload]).toEqual([0x49, 0x02, 0x01, 0x57, 0x50, 0x30, 0x5a, 0x5a, 0x5a, 0x39]);
  });
  it('rejects partial responses', () => expect(() => assembleIsoTp(['7E8 10 0A 49 02 01 57 50 30'])).toThrow('Partial'));
});

describe('command scheduler', () => {
  it('never overlaps commands', async () => {
    let active = 0; let max = 0;
    const scheduler = new CommandScheduler(async () => { active += 1; max = Math.max(max, active); await new Promise((r) => setTimeout(r, 5)); active -= 1; return { raw: 'OK>', latencyMs: 5 }; });
    await Promise.all([scheduler.enqueue({ id: 'a', command: 'ATI', priority: 'BACKGROUND', timeoutMs: 100 }), scheduler.enqueue({ id: 'b', command: 'ATRV', priority: 'SAFETY_READ', timeoutMs: 100 })]);
    expect(max).toBe(1);
  });
});
