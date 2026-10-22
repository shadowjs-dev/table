/**
 * The `faceting` feature: what a column's filter leaves in the table, as the rows, unique values and
 * numeric range of one column. Subpath: `@shadow-js/table/faceting`. Without it the facet members of a
 * column throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import type { TableHost } from "./internal/host";
import { walk } from "./internal/tree";
import type { Row, TableFeature } from "./types";

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
    for (const column of host.columns) {
      Object.assign(column, {
        getFacetedRowModel: (): readonly Row<TData>[] => {
          const kept = host.keepFor(column.id);
          return host.core().roots.filter((row) => kept.has(row.id));
        },
        getFacetedUniqueValues: (): Map<unknown, number> => {
          const counts = new Map<unknown, number>();
          const kept = host.keepFor(column.id);
          walk(
            host.core().roots,
            (row) => row.subRows,
            (row) => {
              if (!kept.has(row.id) || row.subRows.length > 0) return;
              const value = row.getValue(column.id);
              counts.set(value, (counts.get(value) ?? 0) + 1);
            },
          );
          return counts;
        },
        getFacetedMinMaxValues: (): [number, number] | undefined => {
          let min: number | undefined;
          let max: number | undefined;
          const kept = host.keepFor(column.id);
          walk(
            host.core().roots,
            (row) => row.subRows,
            (row) => {
              if (!kept.has(row.id)) return;
              const value = row.getValue(column.id);
              if (typeof value !== "number") return;
              min = min === undefined ? value : Math.min(min, value);
              max = max === undefined ? value : Math.max(max, value);
            },
          );
          return min === undefined || max === undefined ? undefined : [min, max];
        },
      });
    }
  },
};
