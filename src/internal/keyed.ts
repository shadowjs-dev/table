/**
 * Keyed flags: one signal per key (a row id, a column id) behind a single state object. A reader
 * subscribes to its own key, so changing one key reruns only the readers of that key.
 * @packageDocumentation
 */
import { getOwner, onCleanup, untrack, useSignal } from "@shadow-js/core";

/**
 * The flags of one state object, as per-key signals.
 * @internal
 */
export interface KeyedFlags {
  /** The flag of one key. Reading it subscribes to that key only. */
  get(key: string): boolean;
  /** Updates the flags to `next`: only the keys whose flag changed notify their readers. */
  sync(next: Readonly<Record<string, boolean>>): void;
  /** How many keys have a signal right now: development builds only (tests and diagnostics), `undefined` in production. */
  readonly size?: number;
}

/** The cells a set of flags holds before it first looks for cells of keys that are gone. */
const SWEEP_FROM = 512;

/**
 * Creates keyed flags starting from `initial`. A key's signal is made the first time it is read.
 *
 * The cells are bounded when `live` is given: each time the number of cells doubles (from 512), the keys `live()` no longer
 * reports are dropped, so a table whose row ids keep changing holds cells for about twice its live rows, not for every id it ever
 * saw. A dropped key costs nothing: its next read makes a new cell from the current state, so the value is never lost. A key
 * that a computation or effect read is never dropped while that owner lives (it is released when the owner re-runs or is
 * disposed), so an observer of a row that leaves the data and comes back hears of its changes.
 * @param initial The starting flags; a key is `true` only when it maps to `true`.
 * @param live Returns, once per sweep, the test for the keys that are still in use (rows of the data, group rows).
 * @returns The flags.
 * @internal
 */
export function keyedFlags(
  initial: Readonly<Record<string, boolean>>,
  live?: () => { has(key: string): boolean },
): KeyedFlags {
  let current: Readonly<Record<string, boolean>> = initial;
  let sweepAt = SWEEP_FROM;
  /** How many live owners read each key: such a cell is not swept, because its readers are subscribed to it. */
  const watchers = new Map<string, number>();
  const cells = new Map<string, ReturnType<typeof useSignal<boolean>>>();
  const cellFor = (key: string): ReturnType<typeof useSignal<boolean>> => {
    const known = cells.get(key);
    if (known !== undefined) return known;
    if (live !== undefined && cells.size >= sweepAt) {
      const kept = untrack(live);
      for (const each of cells.keys())
        if (!kept.has(each) && !watchers.has(each)) cells.delete(each);
      sweepAt = Math.max(SWEEP_FROM, cells.size * 2);
    }
    const cell = useSignal(current[key] === true);
    cells.set(key, cell);
    return cell;
  };
  const flags: KeyedFlags = {
    get(key) {
      const cell = cellFor(key);
      if (live !== undefined && getOwner() !== null) {
        watchers.set(key, (watchers.get(key) ?? 0) + 1);
        onCleanup(() => {
          const left = (watchers.get(key) ?? 0) - 1;
          if (left > 0) watchers.set(key, left);
          else watchers.delete(key);
        });
      }
      return cell[0]();
    },
    sync(next) {
      const previous = current;
      current = next;
      untrack(() => {
        for (const [key, cell] of cells) {
          const value = next[key] === true;
          if (value !== (previous[key] === true)) cell[1](value);
        }
      });
    },
  };
  // A diagnostic: production bundles do not carry it.
  if (__DEV__) Object.defineProperty(flags, "size", { get: () => cells.size });
  return flags;
}
