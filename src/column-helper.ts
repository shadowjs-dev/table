/**
 * `createColumnHelper`: typed constructors of column definitions. The helper fixes the row type once,
 * so `helper.accessor("age", ...)` knows the value of `age` and the cell renderer is typed.
 * @packageDocumentation
 */
import type {
  AccessorFn,
  AccessorFnColumnDef,
  AccessorKeyColumnDef,
  ColumnDefBase,
  DisplayColumnDef,
  GroupColumnDef,
} from "./types";

/**
 * Typed constructors of column definitions for one row type, returned by
 * {@link createColumnHelper}. Each method returns a new definition object holding the options it was
 * given; nothing is bound to a table, so a definition can be used by several tables.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type ColumnHelper } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper: ColumnHelper<Person> = createColumnHelper<Person>();
 * export const columns = [helper.display({ id: "select" }), helper.accessor("name")];
 * ```
 * @since 1.0.0
 */
export interface ColumnHelper<TData> {
  /**
   * A column that reads `original[key]`. The value type is the type of that property, and the column
   * id is the key unless `options.id` gives one.
   * @param key A property of the row type.
   * @param options The column options.
   * @returns The definition: the options with `accessorKey` set to `key`.
   */
  accessor<K extends keyof TData & string>(
    key: K,
    options?: Omit<ColumnDefBase<TData, TData[K]>, "id"> & { readonly id?: string },
  ): AccessorKeyColumnDef<TData, TData[K]>;
  /**
   * A column whose value is computed from the row. The value type is the function's return type, and
   * `options.id` is required.
   * @param accessor Computes the value from the row's data and its index among its siblings.
   * @param options The column options, with the column id.
   * @returns The definition: the options with `accessorFn` set to `accessor`.
   */
  accessor<TValue>(
    accessor: (original: TData, index: number) => TValue,
    options: Omit<ColumnDefBase<TData, TValue>, "id"> & { readonly id: string },
  ): AccessorFnColumnDef<TData, TValue>;
  /**
   * A column with no data behind it, such as a selection checkbox. Its cell values are `undefined`.
   * @param options The column options, with the required column id.
   * @returns The definition: a copy of the options.
   */
  display(options: ColumnDefBase<TData> & { readonly id: string }): DisplayColumnDef<TData>;
  /**
   * A header spanning child columns. Give it an `id`: without one its id is `""` and
   * `table.getColumn` does not find it.
   * @param options The column options and the child `columns`.
   * @returns The definition: a copy of the options.
   */
  group(
    options: ColumnDefBase<TData> & {
      readonly columns: readonly import("./types").ColumnDef<TData>[];
    },
  ): GroupColumnDef<TData>;
}

/**
 * Creates the typed column helper for a row type. The helper fixes the row type once, so
 * `helper.accessor("age")` knows the value type of `age` and the renderers of the column are typed.
 *
 * @returns The helper, with `accessor`, `display` and `group`.
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const columns = [
 *   helper.accessor("name", { header: "Name" }),
 *   helper.accessor((row) => row.age * 12, { id: "ageMonths", header: "Age in months" }),
 * ];
 *
 * export const table = createTable({
 *   data: [{ id: "1", name: "Ada", age: 36 }],
 *   columns,
 *   getRowId: (row) => row.id,
 * });
 * ```
 * @see {@link ColumnHelper}
 * @since 1.0.0
 */
export function createColumnHelper<TData>(): ColumnHelper<TData> {
  // Overloads mirror the ColumnHelper interface; the implementation takes the union of both forms,
  // so the object below type-checks without a cast.
  function accessor<K extends keyof TData & string>(
    key: K,
    options?: Omit<ColumnDefBase<TData, TData[K]>, "id"> & { readonly id?: string },
  ): AccessorKeyColumnDef<TData, TData[K]>;
  function accessor<TValue>(
    accessorFn: (original: TData, index: number) => TValue,
    options: Omit<ColumnDefBase<TData, TValue>, "id"> & { readonly id: string },
  ): AccessorFnColumnDef<TData, TValue>;
  function accessor(
    keyOrFn: string | ((original: TData, index: number) => unknown),
    options: Omit<ColumnDefBase<TData, unknown>, "id"> & { readonly id?: string } = {},
  ):
    | AccessorKeyColumnDef<TData>
    | (ColumnDefBase<TData> & { readonly accessorFn: AccessorFn<TData, unknown> }) {
    if (typeof keyOrFn === "string") return { ...options, accessorKey: keyOrFn };
    return { ...options, accessorFn: keyOrFn };
  }
  return {
    accessor,
    display(options) {
      return { ...options };
    },
    group(options) {
      return { ...options };
    },
  };
}
