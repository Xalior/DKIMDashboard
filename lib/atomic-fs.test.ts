import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile as realWriteFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { writeFileAtomic } from './atomic-fs';

describe('writeFileAtomic', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'atomic-fs-test-'));
  });

  afterEach(async () => {
    // Restore write mode before rm in case a test set the dir read-only.
    await chmod(dir, 0o700).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  });

  it('writes content that is visible at the target path after rename', async () => {
    const target = join(dir, 'file.txt');
    await writeFileAtomic(target, 'hello world');
    expect(await readFile(target, 'utf-8')).toBe('hello world');
  });

  it('overwrites an existing file without a partial-state window', async () => {
    const target = join(dir, 'file.txt');
    await realWriteFile(target, 'original');
    await writeFileAtomic(target, 'replaced');
    expect(await readFile(target, 'utf-8')).toBe('replaced');
  });

  it('leaves no tmp files in the directory after a successful write', async () => {
    const target = join(dir, 'file.txt');
    await writeFileAtomic(target, 'content');
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.includes('.tmp.'))).toEqual([]);
    expect(entries).toContain('file.txt');
  });

  it('applies the requested mode to the final path', async () => {
    const target = join(dir, 'file.txt');
    await writeFileAtomic(target, 'content', { mode: 0o600 });
    const st = await stat(target);
    // Lower 9 bits are the permission bits.
    expect(st.mode & 0o777).toBe(0o600);
  });

  it('leaves the target untouched when the tmp write fails', async () => {
    const target = join(dir, 'file.txt');
    await realWriteFile(target, 'original');
    // Force writeFile(tmp) to fail by making the directory read-only.
    await chmod(dir, 0o500);

    await expect(writeFileAtomic(target, 'replaced')).rejects.toThrow();

    await chmod(dir, 0o700);
    expect(await readFile(target, 'utf-8')).toBe('original');
  });

  it('cleans up the tmp file after a caught failure', async () => {
    const target = join(dir, 'file.txt');
    // Put a directory at the target path. The tmp write succeeds (sibling
    // file), but rename of a regular file onto a non-empty directory path
    // fails with EISDIR/ENOTDIR — exactly the cleanup path we want to test.
    await mkdir(target);
    await realWriteFile(join(target, 'blocker'), 'x');

    await expect(writeFileAtomic(target, 'content')).rejects.toThrow();

    const entries = await readdir(dir);
    const tmpLeftovers = entries.filter((e) => e.includes('.tmp.'));
    expect(tmpLeftovers).toEqual([]);
    // Target is still a directory — we didn't clobber it.
    expect((await stat(target)).isDirectory()).toBe(true);
  });
});
