import type { ParserCacheEntry } from '../../types/main-process';
import type { ParserState } from '../../types/overlay';

import * as fs from 'fs';
import { loadDungeonDataByName } from './parser-dungeon';
import { splitLogLine, unquote } from './parser-state';

const READ_STREAM_CHUNK_SIZE = 1024 * 1024;
const REVERSE_SEARCH_CHUNK_SIZE = 1024 * 1024;
const RECENT_DUNGEONS_TO_SCAN = 2;

async function processFileRange(
  filePath: string,
  start: number,
  endExclusive: number,
  entry: ParserCacheEntry,
  processLine: (state: ParserState, line: string) => void,
): Promise<void> {
  const length = Math.max(0, endExclusive - start);
  if (!length) return;

  await new Promise<void>((resolve, reject) => {
    let leftover = entry.leftover || '';
    const stream = fs.createReadStream(filePath, {
      start,
      end: endExclusive - 1,
      encoding: 'utf8',
      highWaterMark: READ_STREAM_CHUNK_SIZE,
    });

    const flushChunk = (chunk: string): void => {
      const text = leftover + chunk;
      const lines = text.split(/\r?\n/);
      leftover = lines.pop() || '';
      for (const line of lines) processLine(entry.state, line);
    };

    stream.on('data', flushChunk);
    stream.on('error', reject);
    stream.on('end', () => {
      entry.leftover = leftover;
      resolve();
    });
  });
}

function getFileIdentity(stat: { dev?: number; ino?: number }): string {
  return `${stat.dev || 0}:${stat.ino || 0}`;
}

function getLineDungeonBoundaryKind(line: string): 'start' | 'zone' | null {
  if (!line || (!line.includes('|DUNGEON_START|') && !line.includes('|ZONE_CHANGE|'))) {
    return null;
  }

  const parts: string[] = splitLogLine(line);
  if (parts.length < 3) return null;

  const event = parts[1] || null;
  if (event === 'DUNGEON_START') return 'start';
  if (event !== 'ZONE_CHANGE') return null;

  return loadDungeonDataByName(unquote(parts[2])) ? 'zone' : null;
}

function chooseRecentDungeonParseOffset(boundaryOffsets: number[], fallbackZoneOffset: number | null): number {
  if (boundaryOffsets.length >= RECENT_DUNGEONS_TO_SCAN) {
    return boundaryOffsets[RECENT_DUNGEONS_TO_SCAN - 1];
  }
  if (boundaryOffsets.length > 0) {
    return boundaryOffsets[boundaryOffsets.length - 1];
  }
  return fallbackZoneOffset ?? 0;
}

async function findRecentDungeonParseOffset(filePath: string, fileSize: number): Promise<number> {
  if (!fileSize) return 0;

  const handle = await fs.promises.open(filePath, 'r');
  const boundaryOffsets: number[] = [];
  let fallbackZoneOffset: number | null = null;
  let carry: BufferLike = Buffer.alloc(0);

  const processLineBuffer = (lineBuffer: BufferLike, lineStartOffset: number): boolean => {
    if (!lineBuffer?.length) return false;

    let line = lineBuffer.toString('utf8');
    if (line.endsWith('\r')) line = line.slice(0, -1);

    const kind = getLineDungeonBoundaryKind(line);
    if (!kind) return false;

    if (kind === 'start') {
      boundaryOffsets.push(lineStartOffset);
      return boundaryOffsets.length >= RECENT_DUNGEONS_TO_SCAN;
    }

    if (fallbackZoneOffset == null) fallbackZoneOffset = lineStartOffset;
    return false;
  };

  try {
    let position = fileSize;

    while (position > 0 && boundaryOffsets.length < RECENT_DUNGEONS_TO_SCAN) {
      const toRead = Math.min(REVERSE_SEARCH_CHUNK_SIZE, position);
      position -= toRead;

      const buffer = Buffer.allocUnsafe(toRead);
      const { bytesRead } = await handle.read(buffer, 0, toRead, position);
      const chunk = buffer.subarray(0, bytesRead);
      const combined = carry.length ? Buffer.concat([chunk, carry]) : chunk;

      let lineEnd = combined.length;
      let newlineIndex = combined.lastIndexOf(0x0a, lineEnd - 1);

      while (newlineIndex !== -1) {
        const lineBuffer = combined.subarray(newlineIndex + 1, lineEnd);
        const shouldStop = processLineBuffer(lineBuffer, position + newlineIndex + 1);
        if (shouldStop) return chooseRecentDungeonParseOffset(boundaryOffsets, fallbackZoneOffset);

        lineEnd = newlineIndex;
        newlineIndex = combined.lastIndexOf(0x0a, lineEnd - 1);
      }

      carry = combined.subarray(0, lineEnd);
    }

    if (carry.length) processLineBuffer(carry, 0);

    return chooseRecentDungeonParseOffset(boundaryOffsets, fallbackZoneOffset);
  } finally {
    await handle.close();
  }
}

export {
  findRecentDungeonParseOffset,
  getFileIdentity,
  processFileRange,
};
