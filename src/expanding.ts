/**
 * The `expanding` feature: sub rows shown under their parent row, expanded and collapsed by the
 * expanded state. Subpath: `@shadow-js/table/expanding`. Without it the row model shows only the
 * root rows, and the expansion members throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import { untrack, useMemo } from "@shadow-js/core";
import { type TableHost, untracked } from "./internal/host";
import { keyedFlags } from "./internal/keyed";
import { walk } from "./internal/tree";
import type { TableFeature } from "./types";

/**
 * The `expanding` feature: the sub rows of a row are shown under it while it is expanded. Install it
 * in `createTable({ features: [expanding] })`.
 *
 * The expanded state maps row ids to `true`, or is `true` for every row. Setting `enableExpanding`
 * to `false` keeps every row collapsed. A row shows its children only when it has some.
 *
 * @example
 * ```ts
 * import { createTable } from "@shadow-js/table";
 * import { expanding } from "@shadow-js/table/expanding";
 *
 * interface Folder {
 *   id: string;
 *   name: string;
 *   children?: Folder[];
 * }
 * const table = createTable<Folder>({
 *   data: [{ id: "a", name: "src", children: [{ id: "b", name: "index.ts" }] }],
 *   columns: [],
 *   getRowId: (row) => row.id,
 *   getSubRows: (row) => row.children,
 *   features: [expanding],
 * });
 * table.getRow("a")?.toggleExpanded(true);
 * console.log(table.getRowModel().rows.length); // 2: the row and its expanded sub row
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const expanding: TableFeature<"expanding"> = {
  name: "expanding",
  install<TData>(host: TableHost<TData>): void {
    const { table, options, hooks, initial } = host;
    const expandedSlice = host.slice("expanded", {}, (next) =>
      flags.sync(next === true ? {} : next),
    );
    // Every write goes through the slice, so the per-row flags can never disagree with the state.
    const started = untrack(expandedSlice.current);
    const flags = keyedFlags(started === true ? {} : started, host.liveRowIds);

    /** Whether every row is expanded: a memo, so the readers of one row hear of nothing else. */
    const all = useMemo(() => expandedSlice.current() === true);

    /** Whether a row is expanded: from its own flag when the state is uncontrolled. */
    const isExpanded = (id: string): boolean => {
      if (all()) return true;
      // Not "every row", so the state is the map.
      return expandedSlice.controlled
        ? (expandedSlice.current() as Record<string, boolean>)[id] === true
        : flags.get(id);
    };

    hooks.expands = hooks.isExpanded = (row) => isExpanded(row.id);
    hooks.canExpand = (row) =>
      host.grouped().childrenOf(row).length > 0 && options.enableExpanding !== false;
    hooks.toggleRow = untracked((row, value) => {
      const next = value ?? !isExpanded(row.id);
      const current = expandedSlice.current();
      const base: Record<string, boolean> = {};
      if (current === true) {
        // "Every row" becomes the map of every row with sub rows, so only this row changes.
        const shown = host.grouped();
        walk(shown.roots, shown.childrenOf, (each) => {
          if (shown.childrenOf(each).length > 0) base[each.id] = true;
        });
      } else Object.assign(base, current);
      expandedSlice.set({ ...base, [row.id]: next });
    });

    Object.assign(table, {
      resetExpanded: (): void => table.setExpanded(initial.expanded ?? {}),
      getIsAllRowsExpanded: all,
      getCanSomeRowsExpand: (): boolean =>
        [...host.core().rowsById.values()].some((row) => row.subRows.length > 0),
      toggleAllRowsExpanded: untracked((value?: boolean): void => {
        const next = value ?? !all();
        table.setExpanded(next ? true : {});
      }),
    });
  },
};
