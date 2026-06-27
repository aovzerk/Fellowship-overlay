import type { FinalizedState } from '../../types/overlay';

import { parentPort } from 'worker_threads';
import { parseCombatLog } from './parser';

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

type MessagePort = NonNullable<typeof parentPort>;

async function handleRequest(port: MessagePort, message: ParseRequestMessage): Promise<void> {
  const id = Number(message?.id);
  const filePath = String(message?.filePath || '');

  if (!filePath) {
    const errorPayload: ParseErrorMessage = { id, ok: false, error: 'Missing file path' };
    port.postMessage(errorPayload);
    return;
  }

  try {
    const data = await parseCombatLog(filePath);
    const payload: ParseSuccessMessage = { id, ok: true, data };
    port.postMessage(payload);
  } catch (error) {
    const typedError = error as { stack?: string; message?: string } | null;
    const payload: ParseErrorMessage = {
      id,
      ok: false,
      error: typedError?.stack || typedError?.message || String(error),
    };
    port.postMessage(payload);
  }
}

if (parentPort) {
  const port = parentPort;
  // Serialize requests so concurrent parses can never race the shared parser
  // cache. handleRequest swallows its own errors, so the chain never rejects.
  let queue: Promise<void> = Promise.resolve();
  port.on('message', (message: ParseRequestMessage) => {
    queue = queue.then(() => handleRequest(port, message));
  });
}
