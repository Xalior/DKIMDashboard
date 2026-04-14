import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFile, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { GET, PUT, DELETE } from './route';
import { GET as ListGET } from '../route';

const FIXTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'lib',
  '__fixtures__',
  'trusted-hosts',
);

describe('/api/trusted-hosts/[id]', () => {
  let dir: string;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'trusted-hosts-id-route-'));
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

  async function firstEntryId(): Promise<string> {
    const res = await ListGET();
    const list = (await res.json()) as Array<{ id: string }>;
    return list[0].id;
  }

  function jsonRequest(method: string, body: unknown): Request {
    return new Request('http://localhost/api/trusted-hosts/x', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  describe('GET', () => {
    it('returns 200 with the entry', async () => {
      await seed('canonical.txt');
      const id = await firstEntryId();
      const res = await GET(new Request('http://localhost/'), ctx(id));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { entry: { value: string } };
      expect(body.entry.value).toBe('127.0.0.1');
    });

    it('returns 404 when id is unknown', async () => {
      await seed('canonical.txt');
      const res = await GET(new Request('http://localhost/'), ctx('missing-id'));
      expect(res.status).toBe(404);
    });
  });

  describe('PUT (inline-comment preservation)', () => {
    it('preserves the existing inline comment by default', async () => {
      await seed('inline-comments.txt');
      const listRes = await ListGET();
      const list = (await listRes.json()) as Array<{ id: string; value: string; inlineComment?: string }>;
      const target = list.find((e) => e.value === '10.0.0.0/8');
      if (!target) return;
      expect(target.inlineComment).toBe('# office network');

      const res = await PUT(
        jsonRequest('PUT', { value: '172.16.0.0/12' }),
        ctx(target.id),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { entry: { value: string; inlineComment?: string } };
      expect(body.entry.value).toBe('172.16.0.0/12');
      expect(body.entry.inlineComment).toBe('# office network');

      const disk = await readTable();
      expect(disk).toContain('172.16.0.0/12 # office network');
    });

    it('drops the inline comment when caller passes an empty string', async () => {
      await seed('inline-comments.txt');
      const listRes = await ListGET();
      const list = (await listRes.json()) as Array<{ id: string; value: string }>;
      const target = list.find((e) => e.value === '192.168.1.0/24');
      if (!target) return;

      const res = await PUT(
        jsonRequest('PUT', { value: '192.168.2.0/24', inlineComment: '' }),
        ctx(target.id),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { entry: { inlineComment?: string } };
      expect(body.entry.inlineComment).toBeUndefined();

      const disk = await readTable();
      expect(disk).toContain('\n192.168.2.0/24\n');
      expect(disk).not.toContain('192.168.2.0/24 #');
    });

    it('returns 404 when id is unknown', async () => {
      await seed('canonical.txt');
      const res = await PUT(jsonRequest('PUT', { value: '1.2.3.4' }), ctx('missing-id'));
      expect(res.status).toBe(404);
    });

    it('returns 409 when new value collides with another entry', async () => {
      await seed('canonical.txt');
      const listRes = await ListGET();
      const list = (await listRes.json()) as Array<{ id: string; value: string }>;
      const res = await PUT(
        jsonRequest('PUT', { value: list[1].value }),
        ctx(list[0].id),
      );
      expect(res.status).toBe(409);
    });

    it('returns 400 on missing value', async () => {
      await seed('canonical.txt');
      const id = await firstEntryId();
      const res = await PUT(jsonRequest('PUT', {}), ctx(id));
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE', () => {
    it('returns 204 and removes the entry', async () => {
      await seed('canonical.txt');
      const id = await firstEntryId();
      const res = await DELETE(new Request('http://localhost/'), ctx(id));
      expect(res.status).toBe(204);

      const listRes = await ListGET();
      const remaining = (await listRes.json()) as Array<{ id: string }>;
      expect(remaining.map((r) => r.id)).not.toContain(id);
    });

    it('returns 404 on unknown id', async () => {
      await seed('canonical.txt');
      const res = await DELETE(new Request('http://localhost/'), ctx('missing-id'));
      expect(res.status).toBe(404);
    });
  });
});
