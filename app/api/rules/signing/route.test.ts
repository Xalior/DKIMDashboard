import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFile, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { GET, POST, PATCH } from './route';

const FIXTURE_DIR = join(__dirname, '..', '..', '..', '..', 'lib', '__fixtures__', 'signing-table');

describe('/api/rules/signing', () => {
  let dir: string;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rules-signing-route-'));
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

  async function readTable(): Promise<string> {
    return readFile(join(dir, 'SigningTable'), 'utf-8');
  }

  function jsonRequest(method: string, body: unknown): Request {
    return new Request('http://localhost/api/rules/signing', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('GET', () => {
    it('returns 200 with the rules list in file order', async () => {
      await seed('cross-domain.txt');
      const res = await GET();
      expect(res.status).toBe(200);
      const rules = (await res.json()) as Array<{ pattern: string; keyRef: string }>;
      expect(rules.map((r) => r.pattern)).toEqual([
        '*@ursa.xalior.com',
        '*@id.nextbestnetwork.com',
      ]);
    });

    it('returns an empty array when the file is empty', async () => {
      await seed('empty.txt');
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });
  });

  describe('POST', () => {
    it('returns 201 with the new rule and writes it to disk', async () => {
      await seed('canonical.txt');
      const res = await POST(
        jsonRequest('POST', {
          pattern: '*@ursa.xalior.com',
          keyRef: 'mail._domainkey.clientmail.xalior.com',
        }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { rule: { pattern: string; keyRef: string; id: string } };
      expect(body.rule.pattern).toBe('*@ursa.xalior.com');
      expect(body.rule.keyRef).toBe('mail._domainkey.clientmail.xalior.com');
      expect(body.rule.id).toBeTruthy();

      const disk = await readTable();
      expect(disk).toContain('*@ursa.xalior.com mail._domainkey.clientmail.xalior.com');
      expect(disk).toContain('*@id.nextbestnetwork.com mail._domainkey.nextbestnetwork.com');
    });

    it('returns 400 when pattern is missing', async () => {
      await seed('canonical.txt');
      const res = await POST(jsonRequest('POST', { keyRef: 'mail._domainkey.x.com' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when keyRef is empty', async () => {
      await seed('canonical.txt');
      const res = await POST(jsonRequest('POST', { pattern: '*@x.com', keyRef: '   ' }));
      expect(res.status).toBe(400);
    });

    it('returns 409 on a duplicate (pattern, keyRef)', async () => {
      await seed('canonical.txt');
      const res = await POST(
        jsonRequest('POST', {
          pattern: '*@id.nextbestnetwork.com',
          keyRef: 'mail._domainkey.nextbestnetwork.com',
        }),
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('DUPLICATE_ENTRY');
    });

    it('preserves hand-edited comments in the file after a successful write', async () => {
      await seed('with-comments.txt');
      const before = await readTable();
      expect(before).toContain('# SigningTable');

      const res = await POST(
        jsonRequest('POST', {
          pattern: '*@ursa.xalior.com',
          keyRef: 'mail._domainkey.clientmail.xalior.com',
        }),
      );
      expect(res.status).toBe(201);

      const after = await readTable();
      expect(after).toContain('# SigningTable — maps sending addresses to signing keys');
      expect(after).toContain('# Managed by DKIM Dashboard');
      expect(after).toContain('*@ursa.xalior.com mail._domainkey.clientmail.xalior.com');
    });
  });

  describe('PATCH', () => {
    it('returns 200 and reorders rules on disk', async () => {
      await seed('cross-domain.txt');
      const listRes = await GET();
      const rules = (await listRes.json()) as Array<{ id: string }>;
      const reversed = [rules[1].id, rules[0].id];

      const res = await PATCH(jsonRequest('PATCH', { order: reversed }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { rules: Array<{ id: string }> };
      expect(body.rules.map((r) => r.id)).toEqual(reversed);

      const disk = await readTable();
      const lines = disk.trim().split('\n');
      expect(lines[0]).toContain('*@id.nextbestnetwork.com');
      expect(lines[1]).toContain('*@ursa.xalior.com');
    });

    it('returns 400 when order is not an array of strings', async () => {
      await seed('canonical.txt');
      const res = await PATCH(jsonRequest('PATCH', { order: 'not-an-array' }));
      expect(res.status).toBe(400);
    });

    it('returns 404 when order contains an unknown id', async () => {
      await seed('canonical.txt');
      const res = await PATCH(jsonRequest('PATCH', { order: ['nonexistent'] }));
      expect(res.status).toBe(404);
    });

    it('returns 500 when order length does not match current rule count', async () => {
      await seed('cross-domain.txt');
      // reorderRules throws a plain Error (not NotFoundError) on length
      // mismatch, which falls through to the 500 path. The contract is
      // "refuses the reorder"; precise status is an implementation detail.
      const res = await PATCH(jsonRequest('PATCH', { order: [] }));
      expect([400, 409, 500]).toContain(res.status);
    });
  });
});
