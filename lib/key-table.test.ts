import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

import {
  addEntry,
  listEntries,
  parseKeyTable,
  removeEntry,
  serializeKeyTable,
  updateEntry,
} from './key-table';
import { DuplicateEntryError, NotFoundError } from './errors';

const FIXTURE_DIR = join(__dirname, '__fixtures__', 'key-table');

async function loadFixture(name: string): Promise<string> {
  return readFile(join(FIXTURE_DIR, name), 'utf-8');
}

async function listFixtures(): Promise<string[]> {
  const entries = await readdir(FIXTURE_DIR);
  return entries.filter((e) => e.endsWith('.txt')).sort();
}

describe('parseKeyTable / serializeKeyTable (round-trip)', () => {
  it('round-trips every fixture byte-for-byte', async () => {
    const fixtures = await listFixtures();
    expect(fixtures.length).toBeGreaterThan(0);
    for (const name of fixtures) {
      const content = await loadFixture(name);
      const parsed = parseKeyTable(content);
      expect(serializeKeyTable(parsed), `fixture ${name} did not round-trip`).toBe(content);
    }
  });

  it('detects CRLF and preserves it on serialize', async () => {
    const content = await loadFixture('crlf.txt');
    expect(content.includes('\r\n')).toBe(true);
    const parsed = parseKeyTable(content);
    expect(parsed.eol).toBe('\r\n');
    expect(serializeKeyTable(parsed)).toBe(content);
  });

  it('preserves files without a trailing newline', async () => {
    const content = await loadFixture('no-trailing-newline.txt');
    expect(content.endsWith('\n')).toBe(false);
    const parsed = parseKeyTable(content);
    expect(parsed.hasFinalNewline).toBe(false);
    expect(serializeKeyTable(parsed)).toBe(content);
  });

  it('parses empty content to an empty lines array', () => {
    const parsed = parseKeyTable('');
    expect(parsed.lines).toEqual([]);
    expect(parsed.hasFinalNewline).toBe(false);
    expect(serializeKeyTable(parsed)).toBe('');
  });

  it('flags malformed entries and preserves them byte-for-byte', async () => {
    const content = await loadFixture('malformed.txt');
    const parsed = parseKeyTable(content);
    const entries = listEntries(parsed.lines);

    const malformed = entries.filter((e) => e.malformed);
    const canonical = entries.filter((e) => !e.malformed);

    // Two canonical (next...network, example) + two malformed (weirdSelector, placeholder_only).
    // The fourth canonical-looking line has a trailing inline-comment token, which
    // makes it a 3-token line; parts[1] still parses as domain:selector:keyPath,
    // so it is canonical with the comment preserved only via rawLine.
    expect(malformed).toHaveLength(2);
    expect(canonical).toHaveLength(2);

    // Round-trip including both kinds.
    expect(serializeKeyTable(parsed)).toBe(content);
  });

  it('keeps inline trailing comments via rawLine on untouched canonical entries', async () => {
    const content = await loadFixture('malformed.txt');
    const parsed = parseKeyTable(content);
    const entry = parsed.lines.find(
      (l) => l.kind === 'entry' && l.selectorDomain === 'mail._domainkey.example.com',
    );
    expect(entry).toBeDefined();
    if (entry && entry.kind === 'entry') {
      expect(entry.rawLine).toContain('# TODO: verify path');
    }
  });

  it('assigns disambiguator suffixes to duplicate pre-existing entries', () => {
    const content =
      'mail._domainkey.a.example a.example:mail:/etc/opendkim/keys/a.example/mail.private\n' +
      'mail._domainkey.a.example a.example:mail:/etc/opendkim/keys/a.example/mail.private\n' +
      'mail._domainkey.a.example a.example:mail:/etc/opendkim/keys/a.example/mail.private\n';
    const parsed = parseKeyTable(content);
    const entries = listEntries(parsed.lines);
    expect(entries).toHaveLength(3);
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(entries[1].id).not.toBe(entries[2].id);
    expect(entries[1].id).toMatch(/-2$/);
    expect(entries[2].id).toMatch(/-3$/);
  });

  it('attaches leading comments to the entry below', async () => {
    const content = await loadFixture('with-comments.txt');
    const parsed = parseKeyTable(content);
    const first = parsed.lines.find((l) => l.kind === 'entry');
    expect(first).toBeDefined();
    if (first && first.kind === 'entry') {
      expect(first.leading.map((p) => p.kind)).toEqual(['comment', 'comment', 'blank']);
    }
  });
});

describe('addEntry', () => {
  it('appends a new canonical entry, other lines byte-for-byte unchanged', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseKeyTable(content);
    const next = addEntry(parsed.lines, {
      selectorDomain: 'mail._domainkey.example.com',
      domain: 'example.com',
      selector: 'mail',
      keyPath: '/etc/opendkim/keys/example.com/mail.private',
    });
    const out = serializeKeyTable({ ...parsed, lines: next });
    expect(out).toBe(
      'mail._domainkey.nextbestnetwork.com nextbestnetwork.com:mail:/etc/opendkim/keys/nextbestnetwork.com/mail.private\n' +
        'mail._domainkey.example.com example.com:mail:/etc/opendkim/keys/example.com/mail.private\n',
    );
  });

  it('throws DuplicateEntryError when selectorDomain already exists', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseKeyTable(content);
    expect(() =>
      addEntry(parsed.lines, {
        selectorDomain: 'mail._domainkey.nextbestnetwork.com',
        domain: 'other.example',
        selector: 'mail',
        keyPath: '/etc/opendkim/keys/other.example/mail.private',
      }),
    ).toThrow(DuplicateEntryError);
  });

  it('inserts before the trailing block when one exists', () => {
    const content =
      'mail._domainkey.a.example a.example:mail:/etc/opendkim/keys/a.example/mail.private\n' +
      '\n' +
      '# trailing note\n';
    const parsed = parseKeyTable(content);
    const next = addEntry(parsed.lines, {
      selectorDomain: 'mail._domainkey.b.example',
      domain: 'b.example',
      selector: 'mail',
      keyPath: '/etc/opendkim/keys/b.example/mail.private',
    });
    expect(next[next.length - 1].kind).toBe('trailing');
    expect(next[next.length - 2].kind).toBe('entry');
  });
});

