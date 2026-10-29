/**
 * The `faceting` feature: what a column's filter leaves in the table, as the rows, unique values and
 * numeric range of one column. Subpath: `@shadow-js/table/faceting`. Without it the facet members of a
 * column throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import type { TableHost } from "./internal/host";
import { subRowsOf, walk } from "./internal/tree";
import type { Column, Row, TableFeature } from "./types";

/**
 * The `faceting` feature: the values a filter would leave, for filter widgets. Each facet ignores the
 * filter of its own column, so a column's choices stay visible while it is filtered. Install it in
 * `createTable({ features: [faceting] })`.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { faceting } from "@shadow-js/table/faceting";
 *
 * interface Row {
 *   id: string;
 *   color: string;
 * }
 * const helper = createColumnHelper<Row>();
 * const table = createTable({
 *   data: [{ id: "1", color: "red" }, { id: "2", color: "red" }, { id: "3", color: "blue" }],
 *   columns: [helper.accessor("color", { header: "Color" })],
 *   getRowId: (row) => row.id,
 *   features: [faceting],
 * });
 * console.log(table.getColumn("color")?.getFacetedUniqueValues().get("red")); // 2
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const faceting: TableFeature<"faceting"> = {
  name: "faceting",
  install<TData>(host: TableHost<TData>): void {
    // Every kept row of the tree, once; the column's own filter is left out.
    const eachKept = (column: Column<TData>, visit: (row: Row<TData>) => void): void => {
      const kept = host.keepFor(column.id);
      walk(host.core().roots, subRowsOf, (row) => {
        if (kept.has(row.id)) visit(row);
      });
    };
    for (const column of host.columns) {
      Object.assign(column, {
        getFacetedRowModel: (): readonly Row<TData>[] => {
          const kept = host.keepFor(column.id);
          return host.core().roots.filter((row) => kept.has(row.id));
        },
        getFacetedUniqueValues: (): Map<unknown, number> => {
          const counts = new Map<unknown, number>();
          eachKept(column, (row) => {
            if (row.subRows.length > 0) return;
            const value = row.getValue(column.id);
            counts.set(value, (counts.get(value) ?? 0) + 1);
          });
          return counts;
        },
        getFacetedMinMaxValues: (): [number, number] | undefined => {
          let min: number | undefined;
          let max: number | undefined;
          eachKept(column, (row) => {
            const value = row.getValue(column.id);
            // NaN would make both bounds NaN for good (`Math.min(x, NaN)` is NaN).
            if (typeof value !== "number" || Number.isNaN(value)) return;
            min = min === undefined ? value : Math.min(min, value);
            max = max === undefined ? value : Math.max(max, value);
          });
          return min === undefined || max === undefined ? undefined : [min, max];
        },
      });
    }
  },
};
