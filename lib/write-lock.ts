const tails = new Map<string, Promise<unknown>>();

/**
 * Serialize read-modify-write cycles against `path` within this process.
 *
 * Each call chains `fn` onto the tail promise for `path`. Calls against
 * different paths run concurrently. A rejection in `fn` does not poison
 * the queue — the next caller still gets a fresh run (the chain advances
 * past both fulfilments and rejections).
 *
 * This is an in-process mutex. It is *not* a filesystem-level lock; the
 * single-container deployment invariant (see README) is what makes this
 * a complete concurrency solution for the dashboard.
 */
export async function withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(path) ?? Promise.resolve();
  // Chain `fn` onto a settled-regardless continuation of `prev` so that a
  // rejection upstream does not propagate into `fn`'s invocation.
  const run = prev.then(fn, fn);
  // Persist a tail that ignores rejections — otherwise a failed `fn`
  // would mark the stored promise as unhandled.
  tails.set(
    path,
    run.catch(() => undefined),
  );
  try {
    return await run;
  } finally {
    // Best-effort cleanup: if we're still the tail, drop the map entry to
    // avoid unbounded growth. Harmless if another call has already queued.
    if (tails.get(path) !== undefined) {
      const current = tails.get(path);
      // Only clear if the current tail has settled — i.e. no pending work.
      current?.then(() => {
        if (tails.get(path) === current) {
          tails.delete(path);
        }
      });
    }
  }
}