describe('updateEntry', () => {
  it('changes only the target and clears its rawLine (canonical re-emit)', async () => {
    const content = await loadFixture('with-comments.txt');
    const parsed = parseKeyTable(content);
    const entries = listEntries(parsed.lines);
    const targetId = entries[1].id;

    const next = updateEntry(parsed.lines, targetId, {
      selectorDomain: 'mail._domainkey.renamed.example',
      domain: 'renamed.example',
      selector: 'mail',
      keyPath: '/etc/opendkim/keys/renamed.example/mail.private',
    });
    const out = serializeKeyTable({ ...parsed, lines: next });

    // The first entry (with all its leading comments) is untouched.
    expect(out).toContain('# KeyTable — maps selectorDomain to domain:selector:keyPath');
    expect(out).toContain('# Managed by DKIM Dashboard');
    expect(out).toContain(
      'mail._domainkey.nextbestnetwork.com nextbestnetwork.com:mail:/etc/opendkim/keys/nextbestnetwork.com/mail.private',
    );
    // The second entry is rewritten in canonical form.
    expect(out).toContain(
      'mail._domainkey.renamed.example renamed.example:mail:/etc/opendkim/keys/renamed.example/mail.private',
    );
    expect(out).not.toContain('mail._domainkey.example.com ');
  });

  it('throws NotFoundError on unknown id', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseKeyTable(content);
    expect(() =>
      updateEntry(parsed.lines, 'no-such-id', {
        selectorDomain: 'x',
        domain: 'x',
        selector: 'm',
        keyPath: '/tmp/x',
      }),
    ).toThrow(NotFoundError);
  });

  it('throws DuplicateEntryError when new selectorDomain collides with another entry', async () => {
    const content = await loadFixture('with-comments.txt');
    const parsed = parseKeyTable(content);
    const entries = listEntries(parsed.lines);
    const firstId = entries[0].id;

    expect(() =>
      updateEntry(parsed.lines, firstId, {
        selectorDomain: entries[1].selectorDomain, // collide with entry #2
        domain: 'whatever',
        selector: 'mail',
        keyPath: '/tmp/x',
      }),
    ).toThrow(DuplicateEntryError);
  });

  it('promotes a malformed entry to canonical via updateEntry', async () => {
    const content = await loadFixture('malformed.txt');
    const parsed = parseKeyTable(content);
    const entries = listEntries(parsed.lines);
    const malformed = entries.find((e) => e.malformed);
    expect(malformed).toBeDefined();
    if (!malformed) return;

    const next = updateEntry(parsed.lines, malformed.id, {
      selectorDomain: 'mail._domainkey.fixed.example',
      domain: 'fixed.example',
      selector: 'mail',
      keyPath: '/etc/opendkim/keys/fixed.example/mail.private',
    });
    const out = serializeKeyTable({ ...parsed, lines: next });
    expect(out).toContain(
      'mail._domainkey.fixed.example fixed.example:mail:/etc/opendkim/keys/fixed.example/mail.private',
    );
    expect(out).not.toContain(malformed.rawLine.trim());
  });
});

describe('removeEntry', () => {
  it('removes the target entry and its leading block; others unchanged', () => {
    const content =
      '# comment for A\n' +
      'mail._domainkey.a.example a.example:mail:/etc/opendkim/keys/a.example/mail.private\n' +
      '# comment for B\n' +
      'mail._domainkey.b.example b.example:mail:/etc/opendkim/keys/b.example/mail.private\n';
    const parsed = parseKeyTable(content);
    const entries = listEntries(parsed.lines);
    const next = removeEntry(parsed.lines, entries[0].id);
    const out = serializeKeyTable({ ...parsed, lines: next });
    expect(out).toBe(
      '# comment for B\n' +
        'mail._domainkey.b.example b.example:mail:/etc/opendkim/keys/b.example/mail.private\n',
    );
  });

  it('can remove a malformed entry while keeping canonical neighbours intact', async () => {
    const content = await loadFixture('malformed.txt');
    const parsed = parseKeyTable(content);
    const entries = listEntries(parsed.lines);
    const malformed = entries.find((e) => e.malformed);
    expect(malformed).toBeDefined();
    if (!malformed) return;

    const beforeCanonical = entries.filter((e) => !e.malformed);
    const next = removeEntry(parsed.lines, malformed.id);
    const after = listEntries(next);
    const afterCanonical = after.filter((e) => !e.malformed);
    expect(afterCanonical.map((e) => e.id)).toEqual(beforeCanonical.map((e) => e.id));
  });

  it('throws NotFoundError on unknown id', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseKeyTable(content);
    expect(() => removeEntry(parsed.lines, 'nope')).toThrow(NotFoundError);
  });
});
