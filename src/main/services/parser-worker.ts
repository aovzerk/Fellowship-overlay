import type { FinalizedState } from '../../types/overlay';

import { parentPort, workerData } from 'worker_threads';
import { parseCombatLog } from './parser';

interface ParseWorkerData {
  filePath: string;
}

interface ParseSuccessMessage {
  ok: true;
  data: FinalizedState;
}

interface ParseErrorMessage {
  ok: false;
  error: string;
}

async function run(): Promise<void> {
  const data = workerData as ParseWorkerData | null;
  const filePath = String(data?.filePath || '');

  if (!parentPort || !filePath) {
    return;
  }

  try {
    const result = await parseCombatLog(filePath);
    const payload: ParseSuccessMessage = {
      ok: true,
      data: result,
    };
    parentPort.postMessage(payload);
  } catch (error) {
    const typedError = error as { stack?: string; message?: string } | null;
    const payload: ParseErrorMessage = {
      ok: false,
      error: typedError?.stack || typedError?.message || String(error),
    };
    parentPort.postMessage(payload);
  }
}

void run();
