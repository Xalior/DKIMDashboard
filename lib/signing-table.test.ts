import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

import {
  addRule,
  listRules,
  parseSigningTable,
  removeRule,
  reorderRules,
  serializeSigningTable,
  updateRule,
} from './signing-table';
import { DuplicateEntryError, NotFoundError } from './errors';

const FIXTURE_DIR = join(__dirname, '__fixtures__', 'signing-table');

async function loadFixture(name: string): Promise<string> {
  return readFile(join(FIXTURE_DIR, name), 'utf-8');
}

async function listFixtures(): Promise<string[]> {
  const entries = await readdir(FIXTURE_DIR);
  return entries.filter((e) => e.endsWith('.txt')).sort();
}

describe('parseSigningTable / serializeSigningTable (round-trip)', () => {
  it('round-trips every fixture byte-for-byte', async () => {
    const fixtures = await listFixtures();
    expect(fixtures.length).toBeGreaterThan(0);
    for (const name of fixtures) {
      const content = await loadFixture(name);
      const parsed = parseSigningTable(content);
      const serialized = serializeSigningTable(parsed);
      expect(serialized, `fixture ${name} did not round-trip`).toBe(content);
    }
  });

  it('detects CRLF and preserves it on serialize', async () => {
    const content = await loadFixture('crlf.txt');
    expect(content.includes('\r\n')).toBe(true);
    const parsed = parseSigningTable(content);
    expect(parsed.eol).toBe('\r\n');
    expect(serializeSigningTable(parsed)).toBe(content);
  });

  it('preserves files without a trailing newline', async () => {
    const content = await loadFixture('no-trailing-newline.txt');
    expect(content.endsWith('\n')).toBe(false);
    const parsed = parseSigningTable(content);
    expect(parsed.hasFinalNewline).toBe(false);
    expect(serializeSigningTable(parsed)).toBe(content);
  });

  it('parses empty content to an empty lines array', () => {
    const parsed = parseSigningTable('');
    expect(parsed.lines).toEqual([]);
    expect(parsed.hasFinalNewline).toBe(false);
    expect(serializeSigningTable(parsed)).toBe('');
  });

  it('assigns disambiguator suffixes to duplicate pre-existing rules', () => {
    const content =
      '*@a.example.com mail._domainkey.a.example.com\n' +
      '*@a.example.com mail._domainkey.a.example.com\n' +
      '*@a.example.com mail._domainkey.a.example.com\n';
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    expect(rules).toHaveLength(3);
    expect(rules[0].id).not.toBe(rules[1].id);
    expect(rules[1].id).not.toBe(rules[2].id);
    expect(rules[1].id).toMatch(/-2$/);
    expect(rules[2].id).toMatch(/-3$/);
    // First rule's base id is the prefix of the suffixed ones.
    expect(rules[1].id.startsWith(rules[0].id + '-')).toBe(true);
  });

  it('treats a single-token line as a malformed rule (keyRef empty)', () => {
    const content = 'refile:/etc/opendkim/CustomRules\n';
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    expect(rules).toEqual([
      expect.objectContaining({ pattern: 'refile:/etc/opendkim/CustomRules', keyRef: '' }),
    ]);
    expect(serializeSigningTable(parsed)).toBe(content);
  });

  it('attaches leading comment + blank to the rule below it', async () => {
    const content = await loadFixture('with-comments.txt');
    const parsed = parseSigningTable(content);
    const ruleLines = parsed.lines.filter((l) => l.kind === 'rule');
    expect(ruleLines).toHaveLength(1);
    const rule = ruleLines[0];
    if (rule.kind !== 'rule') throw new Error('unreachable');
    expect(rule.leading.map((p) => p.kind)).toEqual(['comment', 'comment', 'blank']);
  });

  it('captures trailing-only content (comments after the last rule)', async () => {
    const content = await loadFixture('mixed.txt');
    const parsed = parseSigningTable(content);
    const trailing = parsed.lines.find((l) => l.kind === 'trailing');
    expect(trailing).toBeDefined();
    if (trailing && trailing.kind === 'trailing') {
      // '# End of signing rules' plus a leading blank
      const kinds = trailing.lines.map((p) => p.kind);
      expect(kinds).toContain('comment');
    }
  });
});

describe('addRule', () => {
  it('appends a new canonical rule without touching existing lines', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseSigningTable(content);
    const next = addRule(parsed.lines, {
      pattern: '*@ursa.xalior.com',
      keyRef: 'mail._domainkey.clientmail.xalior.com',
    });
    const out = serializeSigningTable({ ...parsed, lines: next });
    expect(out.startsWith(content.trimEnd())).toBe(true);
    expect(out).toBe(
      '*@id.nextbestnetwork.com mail._domainkey.nextbestnetwork.com\n' +
        '*@ursa.xalior.com mail._domainkey.clientmail.xalior.com\n',
    );
  });

  it('inserts before the trailing block when one exists', async () => {
    const content = await loadFixture('mixed.txt');
    const parsed = parseSigningTable(content);
    const before = listRules(parsed.lines);
    const next = addRule(parsed.lines, {
      pattern: '*@newdomain.test',
      keyRef: 'mail._domainkey.newdomain.test',
    });
    const after = listRules(next);
    expect(after).toHaveLength(before.length + 1);
    // The new rule is the last rule; the trailing block still exists.
    const last = next[next.length - 1];
    expect(last.kind).toBe('trailing');
    const newRule = next[next.length - 2];
    expect(newRule.kind).toBe('rule');
    if (newRule.kind === 'rule') {
      expect(newRule.pattern).toBe('*@newdomain.test');
    }
  });

  it('throws DuplicateEntryError on identical pattern + keyRef', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseSigningTable(content);
    expect(() =>
      addRule(parsed.lines, {
        pattern: '*@id.nextbestnetwork.com',
        keyRef: 'mail._domainkey.nextbestnetwork.com',
      }),
    ).toThrow(DuplicateEntryError);
  });

  it('respects an explicit position (insert at the front)', async () => {
    const content = await loadFixture('cross-domain.txt');
    const parsed = parseSigningTable(content);
    const next = addRule(parsed.lines, {
      pattern: '*@first.example',
      keyRef: 'mail._domainkey.first.example',
      position: 0,
    });
    const rules = listRules(next);
    expect(rules[0].pattern).toBe('*@first.example');
  });
});

