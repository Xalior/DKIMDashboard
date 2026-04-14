import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { GET } from './route';
import { GET as ListGET } from '../route';

const FIXTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'lib',
  '__fixtures__',
  'key-table',
);

describe('/api/rules/keys/[id]', () => {
  let dir: string;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rules-keys-id-route-'));
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

  function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it('returns 200 with the entry + null disk/DNS fields when no keys dir exists', async () => {
    await seed('canonical.txt');
    const listRes = await ListGET();
    const list = (await listRes.json()) as Array<{ id: string; malformed: boolean }>;
    const id = list[0].id;

    const res = await GET(new Request('http://localhost/'), ctx(id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entry: { id: string; malformed: boolean };
      diskFiles: string[] | null;
      dnsExpected: unknown;
      dnsVerification: unknown;
    };
    expect(body.entry.id).toBe(id);
    expect(body.entry.malformed).toBe(false);
    // No keys dir in the seeded temp dir, so diskFiles is the empty array
    // listKeyFiles returns on missing dir.
    expect(body.diskFiles).toEqual([]);
    // No private key to derive an expected TXT from.
    expect(body.dnsExpected).toBeNull();
    // dnsVerification still returns a result object — status is 'no_key' in this
    // case — rather than null.
    expect(body.dnsVerification).toMatchObject({ status: 'no_key' });
  });

  it('returns 200 with null disk/DNS fields for a malformed entry', async () => {
    await seed('malformed.txt');
    const listRes = await ListGET();
    const list = (await listRes.json()) as Array<{ id: string; malformed: boolean; rawLine: string }>;
    const malformed = list.find((e) => e.malformed);
    expect(malformed).toBeDefined();
    if (!malformed) return;

    const res = await GET(new Request('http://localhost/'), ctx(malformed.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entry: { malformed: boolean };
      diskFiles: string[] | null;
      dnsExpected: unknown;
      dnsVerification: unknown;
    };
    expect(body.entry.malformed).toBe(true);
    expect(body.diskFiles).toBeNull();
    expect(body.dnsExpected).toBeNull();
    expect(body.dnsVerification).toBeNull();
  });

  it('returns 404 when id is unknown', async () => {
    await seed('canonical.txt');
    const res = await GET(new Request('http://localhost/'), ctx('missing-id'));
    expect(res.status).toBe(404);
  });
});
