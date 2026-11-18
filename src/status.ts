import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightCounts = {
  ok: number;
  retry: number;
  fail: number;
};

// counts is null when readNight returns null: the night stays on the board with no counts.
export type NightOnDisk = {
  night: string;
  counts: NightCounts | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightOnDisk[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Log lines per status. Rows collapse each job to its last status, so this counts the log.
function nightCounts(runsDir: string, night: string): NightCounts | null {
  if (readNight(runsDir, night) === null) return null;

  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof entry !== 'object' || entry === null) continue;
    const { job, at, status } = entry as { job?: unknown; at?: unknown; status?: unknown };
    if (typeof job !== 'string' || typeof at !== 'string') continue;
    if (status === 'ok' || status === 'retry' || status === 'fail') counts[status] += 1;
  }
  return counts;
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({
      night,
      counts: nightCounts(config.runsDir, night),
    })),
  };
}
