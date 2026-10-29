/**
 * The `ordering` feature: the display order of the leaf columns (`columnOrder`). Subpath:
 * `@shadow-js/table/ordering`. Without it the columns are shown in their definition order, and the
 * order members throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import type { TableHost } from "./internal/host";
import type { TableFeature } from "./types";

/**
 * The `ordering` feature: the leaf columns listed in `columnOrder` come first, in that order; the rest
 * follow in definition order. Install it in `createTable({ features: [ordering] })`.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { ordering } from "@shadow-js/table/ordering";
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
 *   features: [ordering],
 * });
 * table.setColumnOrder(["age", "name"]);
 * console.log(table.getVisibleLeafColumns().map((column) => column.id)); // ["age", "name"]
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const ordering: TableFeature<"ordering"> = {
  name: "ordering",
  install<TData>(host: TableHost<TData>): void {
    const { table, hooks } = host;
    const orderSlice = host.slice("columnOrder", []);
    Object.assign(table, {
      columnOrder: orderSlice.current,
      setColumnOrder: orderSlice.set,
    });
    hooks.ordered = () => {
      const order = orderSlice.current();
      const rank = new Map(order.map((id, index) => [id, index] as const));
      return host.leaves
        .map((column, index) => ({ column, index }))
        .sort((a, b) => {
          const ra = rank.get(a.column.id) ?? order.length + a.index;
          const rb = rank.get(b.column.id) ?? order.length + b.index;
          return ra - rb;
        })
        .map((entry) => entry.column);
    };
  },
};
