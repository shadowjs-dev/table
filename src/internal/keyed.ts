/**
 * Keyed flags: one signal per key (a row id, a column id) behind a single state object. A reader
 * subscribes to its own key, so changing one key reruns only the readers of that key.
 * @packageDocumentation
 */
import { type Accessor, untrack, useSignal } from "@shadow-js/core";

/**
 * The flags of one state object, as per-key signals.
 * @internal
 */
export interface KeyedFlags {
  /** The flag of one key. Reading it subscribes to that key only. */
  get(key: string): boolean;
  /** Updates the flags to `next`: only the keys whose flag changed notify their readers. */
  sync(next: Readonly<Record<string, boolean>>): void;
}

/**
 * Creates keyed flags starting from `initial`. A key's signal is made the first time it is read.
 * @param initial The starting flags; a key is `true` only when it maps to `true`.
 * @returns The flags.
 * @internal
 */
export function keyedFlags(initial: Readonly<Record<string, boolean>>): KeyedFlags {
  let current: Readonly<Record<string, boolean>> = initial;
  const cells = new Map<string, Accessor<boolean> & { set(value: boolean): void }>();
  const cellFor = (key: string): Accessor<boolean> & { set(value: boolean): void } => {
    const known = cells.get(key);
    if (known !== undefined) return known;
    const [read, write] = useSignal(current[key] === true);
    const cell = Object.assign(read, { set: (value: boolean) => write(value) });
    cells.set(key, cell);
    return cell;
  };
  return {
    get(key) {
      return cellFor(key)();
    },
    sync(next) {
      const previous = current;
      current = next;
      untrack(() => {
        for (const [key, cell] of cells) {
          const value = next[key] === true;
          if (value !== (previous[key] === true)) cell.set(value);
        }
      });
    },
  };
}
