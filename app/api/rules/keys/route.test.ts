import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { GET } from './route';

const FIXTURE_DIR = join(__dirname, '..', '..', '..', '..', 'lib', '__fixtures__', 'key-table');

describe('/api/rules/keys', () => {
  let dir: string;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rules-keys-route-'));
    savedEnv = process.env.OPENDKIM_CONFIG_DIR;
    process.env.OPENDKIM_CONFIG_DIR = dir;
  });

  afterEach(async () => {
    if (savedEnv === undefined) delete process.env.OPENDKIM_CONFIG_DIR;
    else process.env.OPENDKIM_CONFIG_DIR = savedEnv;
    await rm(dir, { recursive: true, force: true });
  });

  async function seed(fixture: string): Promise<void> {
    await copyFile(join(FIXTURE_DIR, fixture), join(dir, 'KeyTable'));
  }

  it('returns 200 with the list of key entries in file order', async () => {
    await seed('with-comments.txt');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ selectorDomain: string; malformed: boolean }>;
    expect(body.map((e) => e.selectorDomain)).toEqual([
      'mail._domainkey.nextbestnetwork.com',
      'mail._domainkey.example.com',
    ]);
    expect(body.every((e) => !e.malformed)).toBe(true);
  });

  it('surfaces malformed entries with malformed: true and preserves their raw line', async () => {
    await seed('malformed.txt');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ malformed: boolean; rawLine: string }>;
    const malformed = body.filter((e) => e.malformed);
    expect(malformed.length).toBe(2);
    const joined = malformed.map((e) => e.rawLine).join('\n');
    expect(joined).toContain('weirdSelector');
    expect(joined).toContain('placeholder_only');
  });

  it('returns an empty array on an empty KeyTable', async () => {
    await seed('empty.txt');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
