import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

import {
  addEntry,
  listEntries,
  parseTrustedHosts,
  removeEntry,
  serializeTrustedHosts,
  updateEntry,
} from './trusted-hosts';
import { DuplicateEntryError, NotFoundError } from './errors';

const FIXTURE_DIR = join(__dirname, '__fixtures__', 'trusted-hosts');

async function loadFixture(name: string): Promise<string> {
  return readFile(join(FIXTURE_DIR, name), 'utf-8');
}

async function listFixtures(): Promise<string[]> {
  const entries = await readdir(FIXTURE_DIR);
  return entries.filter((e) => e.endsWith('.txt')).sort();
}

describe('parseTrustedHosts / serializeTrustedHosts (round-trip)', () => {
  it('round-trips every fixture byte-for-byte', async () => {
    const fixtures = await listFixtures();
    expect(fixtures.length).toBeGreaterThan(0);
    for (const name of fixtures) {
      const content = await loadFixture(name);
      const parsed = parseTrustedHosts(content);
      expect(serializeTrustedHosts(parsed), `fixture ${name} did not round-trip`).toBe(content);
    }
  });

  it('detects CRLF and preserves it on serialize', async () => {
    const content = await loadFixture('crlf.txt');
    expect(content.includes('\r\n')).toBe(true);
    const parsed = parseTrustedHosts(content);
    expect(parsed.eol).toBe('\r\n');
    expect(serializeTrustedHosts(parsed)).toBe(content);
  });

  it('parses empty content to an empty lines array', () => {
    const parsed = parseTrustedHosts('');
    expect(parsed.lines).toEqual([]);
    expect(parsed.hasFinalNewline).toBe(false);
    expect(serializeTrustedHosts(parsed)).toBe('');
  });

  it('flags refile: directives with isRefile: true', async () => {
    const content = await loadFixture('with-refile.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    const refile = entries.find((e) => e.isRefile);
    expect(refile).toBeDefined();
    expect(refile?.value).toBe('refile:/etc/opendkim/IgnoreHosts');
    // Non-refile entries are correctly flagged too.
    expect(entries.filter((e) => !e.isRefile).map((e) => e.value)).toEqual([
      '127.0.0.1',
      '::1',
      'mail.example.com',
    ]);
  });

  it('extracts the inline comment even when the value has internal whitespace', () => {
    // Regression: a user on /trusted-hosts/new entered
    // "10.0.0.0/8, 192.168.1.0/24" in the Value field plus "internals" in
    // the inline-comment field. The stored line became
    // "10.0.0.0/8, 192.168.1.0/24 # internals". The parser must still
    // identify "# internals" as the inline comment so the UI can display
    // it and a subsequent edit can carry it through.
    const content = '10.0.0.0/8, 192.168.1.0/24 # internals\n';
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    expect(entries).toHaveLength(1);
    expect(entries[0].value).toBe('10.0.0.0/8, 192.168.1.0/24');
    expect(entries[0].inlineComment).toBe('# internals');
    // Round-trip still byte-for-byte (rawLine path).
    expect(serializeTrustedHosts(parsed)).toBe(content);
  });

  it('captures inline trailing comments', async () => {
    const content = await loadFixture('inline-comments.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    expect(entries.map((e) => e.inlineComment)).toEqual([
      '# loopback',
      '# office network',
      '#lab',
      '# primary MX',
    ]);
    // Round-trip holds byte-for-byte, including the quirky double-space /
    // no-space comment separators.
    expect(serializeTrustedHosts(parsed)).toBe(content);
  });

  it('attaches leading comments + blanks to the entry below', async () => {
    const content = await loadFixture('with-comments.txt');
    const parsed = parseTrustedHosts(content);
    const entryLines = parsed.lines.filter((l) => l.kind === 'entry');
    expect(entryLines.length).toBeGreaterThan(0);
    const first = entryLines[0];
    if (first.kind !== 'entry') throw new Error('unreachable');
    // Preceded by: 2 comments + 1 blank + 1 comment.
    expect(first.leading.map((p) => p.kind)).toEqual(['comment', 'comment', 'blank', 'comment']);
  });

  it('assigns disambiguator suffixes to duplicate pre-existing entries', () => {
    const content = '127.0.0.1\n127.0.0.1\n127.0.0.1\n';
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    expect(entries).toHaveLength(3);
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(entries[1].id).toMatch(/-2$/);
    expect(entries[2].id).toMatch(/-3$/);
  });
});

