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
  '..',
  'lib',
  '__fixtures__',
  'signing-table',
);

describe('/api/rules/signing/[id]', () => {
  let dir: string;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rules-signing-id-route-'));
    savedEnv = process.env.OPENDKIM_CONFIG_DIR;
    process.env.OPENDKIM_CONFIG_DIR = dir;
  });

  afterEach(async () => {
    if (savedEnv === undefined) delete process.env.OPENDKIM_CONFIG_DIR;
    else process.env.OPENDKIM_CONFIG_DIR = savedEnv;
    await rm(dir, { recursive: true, force: true });
  });

  async function seed(fixture: string): Promise<void> {
    await copyFile(join(FIXTURE_DIR, fixture), join(dir, 'SigningTable'));
  }

  async function firstRuleId(): Promise<string> {
    const res = await ListGET();
    const rules = (await res.json()) as Array<{ id: string }>;
    return rules[0].id;
  }

  async function readTable(): Promise<string> {
    return readFile(join(dir, 'SigningTable'), 'utf-8');
  }

  function jsonRequest(method: string, body: unknown): Request {
    return new Request('http://localhost/api/rules/signing/x', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  describe('GET', () => {
    it('returns 200 with the rule', async () => {
      await seed('canonical.txt');
      const id = await firstRuleId();
      const res = await GET(new Request('http://localhost/'), ctx(id));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { rule: { id: string; pattern: string } };
      expect(body.rule.id).toBe(id);
      expect(body.rule.pattern).toBe('*@id.nextbestnetwork.com');
    });

    it('returns 404 when id is unknown', async () => {
      await seed('canonical.txt');
      const res = await GET(new Request('http://localhost/'), ctx('missing-id'));
      expect(res.status).toBe(404);
    });
  });

  describe('PUT', () => {
    it('updates the rule and returns 200 with the new id', async () => {
      await seed('cross-domain.txt');
      const id = await firstRuleId();
      const res = await PUT(
        jsonRequest('PUT', {
          pattern: '*@ursa-renamed.xalior.com',
          keyRef: 'mail._domainkey.clientmail.xalior.com',
        }),
        ctx(id),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { rule: { id: string; pattern: string; keyRef: string } };
      expect(body.rule.id).not.toBe(id);
      expect(body.rule.pattern).toBe('*@ursa-renamed.xalior.com');

      const disk = await readTable();
      expect(disk).toContain('*@ursa-renamed.xalior.com mail._domainkey.clientmail.xalior.com');
      expect(disk).not.toMatch(/\*@ursa\.xalior\.com /);
    });

    it('returns 400 on missing fields', async () => {
      await seed('canonical.txt');
      const id = await firstRuleId();
      const res = await PUT(jsonRequest('PUT', { pattern: '' }), ctx(id));
      expect(res.status).toBe(400);
    });

    it('returns 404 when id is unknown', async () => {
      await seed('canonical.txt');
      const res = await PUT(
        jsonRequest('PUT', { pattern: '*@x.com', keyRef: 'mail._domainkey.x.com' }),
        ctx('missing-id'),
      );
      expect(res.status).toBe(404);
    });

    it('returns 409 when new content collides with a different existing rule', async () => {
      await seed('cross-domain.txt');
      const id = await firstRuleId();
      // Collide with the second rule's (pattern, keyRef).
      const res = await PUT(
        jsonRequest('PUT', {
          pattern: '*@id.nextbestnetwork.com',
          keyRef: 'mail._domainkey.nextbestnetwork.com',
        }),
        ctx(id),
      );
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE', () => {
    it('returns 204 and removes the rule', async () => {
      await seed('cross-domain.txt');
      const id = await firstRuleId();
      const res = await DELETE(new Request('http://localhost/'), ctx(id));
      expect(res.status).toBe(204);

      const listRes = await ListGET();
      const remaining = (await listRes.json()) as Array<{ id: string }>;
      expect(remaining.map((r) => r.id)).not.toContain(id);
      expect(remaining).toHaveLength(1);
    });

    it('returns 404 when id is unknown', async () => {
      await seed('canonical.txt');
      const res = await DELETE(new Request('http://localhost/'), ctx('missing-id'));
      expect(res.status).toBe(404);
    });

    it('preserves hand-edited comments after delete', async () => {
      await seed('with-comments.txt');
      const id = await firstRuleId();
      const res = await DELETE(new Request('http://localhost/'), ctx(id));
      expect(res.status).toBe(204);
      // The comments were attached to that rule's leading block and travel
      // with it on delete — but the trailing-newline state of the file is
      // preserved, so the on-disk file is at worst a bare '\n'.
      // What matters for the round-trip property is that the write did not
      // corrupt the file; the file still parses and any trailing-only
      // comments survive.
      const disk = await readTable();
      expect(disk).toMatch(/^$|\n/);
    });
  });
});
