import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, Night, ReadNight } from './types.js';

const STATUSES = new Set<string>(['ok', 'retry', 'fail']);

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }
    if (!e || typeof e.job !== 'string' || typeof e.at !== 'string' || !STATUSES.has(e.status)) {
      badLines++;
      continue;
    }
    const status = e.status as DigestStatus;
    const row = rows.get(e.job) ?? {
      job: e.job,
      owner: null,
      runs: 0,
      retries: 0,
      lastStatus: status,
      lastError: null,
      first: e.at,
      last: e.at,
    };
    row.runs++;
    if (status === 'retry') row.retries++;
    row.owner = typeof e.owner === 'string' ? e.owner : row.owner;
    row.lastStatus = status;
    if (typeof e.error === 'string') row.lastError = e.error; // last error seen, even if the job recovered
    if (e.at < row.first) row.first = e.at;
    if (e.at > row.last) row.last = e.at;
    rows.set(e.job, row);
  }

  return { rows: [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0)), badLines } satisfies Night;
};