describe('updateRule', () => {
  it('changes only the target line and clears its rawLine', async () => {
    const content = await loadFixture('cross-domain.txt');
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    const targetId = rules[0].id;
    const next = updateRule(parsed.lines, targetId, {
      pattern: '*@ursa-renamed.xalior.com',
      keyRef: 'mail._domainkey.clientmail.xalior.com',
    });
    const out = serializeSigningTable({ ...parsed, lines: next });
    expect(out).toBe(
      '*@ursa-renamed.xalior.com mail._domainkey.clientmail.xalior.com\n' +
        '*@id.nextbestnetwork.com mail._domainkey.nextbestnetwork.com\n',
    );
  });

  it('throws NotFoundError on unknown id', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseSigningTable(content);
    expect(() =>
      updateRule(parsed.lines, 'nonexistent-id', { pattern: 'x', keyRef: 'y' }),
    ).toThrow(NotFoundError);
  });

  it('throws DuplicateEntryError when new content collides with a different rule', async () => {
    const content = await loadFixture('cross-domain.txt');
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    const firstId = rules[0].id;
    expect(() =>
      updateRule(parsed.lines, firstId, {
        pattern: rules[1].pattern,
        keyRef: rules[1].keyRef,
      }),
    ).toThrow(DuplicateEntryError);
  });

  it('allows self-update (pattern+keyRef unchanged) without a duplicate error', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    const targetId = rules[0].id;
    const next = updateRule(parsed.lines, targetId, {
      pattern: rules[0].pattern,
      keyRef: rules[0].keyRef,
    });
    const out = serializeSigningTable({ ...parsed, lines: next });
    expect(out).toBe(content);
  });
});

describe('removeRule', () => {
  it('removes the target rule and its leading block; other lines untouched', async () => {
    const content = await loadFixture('with-comments.txt');
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    const next = removeRule(parsed.lines, rules[0].id);
    const out = serializeSigningTable({ ...parsed, lines: next });
    // The rule, its two comment lines, and the blank line all vanish; the
    // original file's trailing newline is preserved as a lone '\n'.
    expect(out).toBe('\n');
  });

  it('keeps other rules and their leading blocks intact', async () => {
    // Two rules, each preceded by its own comment.
    const content =
      '# comment for rule A\n' +
      '*@a.example mail._domainkey.a.example\n' +
      '# comment for rule B\n' +
      '*@b.example mail._domainkey.b.example\n';
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    const next = removeRule(parsed.lines, rules[0].id);
    const out = serializeSigningTable({ ...parsed, lines: next });
    expect(out).toBe('# comment for rule B\n*@b.example mail._domainkey.b.example\n');
  });

  it('throws NotFoundError on unknown id', async () => {
    const content = await loadFixture('canonical.txt');
    const parsed = parseSigningTable(content);
    expect(() => removeRule(parsed.lines, 'nope')).toThrow(NotFoundError);
  });
});

describe('reorderRules', () => {
  it('rearranges rules per idList; leading blocks travel with their rules', () => {
    const content =
      '# comment for A\n' +
      '*@a.example mail._domainkey.a.example\n' +
      '# comment for B\n' +
      '*@b.example mail._domainkey.b.example\n';
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    const next = reorderRules(parsed.lines, [rules[1].id, rules[0].id]);
    const out = serializeSigningTable({ ...parsed, lines: next });
    expect(out).toBe(
      '# comment for B\n' +
        '*@b.example mail._domainkey.b.example\n' +
        '# comment for A\n' +
        '*@a.example mail._domainkey.a.example\n',
    );
  });

  it('keeps the trailing block at the end', async () => {
    const content = await loadFixture('mixed.txt');
    const parsed = parseSigningTable(content);
    const rules = listRules(parsed.lines);
    const reversed = rules.map((r) => r.id).reverse();
    const next = reorderRules(parsed.lines, reversed);
    expect(next[next.length - 1].kind).toBe('trailing');
  });

  it('throws when idList does not match current rules exactly', async () => {
    const content = await loadFixture('cross-domain.txt');
    const parsed = parseSigningTable(content);
    expect(() => reorderRules(parsed.lines, ['bogus'])).toThrow();
    expect(() => reorderRules(parsed.lines, [])).toThrow();
  });
});
