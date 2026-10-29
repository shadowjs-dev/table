/**
 * The `sizing` feature: column widths set by state (`columnSizing`) on top of the column definitions.
 * Subpath: `@shadow-js/table/sizing`. Without it a column is as wide as its definition says (`size`,
 * clamped to `minSize` and `maxSize`), and the sizing members throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import { sizeOfDef, type TableHost } from "./internal/host";
import type { TableFeature } from "./types";

/**
 * The `sizing` feature: a column's width comes from the column sizing state first, then its `size`
 * definition, then the table's `defaultColumnSize`, always clamped to its minimum and maximum. Install
 * it in `createTable({ features: [sizing] })`.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { sizing } from "@shadow-js/table/sizing";
 *
 * interface Row {
 *   id: string;
 *   name: string;
 * }
 * const helper = createColumnHelper<Row>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada" }],
 *   columns: [helper.accessor("name", { header: "Name", size: 200, maxSize: 300 })],
 *   getRowId: (row) => row.id,
 *   features: [sizing],
 * });
 * table.setColumnSizing({ name: 260 });
 * console.log(table.getColumn("name")?.getSize()); // 260
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const sizing: TableFeature<"sizing"> = {
  name: "sizing",
  install<TData>(host: TableHost<TData>): void {
    const { hooks } = host;
    const sizingSlice = host.slice("columnSizing", {});
    hooks.size = (column) =>
      sizeOfDef(
        column.columnDef,
        sizingSlice.current()[column.id] ?? column.columnDef.size ?? host.defaultSize,
      );
    for (const column of host.columns) {
      Object.assign(column, {
        getCanResize: (): boolean => column.columnDef.enableResizing !== false,
      });
    }
  },
};
