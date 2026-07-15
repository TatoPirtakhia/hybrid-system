import type { CommandPriority } from '@prius/shared';

export type TransportType = 'BLE' | 'WIFI' | 'ANDROID_CLASSIC' | 'SIMULATOR';
export type TransportStatus = 'DISCONNECTED' | 'SCANNING' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface DiscoveredAdapter {
  id: string;
  name: string;
  signalStrength?: number;
  metadata?: Record<string, string>;
}

export interface ObdTransport {
  readonly type: TransportType;
  scan(): Promise<DiscoveredAdapter[]>;
  connect(adapter: DiscoveredAdapter): Promise<void>;
  disconnect(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  subscribe(listener: (data: Uint8Array) => void): () => void;
  getStatus(): TransportStatus;
}

export interface ScheduledCommand {
  id: string;
  command: string;
  priority: CommandPriority;
  timeoutMs: number;
  retries?: number;
  signal?: AbortSignal;
  write?: boolean;
}

export type CommandResult = { raw: string; latencyMs: number };

const weights: Record<CommandPriority, number> = {
  CRITICAL_WRITE: 0,
  SAFETY_READ: 1,
  FAST_TELEMETRY: 2,
  NORMAL_TELEMETRY: 3,
  SLOW_TELEMETRY: 4,
  BACKGROUND: 5,
};

type QueueItem = ScheduledCommand & {
  sequence: number;
  resolve: (value: CommandResult) => void;
  reject: (reason: Error) => void;
};

export class CommandScheduler {
  private queue: QueueItem[] = [];
  private active = false;
  private paused = false;
  private sequence = 0;
  private failureCount = 0;
  private completedCount = 0;

  constructor(private readonly execute: (command: ScheduledCommand) => Promise<CommandResult>) {}

  enqueue(command: ScheduledCommand): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      if (command.signal?.aborted) return reject(new Error('Command cancelled'));
      this.queue.push({ ...command, sequence: this.sequence++, resolve, reject });
      this.queue.sort((a, b) => weights[a.priority] - weights[b.priority] || a.sequence - b.sequence);
      void this.drain();
    });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) void this.drain();
  }

  cancelPending(reason = 'Command queue cancelled'): void {
    for (const item of this.queue.splice(0)) item.reject(new Error(reason));
  }

  getStats(): { pending: number; failureRate: number; overloaded: boolean } {
    const attempts = this.failureCount + this.completedCount;
    return { pending: this.queue.length, failureRate: attempts ? this.failureCount / attempts : 0, overloaded: this.queue.length > 12 };
  }

  private async drain(): Promise<void> {
    if (this.active || this.paused) return;
    const item = this.queue.shift();
    if (!item) return;
    if (item.signal?.aborted) {
      item.reject(new Error('Command cancelled'));
      return void this.drain();
    }
    this.active = true;
    try {
      let lastError = new Error('Command failed');
      for (let attempt = 0; attempt <= (item.retries ?? 0); attempt += 1) {
        try {
          const result = await this.withTimeout(this.execute(item), item.timeoutMs);
          this.completedCount += 1;
          item.resolve(result);
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      this.failureCount += 1;
      item.reject(lastError);
    } finally {
      this.active = false;
      void this.drain();
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Command timed out')), timeoutMs);
    });
    try { return await Promise.race([promise, timeout]); }
    finally { if (timer) clearTimeout(timer); }
  }
}

export interface IsoTpMessage { header?: string; payload: Uint8Array }

export const assembleIsoTp = (frames: string[]): IsoTpMessage[] => {
  const normalized = frames.map((line) => line.replace(/\s/g, '').toUpperCase()).filter(Boolean);
  const groups = new Map<string, Uint8Array[]>();
  for (const line of normalized) {
    if (!/^[0-9A-F]+$/.test(line)) throw new Error('Malformed CAN frame');
    const hasHeader = line.length % 2 !== 0;
    const actualHeader = hasHeader ? line.slice(0, 3) : '';
    const bodyHex = hasHeader ? line.slice(3) : line;
    if (bodyHex.length % 2 !== 0) throw new Error('Malformed CAN frame');
    const bytes = Uint8Array.from(bodyHex.match(/.{2}/g)?.map((x) => Number.parseInt(x, 16)) ?? []);
    const list = groups.get(actualHeader) ?? [];
    list.push(bytes);
    groups.set(actualHeader, list);
  }
  return [...groups.entries()].map(([header, parts]) => {
    const first = parts[0];
    if (!first) throw new Error('Missing ISO-TP frame');
    const frameType = first[0]! >> 4;
    if (frameType === 0) return { ...(header ? { header } : {}), payload: first.slice(1, 1 + (first[0]! & 0x0f)) };
    if (frameType !== 1 || first.length < 2) throw new Error('Unsupported first ISO-TP frame');
    const expected = ((first[0]! & 0x0f) << 8) | first[1]!;
    const output = [...first.slice(2)];
    let sequence = 1;
    for (const part of parts.slice(1)) {
      if ((part[0]! >> 4) !== 2 || (part[0]! & 0x0f) !== sequence % 16) throw new Error('ISO-TP sequence mismatch');
      output.push(...part.slice(1));
      sequence += 1;
    }
    if (output.length < expected) throw new Error('Partial ISO-TP response');
    return { ...(header ? { header } : {}), payload: Uint8Array.from(output.slice(0, expected)) };
  });
};
