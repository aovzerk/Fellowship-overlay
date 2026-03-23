import type { FinalizedState } from '../../types/overlay';

import * as path from 'path';
import { Worker } from 'worker_threads';
import { parseCombatLog as parseCombatLogDirect } from './parser';

interface ParseSuccessMessage {
  ok: true;
  data: FinalizedState;
}

interface ParseErrorMessage {
  ok: false;
  error: string;
}

function getWorkerPath(): string {
  return path.join(__dirname, 'parser-worker.js');
}

async function parseViaWorker(filePath: string): Promise<FinalizedState> {
  return new Promise<FinalizedState>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(getWorkerPath(), {
      workerData: { filePath },
    });

    const settleResolve = (value: FinalizedState): void => {
      if (settled) return;
      settled = true;
      resolve(value);
      void worker.terminate().catch(() => {});
    };

    const settleReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      reject(error);
      void worker.terminate().catch(() => {});
    };

    worker.once('message', (message: ParseSuccessMessage | ParseErrorMessage) => {
      if (message?.ok) {
        settleResolve(message.data);
        return;
      }

      const errorMessage = message && 'error' in message ? message.error : 'Parser worker failed';
      settleReject(new Error(errorMessage || 'Parser worker failed'));
    });

    worker.once('error', (error: Error) => {
      settleReject(error);
    });

    worker.once('exit', (code: number) => {
      if (!settled && code !== 0) {
        settleReject(new Error(`Parser worker exited with code ${code}`));
      }
    });
  });
}

async function parseCombatLog(filePath: string): Promise<FinalizedState> {
  try {
    return await parseViaWorker(filePath);
  } catch {
    return parseCombatLogDirect(filePath);
  }
}

async function disposeParserWorker(): Promise<void> {
  return;
}

export {
  disposeParserWorker,
  parseCombatLog,
};
