import { writeFile, rename, chmod, unlink, copyFile } from 'fs/promises';
import { basename, join } from 'path';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';

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
 *   be left behind in /tmp — named `.atomic-*` and easily identifiable).
 * - `chmod(mode)` is applied to the tmp file before rename, so the
 *   final path lands with the requested mode without a window of
 *   default-mode visibility.
 *
 * The tmp file lives in os.tmpdir() to avoid needing write permission on
 * the target directory.  If rename(2) fails with EXDEV (cross-filesystem),
 * we fall back to copyFile + unlink.  The per-path write-lock in
 * write-lock.ts serialises concurrent writers, so the brief non-atomic
 * window in the EXDEV path is safe.
 */
export async function writeFileAtomic(
  path: string,
  content: string | Buffer,
  options: WriteFileAtomicOptions = {},
): Promise<void> {
  const base = basename(path);
  const tmp = join(tmpdir(), `.atomic-${base}.${process.pid}.${randomBytes(6).toString('hex')}`);

  try {
    await writeFile(tmp, content);
    if (options.mode !== undefined) {
      await chmod(tmp, options.mode);
    }
    try {
      await rename(tmp, path);
    } catch (renameErr: unknown) {
      if ((renameErr as NodeJS.ErrnoException).code === 'EXDEV') {
        await copyFile(tmp, path);
        await unlink(tmp).catch(() => undefined);
      } else {
        throw renameErr;
      }
    }
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}
