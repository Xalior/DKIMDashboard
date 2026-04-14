import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFile, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { GET, POST } from './route';

const FIXTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'lib',
  '__fixtures__',
  'trusted-hosts',
);

describe('/api/trusted-hosts', () => {
  let dir: string;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'trusted-hosts-route-'));
    savedEnv = process.env.OPENDKIM_CONFIG_DIR;
    process.env.OPENDKIM_CONFIG_DIR = dir;
  });

  afterEach(async () => {
    if (savedEnv === undefined) delete process.env.OPENDKIM_CONFIG_DIR;
    else process.env.OPENDKIM_CONFIG_DIR = savedEnv;
    await rm(dir, { recursive: true, force: true });
  });

  async function seed(fixture: string): Promise<void> {
    await copyFile(join(FIXTURE_DIR, fixture), join(dir, 'TrustedHosts'));
  }

  async function readTable(): Promise<string> {
    return readFile(join(dir, 'TrustedHosts'), 'utf-8');
  }

  function jsonRequest(method: string, body: unknown): Request {
    return new Request('http://localhost/api/trusted-hosts', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('GET', () => {
    it('returns 200 with entries in file order, flagging refile', async () => {
      await seed('with-refile.txt');
      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<{ value: string; isRefile: boolean }>;
      expect(body.map((e) => e.value)).toEqual([
        '127.0.0.1',
        '::1',
        'refile:/etc/opendkim/IgnoreHosts',
        'mail.example.com',
      ]);
      expect(body[2].isRefile).toBe(true);
      expect(body.filter((e, i) => i !== 2).every((e) => !e.isRefile)).toBe(true);
    });

    it('returns inlineComment when present on entries', async () => {
      await seed('inline-comments.txt');
      const res = await GET();
      const body = (await res.json()) as Array<{ inlineComment?: string }>;
      expect(body.map((e) => e.inlineComment)).toEqual([
        '# loopback',
        '# office network',
        '#lab',
        '# primary MX',
      ]);
    });

    it('returns empty array on an empty file', async () => {
      await seed('empty.txt');
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });
  });

  describe('POST', () => {
    it('returns 201 with the new entry and writes it to disk', async () => {
      await seed('single-entry.txt');
      const res = await POST(jsonRequest('POST', { value: '127.0.0.1' }));
      expect(res.status).toBe(201);
      const body = (await res.json()) as { entry: { value: string; id: string } };
      expect(body.entry.value).toBe('127.0.0.1');

      const disk = await readTable();
      expect(disk).toContain('0.0.0.0/0');
      expect(disk).toContain('127.0.0.1');
    });

    it('returns 400 on missing value', async () => {
      await seed('single-entry.txt');
      const res = await POST(jsonRequest('POST', {}));
      expect(res.status).toBe(400);
    });

    it('returns 409 on duplicate value', async () => {
      await seed('canonical.txt');
      const res = await POST(jsonRequest('POST', { value: '127.0.0.1' }));
      expect(res.status).toBe(409);
    });

    it('returns 400 when value contains whitespace', async () => {
      await seed('single-entry.txt');
      const res = await POST(jsonRequest('POST', { value: '10.0.0.0/8 192.168.1.0/24' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when value contains a comma', async () => {
      await seed('single-entry.txt');
      const res = await POST(jsonRequest('POST', { value: '10.0.0.0/8,192.168.1.0/24' }));
      expect(res.status).toBe(400);
    });

    it('preserves hand-edited comments across a successful write', async () => {
      await seed('with-comments.txt');
      const res = await POST(jsonRequest('POST', { value: '172.16.0.0/12' }));
      expect(res.status).toBe(201);

      const disk = await readTable();
      expect(disk).toContain('# TrustedHosts — hosts allowed to submit mail for signing');
      expect(disk).toContain('# Managed by DKIM Dashboard');
      expect(disk).toContain('# Localhost');
      expect(disk).toContain('# Office network');
      expect(disk).toContain('172.16.0.0/12');
    });
  });
});
