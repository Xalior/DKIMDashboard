import { describe, expect, it } from 'vitest';

import { withLock } from './write-lock';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('withLock', () => {
  it('serialises two calls on the same path', async () => {
    const path = '/tmp/lock-serial';
    let inflight = 0;
    let maxInflight = 0;

    const task = async () => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
      return 'ok';
    };

    await Promise.all([withLock(path, task), withLock(path, task), withLock(path, task)]);

    expect(maxInflight).toBe(1);
  });

  it('runs different paths concurrently', async () => {
    const pathA = '/tmp/lock-parallel-a';
    const pathB = '/tmp/lock-parallel-b';

    const a = deferred<void>();
    const b = deferred<void>();

    // Each task resolves its own deferred, then waits for the other's deferred.
    // If the lock serialised across paths, this would deadlock; concurrent
    // execution lets both resolve.
    const runA = withLock(pathA, async () => {
      a.resolve();
      await b.promise;
      return 'a-done';
    });
    const runB = withLock(pathB, async () => {
      b.resolve();
      await a.promise;
      return 'b-done';
    });

    const results = await Promise.race([
      Promise.all([runA, runB]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('deadlock: tasks on different paths did not run concurrently')), 200)),
    ]);

    expect(results).toEqual(['a-done', 'b-done']);
  });

  it('does not poison the queue when a task rejects', async () => {
    const path = '/tmp/lock-reject';

    const first = withLock(path, async () => {
      throw new Error('first failed');
    });
    const second = withLock(path, async () => 'second-ok');

    await expect(first).rejects.toThrow('first failed');
    await expect(second).resolves.toBe('second-ok');
  });

  it('preserves ordering: a second call starts only after the first resolves', async () => {
    const path = '/tmp/lock-order';
    const order: string[] = [];
    const gate = deferred<void>();

    const first = withLock(path, async () => {
      order.push('first-start');
      await gate.promise;
      order.push('first-end');
    });
    const second = withLock(path, async () => {
      order.push('second-start');
    });

    // Give the event loop a few ticks so `second` would run if unlocked.
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['first-start']);

    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });
});
