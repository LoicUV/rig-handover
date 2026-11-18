import * as fs from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const runsDir = fs.mkdtempSync(join(os.tmpdir(), 'rig-digest-routes-'));

const config: RigConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
};

const normal = '2026-11-18';
const empty = '2026-11-02';
const broken = '2026-11-03';
const missing = '2026-01-01';

fs.writeFileSync(
  join(runsDir, `${normal}.jsonl`),
  [
    '{"at":"2026-11-18T03:00:00+01:00","job":"notes/backup","status":"retry","owner":"lane-07","error":"lock held"}',
    '{"at":"2026-11-18T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
    '{"at":"2026-11-18T02:00:00+01:00","job":"digest/render","status":"fail","owner":null,"error":"boom"}',
    '',
  ].join('\n'),
);

fs.writeFileSync(join(runsDir, `${empty}.jsonl`), '');

fs.writeFileSync(
  join(runsDir, `${broken}.jsonl`),
  [
    '{"at":"2026-11-03T01:00:00+01:00","job":"zeta","status":"ok","owner":"rook"}',
    'this line is not json',
    '{"at":"2026-11-03T02:00:00+01:00","job":"alpha","status":"ok","owner":"rook"}',
    '',
  ].join('\n'),
);

const app = createApp(config);

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

function jobsInPage(html: string): string[] {
  const cells = [...html.matchAll(/<td>([^<]*)<\/td>/g)].map((match) => match[1].trim());
  const jobs: string[] = [];
  for (let i = 0; i < cells.length; i += 8) jobs.push(cells[i] ?? '');
  return jobs;
}

async function both(night: string) {
  const page = await app.request(`/digest/${night}`);
  const api = await app.request(`/api/digest/${night}`);
  return { page, api, html: await page.text() };
}

describe('GET /digest/:night and GET /api/digest/:night', () => {
  it('returns 200 and lists the same jobs in the same order', async () => {
    const { page, api, html } = await both(normal);
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const body = await api.json();
    const jobs = body.rows.map((row: { job: string }) => row.job);
    expect(jobs).toEqual(['digest/render', 'lane/sync', 'notes/backup']);
    expect(jobsInPage(html)).toEqual(jobs);
  });

  it('returns 404 when the night has no file', async () => {
    const { page, api } = await both(missing);
    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: 'no such night' });
  });

  it('says nothing ran for an empty night and returns no rows', async () => {
    const { page, api, html } = await both(empty);
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(html).toContain('nothing ran');
    const body = await api.json();
    expect(body.rows).toEqual([]);
    expect(jobsInPage(html)).toEqual(body.rows.map((row: { job: string }) => row.job));
  });

  it('still renders a night with a bad line and reports badLines 1', async () => {
    const { page, api, html } = await both(broken);
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const body = await api.json();
    const jobs = body.rows.map((row: { job: string }) => row.job);
    expect(body.badLines).toBe(1);
    expect(jobs).toEqual(['alpha', 'zeta']);
    expect(jobsInPage(html)).toEqual(jobs);
    expect(html).toContain(`digest · ${broken}`);
  });
});
