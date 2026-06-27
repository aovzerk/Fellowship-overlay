import type { FinalizedState } from '../../types/overlay';

import * as path from 'path';
import { Worker } from 'worker_threads';
import { parseCombatLog as parseCombatLogDirect } from './parser';

interface ParseRequestMessage {
  id: number;
  filePath: string;
}

interface ParseSuccessMessage {
  id: number;
  ok: true;
  data: FinalizedState;
}

interface ParseErrorMessage {
  id: number;
  ok: false;
  error: string;
}

type ParseResponseMessage = ParseSuccessMessage | ParseErrorMessage;

interface PendingRequest {
  resolve: (value: FinalizedState) => void;
  reject: (error: unknown) => void;
}

// A single long-lived worker is reused across parses so the parser's incremental
// cache (byte offset + accumulated state) and the game-data caches stay warm.
// That makes each in-combat update read only the bytes appended since the last
// parse instead of re-scanning and re-parsing the whole current dungeon.
let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function getWorkerPath(): string {
  return path.join(__dirname, 'parser-worker.js');
}

function rejectAllPending(error: unknown): void {
  for (const [, request] of pending) {
    request.reject(error);
  }
  pending.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;

  const created = new Worker(getWorkerPath());

  created.on('message', (message: ParseResponseMessage) => {
    if (!message || typeof message.id !== 'number') return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.ok) {
      request.resolve((message as ParseSuccessMessage).data);
    } else {
      request.reject(new Error((message as ParseErrorMessage).error || 'Parser worker failed'));
    }
  });

  created.on('error', (error: Error) => {
    // Only fail in-flight requests if this is still the active worker; a stale
    // worker's late event must not reject a request owned by its replacement.
    if (worker === created) {
      worker = null;
      rejectAllPending(error);
    }
    void created.terminate().catch(() => {});
  });

  created.on('exit', (code: number) => {
    if (worker === created) {
      worker = null;
      if (code !== 0) rejectAllPending(new Error(`Parser worker exited with code ${code}`));
    }
  });

  worker = created;
  return worker;
}

function parseViaWorker(filePath: string): Promise<FinalizedState> {
  return new Promise<FinalizedState>((resolve, reject) => {
    const activeWorker = ensureWorker();
    const id = nextRequestId++;
    pending.set(id, { resolve, reject });
    const message: ParseRequestMessage = { id, filePath };
    try {
      activeWorker.postMessage(message);
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

async function parseCombatLog(filePath: string): Promise<FinalizedState> {
  try {
    return await parseViaWorker(filePath);
  } catch {
    // Worker unavailable (crash/restart): parse in-process this once so the
    // overlay still updates. The next call recreates the worker.
    return parseCombatLogDirect(filePath);
  }
}

async function disposeParserWorker(): Promise<void> {
  rejectAllPending(new Error('Parser worker disposed'));
  const current = worker;
  worker = null;
  if (current) await current.terminate().catch(() => {});
}

export {
  disposeParserWorker,
  parseCombatLog,
};
