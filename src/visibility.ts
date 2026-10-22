/**
 * The `visibility` feature: hiding and showing columns (`columnVisibility`). Subpath:
 * `@shadow-js/table/visibility`. Without it every column is shown, and the visibility members throw
 * a `TypeError` that names the feature.
 * @packageDocumentation
 */
import type { TableHost } from "./internal/host";
import type { TableFeature } from "./types";

/**
 * The `visibility` feature: a column is shown unless the visibility state hides it. A group is shown
 * while one of its leaves is. Install it in `createTable({ features: [visibility] })`.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { visibility } from "@shadow-js/table/visibility";
 *
 * interface Row {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 * const helper = createColumnHelper<Row>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada", age: 36 }],
 *   columns: [helper.accessor("name", { header: "Name" }), helper.accessor("age", { header: "Age" })],
 *   getRowId: (row) => row.id,
 *   features: [visibility],
 * });
 * table.getColumn("age")?.toggleVisibility(false);
 * console.log(table.getVisibleLeafColumns().map((column) => column.id)); // ["name"]
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const visibility: TableFeature<"visibility"> = {
  name: "visibility",
  install<TData>(host: TableHost<TData>): void {
    const { table, hooks } = host;
    const visibilitySlice = host.slice("columnVisibility", {});
    hooks.visible = (column) => {
      const state = visibilitySlice.current();
      return host.targetsOf(column).some((leaf) => state[leaf.id] !== false);
    };
    Object.assign(table, {
      columnVisibility: visibilitySlice.current,
      setColumnVisibility: visibilitySlice.set,
    });
    for (const column of host.columns) {
      Object.assign(column, {
        getIsVisible: (): boolean => hooks.visible(column),
        getCanHide: (): boolean => column.columnDef.enableHiding !== false,
        toggleVisibility: (value?: boolean): void => {
          const next = value ?? !hooks.visible(column);
          const state = { ...visibilitySlice.current() };
          for (const leaf of host.targetsOf(column)) state[leaf.id] = next;
          visibilitySlice.set(state);
        },
      });
    }
  },
};
