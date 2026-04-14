import { writeFile, rename, chmod, unlink } from 'fs/promises';
import { dirname, basename, join } from 'path';
import { randomBytes } from 'crypto';

export interface WriteFileAtomicOptions {
  mode?: number;
}

/**
 * Write `content` to `path` atomically via tmp-then-rename.
 *
 * Guarantees for the caller:
 * - A concurrent reader of `path` sees either the pre-state or the fully
 *   written post-state — never a partial file.
 * - If the process dies mid-write, `path` is untouched (the tmp file may
 *   be left behind — it's named `.<basename>.tmp.*` so it's excluded by
 *   `.gitignore` and easily distinguishable from real content).
 * - `chmod(mode)` is applied to the tmp file before rename, so the
 *   final path lands with the requested mode without a window of
 *   default-mode visibility.
 *
 * Same-directory tmp guarantees `rename(2)` stays on one filesystem
 * (cross-fs rename is not atomic on POSIX).
 */
export async function writeFileAtomic(
  path: string,
  content: string | Buffer,
  options: WriteFileAtomicOptions = {},
): Promise<void> {
  const dir = dirname(path);
  const base = basename(path);
  const tmp = join(dir, `.${base}.tmp.${process.pid}.${randomBytes(6).toString('hex')}`);

  try {
    await writeFile(tmp, content);
    if (options.mode !== undefined) {
      await chmod(tmp, options.mode);
    }
    await rename(tmp, path);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}
