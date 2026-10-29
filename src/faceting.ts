/**
 * The `faceting` feature: what a column's filter leaves in the table, as the rows, unique values and
 * numeric range of one column. Subpath: `@shadow-js/table/faceting`. Without it the facet members of a
 * column throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import { useMemo } from "@shadow-js/core";
import type { TableHost } from "./internal/host";
import { subRowsOf, walk } from "./internal/tree";
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
      // One lazy memo per column, made here so the table's owner holds it: it reads the data, the filters and the
      // grouping, so reading a facet again, from any number of readers, runs no filter again. The column's own filter is
      // left out.
      const facets = useMemo(
        () => {
          const keep = host.keepFor(column.id);
          const roots: Row<TData>[] = [];
          const unique = new Map<unknown, number>();
          let range: [number, number] | undefined;
          walk(host.core().roots, subRowsOf, (row) => {
            if (!keep.has(row.id)) return;
            if (row.depth === 0) roots.push(row);
            const value = row.getValue(column.id);
            // NaN would make both bounds NaN for good (`Math.min(x, NaN)` is NaN).
            if (typeof value === "number" && !Number.isNaN(value))
              range =
                range === undefined
                  ? [value, value]
                  : [Math.min(range[0], value), Math.max(range[1], value)];
            if (row.subRows.length === 0) unique.set(value, (unique.get(value) ?? 0) + 1);
          });
          return { roots, unique, range };
        },
        { lazy: true },
      );
      Object.assign(column, {
        getFacetedRowModel: () => facets().roots,
        getFacetedUniqueValues: () => facets().unique,
        getFacetedMinMaxValues: () => facets().range,
      });
    }
  },
};