describe('addEntry', () => {
  it('appends a new entry; other lines byte-for-byte unchanged', async () => {
    const content = await loadFixture('single-entry.txt');
    const parsed = parseTrustedHosts(content);
    const next = addEntry(parsed.lines, { value: '127.0.0.1' });
    const out = serializeTrustedHosts({ ...parsed, lines: next });
    expect(out).toBe('0.0.0.0/0\n127.0.0.1\n');
  });

  it('throws DuplicateEntryError when value already exists', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseTrustedHosts(content);
    expect(() => addEntry(parsed.lines, { value: '127.0.0.1' })).toThrow(DuplicateEntryError);
  });

  it('inserts before the trailing block when one exists', () => {
    const content = '127.0.0.1\n\n# trailing note\n';
    const parsed = parseTrustedHosts(content);
    const next = addEntry(parsed.lines, { value: '10.0.0.0/8' });
    // Structure: entry ('127.0.0.1'), entry ('10.0.0.0/8'), trailing.
    expect(next[next.length - 1].kind).toBe('trailing');
    expect(next[next.length - 2].kind).toBe('entry');
  });

  it('respects position for front insertion', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseTrustedHosts(content);
    const next = addEntry(parsed.lines, { value: 'first.example', position: 0 });
    const entries = listEntries(next);
    expect(entries[0].value).toBe('first.example');
  });
});

describe('updateEntry (inline-comment preservation deviation)', () => {
  it('preserves an existing inline comment by default (deviation from plan)', async () => {
    const content = await loadFixture('inline-comments.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    const target = entries.find((e) => e.value === '10.0.0.0/8');
    expect(target?.inlineComment).toBe('# office network');
    if (!target) return;

    const next = updateEntry(parsed.lines, target.id, { value: '172.16.0.0/12' });
    const out = serializeTrustedHosts({ ...parsed, lines: next });
    // Edited line is in canonical form (single space separator) but retains
    // the original inline comment.
    expect(out).toContain('172.16.0.0/12 # office network');
    // Other lines untouched byte-for-byte, including their original quirky
    // comment spacing.
    expect(out).toContain('127.0.0.1 # loopback');
    expect(out).toContain('192.168.1.0/24 #lab');
    expect(out).toContain('mail.example.com # primary MX');
  });

  it('drops the inline comment when caller passes an empty string', async () => {
    const content = await loadFixture('inline-comments.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    const target = entries.find((e) => e.value === '192.168.1.0/24');
    if (!target) return;

    const next = updateEntry(parsed.lines, target.id, { value: '192.168.2.0/24', inlineComment: '' });
    const out = serializeTrustedHosts({ ...parsed, lines: next });
    // Canonical line without inline comment.
    expect(out).toContain('\n192.168.2.0/24\n');
    expect(out).not.toContain('192.168.2.0/24 #');
  });

  it('replaces the inline comment when caller passes a new one', async () => {
    const content = await loadFixture('inline-comments.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    const target = entries.find((e) => e.value === '127.0.0.1');
    if (!target) return;

    const next = updateEntry(parsed.lines, target.id, {
      value: '127.0.0.1',
      inlineComment: '# replaced',
    });
    const out = serializeTrustedHosts({ ...parsed, lines: next });
    expect(out).toContain('127.0.0.1 # replaced');
    expect(out).not.toContain('127.0.0.1 # loopback');
  });

  it('throws NotFoundError on unknown id', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseTrustedHosts(content);
    expect(() => updateEntry(parsed.lines, 'nope', { value: 'x' })).toThrow(NotFoundError);
  });

  it('throws DuplicateEntryError when new value collides with another entry', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    const firstId = entries[0].id;
    expect(() =>
      updateEntry(parsed.lines, firstId, { value: entries[1].value }),
    ).toThrow(DuplicateEntryError);
  });

  it('allows self-update (same value) without duplicate error', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    const target = entries[0];
    const next = updateEntry(parsed.lines, target.id, { value: target.value });
    // Value unchanged, rawLine cleared → canonical re-emit. Output is
    // semantically identical but may differ if the original line had odd
    // whitespace. For canonical.txt (clean single-token lines) it's exact.
    const out = serializeTrustedHosts({ ...parsed, lines: next });
    expect(out).toBe(await loadFixture('canonical.txt'));
  });
});

describe('removeEntry', () => {
  it('removes the target entry and its leading block; others unchanged', async () => {
    const content = await loadFixture('with-comments.txt');
    const parsed = parseTrustedHosts(content);
    const entries = listEntries(parsed.lines);
    const target = entries.find((e) => e.value === '10.0.0.0/8');
    if (!target) return;
    const next = removeEntry(parsed.lines, target.id);
    const out = serializeTrustedHosts({ ...parsed, lines: next });
    // The '# Office network' comment above 10.0.0.0/8 went with it.
    expect(out).not.toContain('# Office network');
    expect(out).not.toContain('10.0.0.0/8');
    // Other entries and their leading blocks are intact.
    expect(out).toContain('# Localhost');
    expect(out).toContain('127.0.0.1');
    expect(out).toContain('mail.example.com');
  });

  it('throws NotFoundError on unknown id', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseTrustedHosts(content);
    expect(() => removeEntry(parsed.lines, 'nope')).toThrow(NotFoundError);
  });
});
