export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null; // null in the log: show as "—"
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  first: string; // ISO time of the first line for this job
  last: string; // ISO time of the last line for this job
};

export type Night = {
  rows: DigestRow[]; // one per job, sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
};

// Reads <runsDir>/<night>.jsonl. Returns null when the night has no file.
export type ReadNight = (runsDir: string, night: string) => Night | null;
