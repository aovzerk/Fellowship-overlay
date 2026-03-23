import type { ParserCacheEntry } from '../../types/main-process';
import type { ParserState } from '../../types/overlay';

import * as fs from 'fs';
import { loadDungeonDataByName } from './parser-dungeon';
import { splitLogLine, unquote } from './parser-state';

const READ_STREAM_CHUNK_SIZE = 1024 * 1024;
const RECENT_DUNGEONS_TO_SCAN = 2;
const TAIL_SCAN_INITIAL_SIZE = 4 * 1024 * 1024;
const TAIL_SCAN_MAX_SIZE = 64 * 1024 * 1024;

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
    return boundaryOffsets[Math.max(0, boundaryOffsets.length - RECENT_DUNGEONS_TO_SCAN)];
  }
  if (boundaryOffsets.length > 0) {
    return boundaryOffsets[0];
  }
  return fallbackZoneOffset ?? 0;
}

function nextLineStartOffset(buffer: any, index: number): number {
  const newlineIndex = buffer.indexOf(0x0a, index);
  if (newlineIndex === -1) return 0;
  return newlineIndex + 1;
}

function findBoundaryOffsetsInBuffer(
  buffer: any,
  absoluteStart: number,
): { starts: number[]; fallbackZoneOffset: number | null } {
  const starts: number[] = [];
  let fallbackZoneOffset: number | null = null;
  let lineStart = 0;

  for (let i = 0; i <= buffer.length; i += 1) {
    const isLineEnd = i === buffer.length || buffer[i] === 0x0a;
    if (!isLineEnd) continue;

    let lineEnd = i;
    if (lineEnd > lineStart && buffer[lineEnd - 1] === 0x0d) {
      lineEnd -= 1;
    }

    if (lineEnd > lineStart) {
      const lineBuffer = buffer.subarray(lineStart, lineEnd);
      if (lineBuffer.includes('|DUNGEON_START|') || lineBuffer.includes('|ZONE_CHANGE|')) {
        const kind = getLineDungeonBoundaryKind(lineBuffer.toString('utf8'));
        if (kind === 'start') {
          starts.push(absoluteStart + lineStart);
        } else if (kind === 'zone' && fallbackZoneOffset == null) {
          fallbackZoneOffset = absoluteStart + lineStart;
        }
      }
    }

    lineStart = i + 1;
  }

  return { starts, fallbackZoneOffset };
}

async function findRecentDungeonParseOffset(filePath: string, fileSize: number): Promise<number> {
  if (!fileSize) return 0;

  const handle = await fs.promises.open(filePath, 'r');

  try {
    let scanSize = Math.min(TAIL_SCAN_INITIAL_SIZE, fileSize);

    while (true) {
      const windowStart = Math.max(0, fileSize - scanSize);
      const windowSize = fileSize - windowStart;

      const buffer = Buffer.allocUnsafe(windowSize);
      const { bytesRead } = await handle.read(buffer, 0, windowSize, windowStart);
      const chunk = buffer.subarray(0, bytesRead);

      const sliceStart = windowStart > 0 ? nextLineStartOffset(chunk, 0) : 0;
      const slicedChunk = sliceStart > 0 ? chunk.subarray(sliceStart) : chunk;
      const absoluteSliceStart = windowStart + sliceStart;

      const { starts, fallbackZoneOffset } = findBoundaryOffsetsInBuffer(slicedChunk, absoluteSliceStart);

      if (starts.length >= RECENT_DUNGEONS_TO_SCAN || windowStart === 0) {
        return chooseRecentDungeonParseOffset(starts, fallbackZoneOffset);
      }

      if (scanSize >= TAIL_SCAN_MAX_SIZE) {
        return chooseRecentDungeonParseOffset(starts, fallbackZoneOffset) || absoluteSliceStart;
      }

      scanSize = Math.min(fileSize, Math.max(scanSize * 2, TAIL_SCAN_INITIAL_SIZE));
    }
  } finally {
    await handle.close();
  }
}

export {
  findRecentDungeonParseOffset,
  getFileIdentity,
  processFileRange,
};
