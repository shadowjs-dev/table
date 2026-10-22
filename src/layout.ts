/**
 * The `layout` feature: the rows of header cells (`getHeaderGroups`), the total width and the offset
 * of a column (`getStart`). Subpath: `@shadow-js/table/layout`. Without it the header rows and the
 * layout members throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import type { Side, TableHost } from "./internal/host";
import type { Column, Header, HeaderContext, HeaderGroup, TableFeature } from "./types";

/**
 * The `layout` feature: one header row per level of nested column groups, with a header per run of
 * neighboring leaves under one group. A leaf shallower than the deepest row is covered from above by
 * a placeholder, so every row has one cell per visible leaf. Install it in
 * `createTable({ features: [layout] })`.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { layout } from "@shadow-js/table/layout";
 *
 * interface Row {
 *   id: string;
 *   first: string;
 *   last: string;
 * }
 * const helper = createColumnHelper<Row>();
 * const table = createTable({
 *   data: [{ id: "1", first: "Ada", last: "Lovelace" }],
 *   columns: [
 *     helper.group({ id: "name", header: "Name", columns: [
 *       helper.accessor("first", { header: "First" }),
 *       helper.accessor("last", { header: "Last" }),
 *     ] }),
 *   ],
 *   getRowId: (row) => row.id,
 *   features: [layout],
 * });
 * console.log(table.getHeaderGroups().map((group) => group.headers.length)); // [1, 2]
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const layout: TableFeature<"layout"> = {
  name: "layout",
  install<TData>(host: TableHost<TData>): void {
    const { table, hooks } = host;
    const shown = (): Column<TData>[] => hooks.ordered().filter((column) => hooks.visible(column));

    /** The nearest ancestor of a leaf at a depth: the leaf itself when it is at that depth, else its group. */
    const ancestorAt = (leaf: Column<TData>, level: number): Column<TData> => {
      let cursor = leaf;
      while (cursor.depth > level && cursor.parent !== undefined) cursor = cursor.parent;
      return cursor;
    };

    /**
     * The headers of one row of the header groups. A run of neighboring leaves under one group becomes
     * one header that spans them. A leaf shallower than the row is covered from above, so it gets a
     * placeholder. A leaf is a header in its own row and spans down to the deepest row.
     */
    const headersAt = (
      leaves: readonly Column<TData>[],
      level: number,
      deepest: number,
    ): Header<TData>[] => {
      const runs: { column: Column<TData>; leaves: Column<TData>[]; placeholder: boolean }[] = [];
      for (const leaf of leaves) {
        if (leaf.depth < level) {
          runs.push({ column: leaf, leaves: [leaf], placeholder: true });
          continue;
        }
        const owner = ancestorAt(leaf, level);
        const last = runs[runs.length - 1];
        if (last !== undefined && !last.placeholder && last.column === owner)
          last.leaves.push(leaf);
        else runs.push({ column: owner, leaves: [leaf], placeholder: false });
      }
      return runs.map((run): Header<TData> => {
        const header: Header<TData> = {
          id: run.placeholder ? `${run.column.id}_placeholder_${level}` : run.column.id,
          column: run.column,
          colSpan: run.leaves.length,
          rowSpan: !run.placeholder && run.column.columns.length === 0 ? deepest - level + 1 : 1,
          depth: level,
          isPlaceholder: run.placeholder,
          getContext: (): HeaderContext<TData, unknown> => ({
            table,
            column: run.column,
            header,
          }),
          getSize: () => run.leaves.reduce((total, leaf) => total + hooks.size(leaf), 0),
        };
        return header;
      });
    };

    /** The offset of a column's leaves in a section: the widths of the shown leaves before them. */
    const startIn = (column: Column<TData>, side: Side): number => {
      const targets = host.targetsOf(column);
      let offset = 0;
      for (const leaf of hooks.sections(side)) {
        if (targets.includes(leaf)) return offset;
        offset += hooks.size(leaf);
      }
      return 0;
    };

    Object.assign(table, {
      getHeaderGroups: (): readonly HeaderGroup<TData>[] => {
        // The rows of headers cover the shown leaves in column order. A shallower leaf is shown in its
        // own row and gets a placeholder in each row below it, so every row has one cell per leaf.
        const leaves = shown();
        const deepest = leaves.reduce((max, leaf) => Math.max(max, leaf.depth), 0);
        const groups: HeaderGroup<TData>[] = [];
        if (leaves.length === 0) return groups;
        for (let level = 0; level <= deepest; level += 1) {
          groups.push({ depth: level, headers: headersAt(leaves, level, deepest) });
        }
        return groups;
      },
      getTotalSize: (): number => shown().reduce((total, column) => total + hooks.size(column), 0),
    });

    for (const column of host.columns) {
      Object.assign(column, {
        getStart: (position?: Side): number => {
          const targets = host.targetsOf(column);
          const visible = targets.find((leaf) => hooks.visible(leaf)) ?? targets[0];
          const side = position ?? (visible === undefined ? "center" : hooks.side(visible));
          return startIn(column, side);
        },
      });
    }
  },
};
