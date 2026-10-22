/**
 * Public types of the table: definitions, state, rows, cells, columns and headers.
 * @packageDocumentation
 */
import type { Accessor } from "@shadow-js/core";
import type { TableHost } from "./internal/host";

/**
 * One sort of the sorting state: the column to sort by and the direction.
 *
 * @example
 * ```ts
 * import type { SortingEntry } from "@shadow-js/table";
 *
 * export const oldestFirst: SortingEntry = { id: "age", desc: true };
 * ```
 * @see {@link SortingState}
 * @since 1.0.0
 */
export interface SortingEntry {
  /**
   * The id of the column to sort by. An entry whose id names no column, or a column with
   * `enableSorting: false`, is skipped.
   */
  readonly id: string;
  /** `true` sorts descending, `false` ascending. */
  readonly desc: boolean;
}

/**
 * The sorting state: sorts in priority order. The first entry orders the rows, each next entry
 * orders the rows the previous ones leave equal, and rows equal on every entry keep their order. An
 * empty array leaves the rows in data order.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable, type SortingState } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   team: string;
 *   age: number;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const sorting: SortingState = [
 *   { id: "team", desc: false },
 *   { id: "age", desc: true },
 * ];
 *
 * export const table = createTable({
 *   data: [
 *     { id: "1", team: "core", age: 36 },
 *     { id: "2", team: "core", age: 54 },
 *   ],
 *   columns: [helper.accessor("team"), helper.accessor("age")],
 *   getRowId: (row) => row.id,
 *   initialState: { sorting },
 * });
 * ```
 * @see {@link SortingEntry}
 * @since 1.0.0
 */
export type SortingState = readonly SortingEntry[];

/**
 * One column filter of the column filters state: the column and the value it filters by.
 *
 * @example
 * ```ts
 * import type { ColumnFilterEntry } from "@shadow-js/table";
 *
 * export const coreTeam: ColumnFilterEntry = { id: "team", value: "core" };
 * ```
 * @see {@link ColumnFiltersState}
 * @since 1.0.0
 */
export interface ColumnFilterEntry {
  /** The id of the column. An entry whose id names no column is ignored. */
  readonly id: string;
  /**
   * The value passed to the column's `filterFn`. An empty value (`undefined`, `null`, `""` or an
   * empty array) filters nothing.
   */
  readonly value: unknown;
}

/**
 * The column filters state. A row is kept when it passes every entry.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable, type ColumnFiltersState } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const columnFilters: ColumnFiltersState = [
 *   { id: "name", value: "a" },
 *   { id: "age", value: [30, 60] },
 * ];
 *
 * export const table = createTable({
 *   data: [{ id: "1", name: "Ada", age: 36 }],
 *   columns: [helper.accessor("name"), helper.accessor("age", { filterFn: "inNumberRange" })],
 *   getRowId: (row) => row.id,
 *   initialState: { columnFilters },
 * });
 * ```
 * @see {@link ColumnFilterEntry}
 * @since 1.0.0
 */
export type ColumnFiltersState = readonly ColumnFilterEntry[];

/**
 * The pagination state: which page is shown and how many rows a page holds.
 *
 * @example
 * ```ts
 * import type { PaginationState } from "@shadow-js/table";
 *
 * export const secondPageOfTwenty: PaginationState = { pageIndex: 1, pageSize: 20 };
 * ```
 * @see {@link Table.setPagination}
 * @since 1.0.0
 */
export interface PaginationState {
  /**
   * The page shown, from 0. `setPageIndex` and the page actions keep it between 0 and the last page;
   * `setPagination` writes it as given, and a page past the end shows no rows.
   */
  readonly pageIndex: number;
  /**
   * Rows per page. A value below 1 is read as 1 when the page is sliced; `setPageSize` rounds down
   * and keeps it at least 1.
   */
  readonly pageSize: number;
}

/**
 * The row selection state: row ids mapped to `true` for the selected rows. An id that is missing or
 * `false` is not selected; deselecting a row removes its id.
 *
 * @example
 * ```ts
 * import type { RowSelectionState } from "@shadow-js/table";
 *
 * export const firstTwo: RowSelectionState = { "1": true, "2": true };
 * ```
 * @since 1.0.0
 */
export type RowSelectionState = Readonly<Record<string, boolean>>;

/**
 * The expansion state: `true` expands every row; otherwise row ids mapped to `true` for the
 * expanded rows.
 *
 * @example
 * ```ts
 * import type { ExpandedState } from "@shadow-js/table";
 *
 * export const everything: ExpandedState = true;
 * export const onlyFirst: ExpandedState = { "1": true };
 * ```
 * @since 1.0.0
 */
export type ExpandedState = true | Readonly<Record<string, boolean>>;

/**
 * The column visibility state: column ids mapped to visibility. Only `false` hides a column; a
 * column whose id is missing is visible.
 *
 * @example
 * ```ts
 * import type { ColumnVisibilityState } from "@shadow-js/table";
 *
 * export const withoutAge: ColumnVisibilityState = { age: false };
 * ```
 * @since 1.0.0
 */
export type ColumnVisibilityState = Readonly<Record<string, boolean>>;

/**
 * The column order state: leaf column ids in display order. Columns that are not listed follow the
 * listed ones, in definition order; ids that name no column are ignored.
 *
 * @example
 * ```ts
 * import type { ColumnOrderState } from "@shadow-js/table";
 *
 * export const teamFirst: ColumnOrderState = ["team", "name"];
 * ```
 * @since 1.0.0
 */
export type ColumnOrderState = readonly string[];

/**
 * The column pinning state: the column ids pinned to each side.
 *
 * @example
 * ```ts
 * import type { ColumnPinningState } from "@shadow-js/table";
 *
 * export const pinned: ColumnPinningState = { left: ["name"], right: ["actions"] };
 * ```
 * @see {@link Column.pin}
 * @since 1.0.0
 */
export interface ColumnPinningState {
  /** Column ids pinned to the left, in the order `getLeftLeafColumns` returns them. Optional. */
  readonly left?: readonly string[];
  /** Column ids pinned to the right, in the order `getRightLeafColumns` returns them. Optional. */
  readonly right?: readonly string[];
}

/**
 * The column sizing state: widths set by resizing, by column id. A width here replaces the
 * column's `size` and is clamped to its `minSize` and `maxSize`.
 *
 * @example
 * ```ts
 * import type { ColumnSizingState } from "@shadow-js/table";
 *
 * export const wideName: ColumnSizingState = { name: 320 };
 * ```
 * @since 1.0.0
 */
export type ColumnSizingState = Readonly<Record<string, number>>;

/**
 * The grouping state: the column ids the rows are grouped by, outermost first.
 *
 * @example
 * ```ts
 * import type { GroupingState } from "@shadow-js/table";
 *
 * export const byTeamThenRole: GroupingState = ["team", "role"];
 * ```
 * @since 1.0.0
 */
export type GroupingState = readonly string[];

/**
 * Every slice of table state, as `getState()` returns it and as `initialState` and `state` take it.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable, type TableState } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada" }],
 *   columns: [helper.accessor("name")],
 *   getRowId: (row) => row.id,
 * });
 *
 * export const snapshot: TableState = table.getState();
 * ```
 * @see {@link Table.getState}
 * @since 1.0.0
 */
export interface TableState {
  /**
   * The sorts, in priority order.
   * @default []
   */
  readonly sorting: SortingState;
  /**
   * The column filters.
   * @default []
   */
  readonly columnFilters: ColumnFiltersState;
  /**
   * The global filter: rows are kept when any column with `enableGlobalFilter` contains it as text,
   * ignoring case. An empty value (`undefined`, `null`, `""` or an empty array) filters nothing, and a
   * value that is not a string or a number keeps every row.
   * @default ""
   */
  readonly globalFilter: unknown;
  /**
   * The page shown and the page size.
   * @default { pageIndex: 0, pageSize: 10 }
   */
  readonly pagination: PaginationState;
  /**
   * The selected row ids.
   * @default {}
   */
  readonly rowSelection: RowSelectionState;
  /**
   * The expanded row ids, or `true` for every row.
   * @default {}
   */
  readonly expanded: ExpandedState;
  /**
   * The hidden columns.
   * @default {}
   */
  readonly columnVisibility: ColumnVisibilityState;
  /**
   * The display order of the leaf columns.
   * @default []
   */
  readonly columnOrder: ColumnOrderState;
  /**
   * The pinned columns.
   * @default {}
   */
  readonly columnPinning: ColumnPinningState;
  /**
   * The widths set by resizing.
   * @default {}
   */
  readonly columnSizing: ColumnSizingState;
  /**
   * The column ids the rows are grouped by.
   * @default []
   */
  readonly grouping: GroupingState;
}

/**
 * The built-in aggregations of a grouped row. `sum` adds the numbers (0 when there are none); `min`,
 * `max`, `mean` and `median` read the numbers and give `undefined` when there are none; `extent` is
 * `[min, max]` of the numbers or `undefined`; `count` is the number of values; `unique` is the
 * distinct values in first-seen order and `uniqueCount` their number. Values that are not numbers
 * are ignored by the numeric aggregations.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type AggregationFnName } from "@shadow-js/table";
 *
 * interface Sale {
 *   region: string;
 *   amount: number;
 * }
 *
 * const total: AggregationFnName = "sum";
 * export const amount = createColumnHelper<Sale>().accessor("amount", { aggregationFn: total });
 * ```
 * @see {@link AggregationFn}
 * @since 1.0.0
 */
export type AggregationFnName =
  | "sum"
  | "min"
  | "max"
  | "mean"
  | "median"
  | "count"
  | "unique"
  | "uniqueCount"
  | "extent";

/**
 * An aggregation of a column: a built-in name, or a function of the values of the group's leaf rows
 * whose result is the group row's value in that column.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type AggregationFn } from "@shadow-js/table";
 *
 * interface Sale {
 *   region: string;
 *   amount: number;
 * }
 *
 * const largest: AggregationFn = (values) =>
 *   Math.max(...values.filter((value): value is number => typeof value === "number"));
 * export const amount = createColumnHelper<Sale>().accessor("amount", { aggregationFn: largest });
 * ```
 * @see {@link AggregationFnName}
 * @since 1.0.0
 */
export type AggregationFn = AggregationFnName | ((values: readonly unknown[]) => unknown);

/**
 * The built-in column filters. `includesString` keeps a value whose text contains the filter's text,
 * ignoring case (a filter that is not a string or a number keeps every row); `equals` compares with
 * `===`; `arrIncludes` keeps an array value that contains the filter value; `inNumberRange` keeps a
 * number within a `[min, max]` filter, where a bound that is not a number leaves that side open.
 * `auto` is `includesString` for a string value and `equals` otherwise.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type FilterFnName } from "@shadow-js/table";
 *
 * interface Person {
 *   team: string;
 * }
 *
 * const exact: FilterFnName = "equals";
 * export const team = createColumnHelper<Person>().accessor("team", { filterFn: exact });
 * ```
 * @see {@link FilterFn}
 * @since 1.0.0
 */
export type FilterFnName = "auto" | "includesString" | "equals" | "arrIncludes" | "inNumberRange";

/**
 * A custom column filter: returns whether a row passes the column's filter value. The table calls it
 * only while the filter value is not empty (`undefined`, `null`, `""` or an empty array).
 *
 * @param row The row to test.
 * @param columnId The id of the column the filter belongs to.
 * @param filterValue The column's filter value.
 * @returns `true` to keep the row.
 * @example
 * ```ts
 * import { createColumnHelper, type FilterFn } from "@shadow-js/table";
 *
 * interface Person {
 *   age: number;
 * }
 *
 * const atLeast: FilterFn<Person> = (row, columnId, filterValue) =>
 *   typeof filterValue === "number" && row.getValue<number>(columnId) >= filterValue;
 * export const age = createColumnHelper<Person>().accessor("age", { filterFn: atLeast });
 * ```
 * @see {@link FilterFnName}
 * @since 1.0.0
 */
export type FilterFn<TData> = (row: Row<TData>, columnId: string, filterValue: unknown) => boolean;

/**
 * A custom sort comparison for one column: negative when `rowA` comes first, positive when `rowB`
 * does, zero when they are equal. The table reverses the result for a descending sort. A custom
 * function also receives rows whose value is `undefined` or `null`; the built-in sorts put those last.
 *
 * @param rowA The first row.
 * @param rowB The second row.
 * @param columnId The id of the column being sorted.
 * @returns The comparison, as `Array.prototype.sort` reads it.
 * @example
 * ```ts
 * import { createColumnHelper, type SortingFn } from "@shadow-js/table";
 *
 * interface Person {
 *   tags: string[];
 * }
 *
 * const byTagCount: SortingFn<Person> = (rowA, rowB, columnId) =>
 *   rowA.getValue<string[]>(columnId).length - rowB.getValue<string[]>(columnId).length;
 * export const tags = createColumnHelper<Person>().accessor("tags", { sortingFn: byTagCount });
 * ```
 * @see {@link SortingFnName}
 * @since 1.0.0
 */
export type SortingFn<TData> = (rowA: Row<TData>, rowB: Row<TData>, columnId: string) => number;

/**
 * Reads a column's value from a row's original data.
 *
 * @param original The data item of the row.
 * @param index The row's position among its siblings: in the data, or in its parent's sub rows.
 * @returns The column's value for the row.
 * @example
 * ```ts
 * import { createColumnHelper, type AccessorFn } from "@shadow-js/table";
 *
 * interface Person {
 *   first: string;
 *   last: string;
 * }
 *
 * const fullName: AccessorFn<Person, string> = (person) => `${person.first} ${person.last}`;
 * export const name = createColumnHelper<Person>().accessor(fullName, { id: "fullName" });
 * ```
 * @since 1.0.0
 */
export type AccessorFn<TData, TValue> = (original: TData, index: number) => TValue;

/**
 * What a cell renderer receives: the cell, its row and column, and the table.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type CellContext } from "@shadow-js/table";
 *
 * interface Person {
 *   age: number;
 * }
 *
 * const years = (context: CellContext<Person, number>): string => `${context.getValue()} years`;
 * export const age = createColumnHelper<Person>().accessor("age", { cell: years });
 * ```
 * @see {@link Cell.getContext}
 * @since 1.0.0
 */
export interface CellContext<TData, TValue> {
  /** The table the cell belongs to. */
  readonly table: Table<TData>;
  /** The cell's column. */
  readonly column: Column<TData, TValue>;
  /** The cell's row. */
  readonly row: Row<TData>;
  /** The cell. */
  readonly cell: Cell<TData, TValue>;
  /** The cell's value: `row.getValue(column.id)`. */
  getValue(): TValue;
  /** The cell's value to render. The same value as {@link CellContext.getValue}. */
  renderValue(): TValue;
}

/**
 * What a header or footer renderer receives: the header, its column, and the table.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type HeaderContext } from "@shadow-js/table";
 *
 * interface Person {
 *   age: number;
 * }
 *
 * const sortable = (context: HeaderContext<Person, number>): string =>
 *   context.column.getCanSort() ? "Age (sortable)" : "Age";
 * export const age = createColumnHelper<Person>().accessor("age", { header: sortable });
 * ```
 * @see {@link Header.getContext}
 * @since 1.0.0
 */
export interface HeaderContext<TData, TValue> {
  /** The table the header belongs to. */
  readonly table: Table<TData>;
  /** The header's column. */
  readonly column: Column<TData, TValue>;
  /** The header. */
  readonly header: Header<TData, TValue>;
}

/**
 * A renderer of a header, footer or cell: a function of the context, or a value to show. The table
 * stores renderers and never calls them; the rendering code calls a function renderer with
 * `cell.getContext()` or `header.getContext()`. The value branch is `object` (any node the UI
 * library renders) so that the function branch keeps its contextual parameter type.
 *
 * @example
 * ```ts
 * import type { CellContext, Renderer } from "@shadow-js/table";
 *
 * interface Person {
 *   age: number;
 * }
 *
 * export const ageCell: Renderer<CellContext<Person, number>> = (context) =>
 *   `${context.getValue()} years`;
 *
 * export function render<C>(renderer: Renderer<C>, context: C): unknown {
 *   return typeof renderer === "function" ? renderer(context) : renderer;
 * }
 * ```
 * @since 1.0.0
 */
export type Renderer<C> =
  | ((context: C) => unknown)
  | string
  | number
  | boolean
  | null
  | undefined
  | object;

/**
 * Options every column definition shares. Each one is optional; the defaults below are what the
 * table uses when an option is left out.
 *
 * @example
 * ```ts
 * import type { ColumnDefBase } from "@shadow-js/table";
 *
 * interface Person {
 *   age: number;
 * }
 *
 * export const narrowSortable: ColumnDefBase<Person, number> = {
 *   header: "Age",
 *   size: 80,
 *   minSize: 60,
 *   sortDescFirst: true,
 *   enableGlobalFilter: false,
 * };
 * ```
 * @see {@link ColumnDef}
 * @since 1.0.0
 */
export interface ColumnDefBase<TData, TValue = unknown> {
  /**
   * The column id, used by every state slice and by `getColumn`. Required for display and
   * function-accessor columns; a key column defaults to its `accessorKey`. A group column without an
   * id has the id `""` and `getColumn` does not find it.
   */
  readonly id?: string;
  /** The header renderer. Stored for the rendering code; the table does not call it. */
  readonly header?: Renderer<HeaderContext<TData, TValue>>;
  /** The footer renderer. Stored for the rendering code; the table does not call it. */
  readonly footer?: Renderer<HeaderContext<TData, TValue>>;
  /** The cell renderer. Stored for the rendering code; the table does not call it. */
  readonly cell?: Renderer<CellContext<TData, TValue>>;
  /**
   * The column width, in the units the rendering code uses (pixels in a DOM table). Clamped to
   * `minSize` and `maxSize`; a width in the column sizing state replaces it.
   * @default the table's `defaultColumnSize` (150)
   */
  readonly size?: number;
  /**
   * The smallest width `getSize` returns.
   * @default 20
   */
  readonly minSize?: number;
  /**
   * The largest width `getSize` returns.
   * @default Number.POSITIVE_INFINITY
   */
  readonly maxSize?: number;
  /**
   * `false` makes `getCanSort` false and skips the column's entries in the sorting state.
   * @default true
   */
  readonly enableSorting?: boolean;
  /**
   * `false` makes `toggleSorting(desc, true)` replace the other sorts instead of keeping them.
   * @default true
   */
  readonly enableMultiSort?: boolean;
  /**
   * `true` makes `toggleSorting()` start with descending: descending, ascending, none.
   * @default false
   */
  readonly sortDescFirst?: boolean;
  /**
   * The comparison: a built-in name or a custom function.
   * @default "alphanumeric"
   */
  readonly sortingFn?: SortingFnName | SortingFn<TData>;
  /**
   * Read by `getCanFilter` only: `false` makes it false, and a filter already in the state still
   * applies.
   * @default true
   */
  readonly enableColumnFilter?: boolean;
  /**
   * The column filter: a built-in name or a custom function. A name the table does not know turns the
   * column's filter off.
   * @default "auto"
   */
  readonly filterFn?: FilterFnName | FilterFn<TData>;
  /**
   * `false` leaves the column out of the global filter and makes `getCanGlobalFilter` false.
   * @default true
   */
  readonly enableGlobalFilter?: boolean;
  /**
   * Read by `getCanGroup` only: `true` makes it true. `setGrouping` groups by any column.
   * @default false
   */
  readonly enableGrouping?: boolean;
  /**
   * The value of a group row in this column. Without one, a group row shows the value of its first
   * leaf row.
   */
  readonly aggregationFn?: AggregationFn;
  /**
   * Read by `getCanHide` only: `false` makes it false; `toggleVisibility` still hides the column.
   * @default true
   */
  readonly enableHiding?: boolean;
  /**
   * Read by `getCanPin` only: `false` makes it false; `pin` still pins the column.
   * @default true
   */
  readonly enablePinning?: boolean;
  /**
   * Read by `getCanResize` only: `false` makes it false; the column sizing state still applies.
   * @default true
   */
  readonly enableResizing?: boolean;
  /** Free-form data for the rendering code. The table does not read it. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/**
 * The built-in sorts. `alphanumeric`, `text` and `datetime` compare numbers by value, `Date`s by
 * time and anything else by its text, ignoring case. `basic` compares numbers and `Date`s the same
 * way and other values by their text with case (code unit order). Values that are `undefined` or
 * `null` sort last in either direction.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type SortingFnName } from "@shadow-js/table";
 *
 * interface File {
 *   name: string;
 * }
 *
 * const caseSensitive: SortingFnName = "basic";
 * export const name = createColumnHelper<File>().accessor("name", { sortingFn: caseSensitive });
 * ```
 * @see {@link SortingFn}
 * @since 1.0.0
 */
export type SortingFnName = "alphanumeric" | "basic" | "datetime" | "text";

/**
 * A column that reads `original[accessorKey]`. `createColumnHelper().accessor("key")` makes one.
 *
 * @example
 * ```ts
 * import type { AccessorKeyColumnDef } from "@shadow-js/table";
 *
 * interface Person {
 *   name: string;
 * }
 *
 * export const name: AccessorKeyColumnDef<Person, string> = { accessorKey: "name", header: "Name" };
 * ```
 * @see {@link ColumnHelper.accessor}
 * @since 1.0.0
 */
export interface AccessorKeyColumnDef<TData, TValue = unknown>
  extends ColumnDefBase<TData, TValue> {
  /**
   * The property the column reads, which is also the column id when `id` is not given. It is one
   * property name: `"address.city"` reads the property of that name, not a nested one.
   */
  readonly accessorKey: string;
  /** Not used: a key column has no accessor function. */
  readonly accessorFn?: undefined;
}

/**
 * A column whose value is computed from the row by a function. `createColumnHelper().accessor(fn,
 * { id })` makes one.
 *
 * @example
 * ```ts
 * import type { AccessorFnColumnDef } from "@shadow-js/table";
 *
 * interface Person {
 *   first: string;
 *   last: string;
 * }
 *
 * export const fullName: AccessorFnColumnDef<Person, string> = {
 *   id: "fullName",
 *   accessorFn: (person) => `${person.first} ${person.last}`,
 *   header: "Name",
 * };
 * ```
 * @see {@link ColumnHelper.accessor}
 * @since 1.0.0
 */
export interface AccessorFnColumnDef<TData, TValue = unknown> extends ColumnDefBase<TData, TValue> {
  /** Computes the column's value from the row's data and its index among its siblings. */
  readonly accessorFn: AccessorFn<TData, TValue>;
  /** The column id. Required: a function has no key to take it from. */
  readonly id: string;
  /** Not used: a function column has no key. */
  readonly accessorKey?: undefined;
}

/**
 * A column with no data, such as a selection checkbox or an action menu. Its cells' value is
 * `undefined`; the `cell` renderer draws them. `createColumnHelper().display` makes one.
 *
 * @example
 * ```ts
 * import type { DisplayColumnDef } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 * }
 *
 * export const select: DisplayColumnDef<Person> = {
 *   id: "select",
 *   cell: (context) => (context.row.getIsSelected() ? "[x]" : "[ ]"),
 * };
 * ```
 * @see {@link ColumnHelper.display}
 * @since 1.0.0
 */
export interface DisplayColumnDef<TData, TValue = unknown> extends ColumnDefBase<TData, TValue> {
  /** The column id. Required: a display column has no key to take it from. */
  readonly id: string;
  /** Not used: a display column reads no data. */
  readonly accessorKey?: undefined;
  /** Not used: a display column reads no data. */
  readonly accessorFn?: undefined;
}

/**
 * A header that spans its child columns. The children are leaf columns of the table (or further
 * groups), and the header groups have one level per level of nesting. `createColumnHelper().group`
 * makes one.
 *
 * @example
 * ```ts
 * import type { GroupColumnDef } from "@shadow-js/table";
 *
 * interface Person {
 *   first: string;
 *   last: string;
 * }
 *
 * export const name: GroupColumnDef<Person> = {
 *   id: "name",
 *   header: "Name",
 *   columns: [
 *     { accessorKey: "first", header: "First" },
 *     { accessorKey: "last", header: "Last" },
 *   ],
 * };
 * ```
 * @see {@link ColumnHelper.group}
 * @since 1.0.0
 */
export interface GroupColumnDef<TData> extends ColumnDefBase<TData> {
  /** The child column definitions, of any kind, in display order. */
  readonly columns: readonly ColumnDef<TData>[];
}

/**
 * Any column definition: a key column, a function column, a display column or a group.
 *
 * @example
 * ```ts
 * import { createColumnHelper, type ColumnDef } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * export const columns: ColumnDef<Person>[] = [
 *   helper.display({ id: "select" }),
 *   helper.accessor("name", { header: "Name" }),
 * ];
 * ```
 * @see {@link createColumnHelper}
 * @since 1.0.0
 */
export type ColumnDef<TData, TValue = unknown> =
  | AccessorKeyColumnDef<TData, TValue>
  | AccessorFnColumnDef<TData, TValue>
  | DisplayColumnDef<TData, TValue>
  | GroupColumnDef<TData>;

/**
 * One column of a table, made from a column definition: its place in the nesting, its value
 * accessor, and methods that read and change its state.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada" }],
 *   columns: [helper.accessor("name", { header: "Name" })],
 *   getRowId: (row) => row.id,
 * });
 *
 * const name = table.getColumn("name");
 * name?.toggleSorting();
 * name?.setFilterValue("a");
 * export const sorted = name?.getIsSorted();
 * ```
 * @see {@link Table.getColumn}
 * @since 1.0.0
 */
export interface Column<TData, TValue = unknown> {
  /** The column id: the definition's `id`, or its `accessorKey`, or `""` when it has neither. */
  readonly id: string;
  /** The nesting level: 0 for a top-level column, one more for each group above it. */
  readonly depth: number;
  /** The definition the column was made from. */
  readonly columnDef: ColumnDef<TData, TValue>;
  /** The group column this column is a child of, or `undefined` at the top level. */
  readonly parent: Column<TData, TValue> | undefined;
  /** The direct child columns of a group; empty for a leaf column. */
  readonly columns: readonly Column<TData, TValue>[];
  /**
   * Reads the column's value from a row's data: the definition's `accessorFn`, or a reader of
   * `original[accessorKey]`. `undefined` for display and group columns.
   */
  readonly accessorFn: AccessorFn<TData, TValue> | undefined;
  /**
   * The width: the column sizing state, else `size`, else the table's `defaultColumnSize`, clamped to
   * `minSize` (default 20) and `maxSize`. For a group column this is its own size; `Header.getSize`
   * sums the leaves.
   */
  getSize(): number;
  /**
   * The offset of the column's left edge from the left edge of its section, the sum of the widths of
   * the visible leaf columns before it in that section. A group starts where its first visible leaf
   * does. A hidden column, or one not in the section, starts at 0.
   * @param position The section: `"left"` (pinned left), `"center"` or `"right"` (pinned right).
   *   Omitted, the section the column is in (`"center"` when it is not pinned).
   * @returns The offset in pixels.
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
   * const table = createTable({
   *   data: [{ id: "1", name: "Ada", age: 36 }],
   *   columns: [
   *     helper.accessor("name", { size: 120 }),
   *     helper.accessor("age", { size: 80 }),
   *   ],
   *   getRowId: (row) => row.id,
   * });
   *
   * export const ageStart = table.getColumn("age")?.getStart();
   * ```
   */
  getStart(position?: "left" | "center" | "right"): number;
  /**
   * Whether the column is visible: a leaf is visible unless the visibility state maps its id to
   * `false`; a group is visible when one of the leaves under it is.
   */
  getIsVisible(): boolean;
  /** Whether the definition allows hiding (`enableHiding` is not `false`). */
  getCanHide(): boolean;
  /**
   * Shows or hides the column. A group shows or hides every leaf under it.
   * @param value `true` to show, `false` to hide; omitted, the visibility flips.
   */
  toggleVisibility(value?: boolean): void;
  /**
   * The side the column is pinned to, or `false` when it is not pinned. A group is pinned to a side
   * when every leaf under it is pinned to that side.
   */
  getIsPinned(): false | "left" | "right";
  /** Whether the definition allows pinning (`enablePinning` is not `false`). */
  getCanPin(): boolean;
  /**
   * Pins the column to a side, at the end of that side's list, or unpins it. A group pins every leaf
   * under it, in definition order.
   * @param position `"left"`, `"right"`, or `false` to unpin.
   */
  pin(position: "left" | "right" | false): void;
  /** Whether the column can sort: a leaf column whose `enableSorting` is not `false`. */
  getCanSort(): boolean;
  /** The column's direction in the sorting state, or `false` when it is not sorted. */
  getIsSorted(): false | "asc" | "desc";
  /** The direction `toggleSorting()` starts with: `"desc"` when `sortDescFirst` is `true`. */
  getFirstSortDir(): "asc" | "desc";
  /**
   * Sorts by the column. Without `desc`, the column cycles from its first direction to the other one
   * and then to unsorted. Without `multi`, the sorting state becomes this column's entry alone (or
   * empty when it cycles to unsorted); with `multi` (and `enableMultiSort` not `false`), the other
   * entries are kept, a sorted column changes in place, and a new one is added last.
   * @param desc `true` for descending, `false` for ascending; omitted, the next step of the cycle.
   * @param multi `true` to keep the other sorts.
   */
  toggleSorting(desc?: boolean, multi?: boolean): void;
  /** Whether the column can filter: a leaf column whose `enableColumnFilter` is not `false`. */
  getCanFilter(): boolean;
  /** The column's filter value, or `undefined` when it has none. */
  getFilterValue(): unknown;
  /**
   * Sets the column's filter value. An empty value (`undefined`, `null`, `""` or an empty array)
   * removes the column's entry from the column filters.
   * @param value The value the column's `filterFn` receives.
   */
  setFilterValue(value: unknown): void;
  /** Whether the global filter reads the column: a leaf whose `enableGlobalFilter` is not `false`. */
  getCanGlobalFilter(): boolean;
  /** Whether the column offers grouping: a leaf column whose `enableGrouping` is `true`. */
  getCanGroup(): boolean;
  /** Whether the grouping state contains the column. */
  getIsGrouped(): boolean;
  /** Adds the column to the end of the grouping state, or removes it when it is there. */
  toggleGrouping(): void;
  /** Whether the definition allows resizing (`enableResizing` is not `false`). */
  getCanResize(): boolean;
  /**
   * The root rows that every column filter except this column's own, and the global filter, keep.
   * The filters apply even with `manualFiltering`.
   */
  getFacetedRowModel(): readonly Row<TData>[];
  /**
   * The column's values, each with the number of rows that have it, over the rows without sub rows
   * that the other filters keep (as {@link Column.getFacetedRowModel}).
   */
  getFacetedUniqueValues(): Map<unknown, number>;
  /**
   * `[min, max]` of the column's number values over the rows (at every depth) that the other filters
   * keep, or `undefined` when none of them is a number.
   */
  getFacetedMinMaxValues(): [number, number] | undefined;
}

/**
 * One cell: a row's value in one leaf column.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada" }],
 *   columns: [helper.accessor("name")],
 *   getRowId: (row) => row.id,
 * });
 *
 * export const texts = table
 *   .getRowModel()
 *   .rows.map((row) => row.getVisibleCells().map((cell) => String(cell.getValue())));
 * ```
 * @see {@link Row.getVisibleCells}
 * @since 1.0.0
 */
export interface Cell<TData, TValue = unknown> {
  /** The cell id: the row id and the column id joined by `_`. */
  readonly id: string;
  /** The cell's column. */
  readonly column: Column<TData, TValue>;
  /** The cell's row. */
  readonly row: Row<TData>;
  /** The cell's value: `row.getValue(column.id)`. */
  getValue(): TValue;
  /** The cell's value to render. The same value as {@link Cell.getValue}. */
  renderValue(): TValue;
  /** The context to call the column's `cell` renderer with. */
  getContext(): CellContext<TData, TValue>;
}

/**
 * One row of the table: its data, its values and cells, and its selection and expansion. A row is
 * made from a data item, or is a group row made by grouping.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table = createTable({
 *   data: [
 *     { id: "1", name: "Ada" },
 *     { id: "2", name: "Grace" },
 *   ],
 *   columns: [helper.accessor("name")],
 *   getRowId: (row) => row.id,
 * });
 *
 * const ada = table.getRow("1");
 * ada?.toggleSelected(true);
 * export const label = `${ada?.getValue<string>("name")} selected: ${ada?.getIsSelected()}`;
 * ```
 * @see {@link Table.getRowModel}
 * @since 1.0.0
 */
export interface Row<TData> {
  /**
   * The row id, the key of the selection and expansion state: `getRowId`'s result, or by default the
   * index (`"0"`, and `"0.1"` for the second sub row of that row). A group row's id is
   * `columnId:value`, prefixed with the parent group's id and `>` when it is nested.
   */
  readonly id: string;
  /**
   * The position among its siblings: in the data, or in its parent's sub rows. For a group row, the
   * index of its first row.
   */
  readonly index: number;
  /** The nesting level: 0 for a root row, one more per parent. For a group row, its grouping level. */
  readonly depth: number;
  /** The data the row was made from. A group row carries its first row's data. */
  readonly original: TData;
  /** The parent row's id, or `undefined` for a root row and for a group row. */
  readonly parentId: string | undefined;
  /**
   * The sub rows from `getSubRows`, in data order; for a group row, its rows or its nested groups.
   * Sorting does not reorder this array (the expanded row model shows sub rows sorted), and column
   * filters do not remove from it.
   */
  readonly subRows: readonly Row<TData>[];
  /** Whether the row is a group row. */
  readonly isGrouped: boolean;
  /** For a group row, the id of the column it groups by; `undefined` otherwise. */
  readonly groupingColumnId: string | undefined;
  /** For a group row, the value its rows share in the grouping column; `undefined` otherwise. */
  readonly groupingValue: unknown;
  /**
   * The row's value in a column, computed once per row. A group row gives its grouping value in its
   * grouping column, the column's aggregation of its leaf rows when the column has an
   * `aggregationFn`, and its first leaf row's value otherwise.
   * @param columnId The column id.
   * @returns The value, or `undefined` for an unknown column or a column without an accessor.
   */
  getValue<TValue = unknown>(columnId: string): TValue;
  /**
   * The same value as {@link Row.getValue}.
   * @param columnId The column id.
   */
  getGroupingValue(columnId: string): unknown;
  /** Whether the row is a group row. */
  getIsGrouped(): boolean;
  /** One cell per leaf column, in definition order, hidden columns included. */
  getAllCells(): readonly Cell<TData>[];
  /** One cell per visible leaf column, in column order. Pinning does not move them. */
  getVisibleCells(): readonly Cell<TData>[];
  /** The rows under this one that have no sub rows; the row itself when it has none. */
  getLeafRows(): readonly Row<TData>[];
  /** The parent row, or `undefined` for a root row and for a group row. */
  getParentRow(): Row<TData> | undefined;
  /** Whether rows can be selected: `false` only when the table's `enableRowSelection` is `false`. */
  getCanSelect(): boolean;
  /**
   * Whether the row is selected. With uncontrolled selection, a reader reruns only when this row's
   * flag changes.
   */
  getIsSelected(): boolean;
  /** Whether any of the row's direct sub rows is selected. */
  getIsSomeSelected(): boolean;
  /**
   * Selects or deselects the row and every row under it (only the row itself when
   * `enableSubRowSelection` is `false`).
   * @param value `true` to select, `false` to deselect; omitted, the row's selection flips.
   */
  toggleSelected(value?: boolean): void;
  /**
   * Whether the row has sub rows that are shown (the filters and the grouping keep them) and the
   * table's `enableExpanding` is not `false`.
   */
  getCanExpand(): boolean;
  /**
   * Whether the row is expanded: the expansion state is `true` or maps the row's id to `true`. With
   * uncontrolled expansion that is not `true`, a reader reruns only when this row's flag changes.
   */
  getIsExpanded(): boolean;
  /**
   * Expands or collapses the row. When every row is expanded (state `true`), the state becomes every
   * row with sub rows expanded, and then this row changes.
   * @param value `true` to expand, `false` to collapse; omitted, the row's expansion flips.
   */
  toggleExpanded(value?: boolean): void;
}

/**
 * A row model: the rows in order, every row they hold, and the rows by id.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable, type RowModel } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada" }],
 *   columns: [helper.accessor("name")],
 *   getRowId: (row) => row.id,
 * });
 *
 * const model: RowModel<Person> = table.getCoreRowModel();
 * export const ada = model.rowsById.get("1")?.original;
 * ```
 * @see {@link Table.getRowModel}
 * @since 1.0.0
 */
export interface RowModel<TData> {
  /** The rows of the model, in order. */
  readonly rows: readonly Row<TData>[];
  /**
   * Every row of the model, each once, parents before children. For a tree model (core, filtered,
   * grouped, sorted) that is the tree in order, with only the sub rows the model keeps. For a list
   * model (expanded, pre-pagination, page, selected) it is `rows`: the sub rows that are shown are
   * already in `rows`, and the rows under a collapsed row are not in the model.
   */
  readonly flatRows: readonly Row<TData>[];
  /** The rows of the model by id. */
  readonly rowsById: ReadonlyMap<string, Row<TData>>;
}

/**
 * One header of a header group, for one column.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada" }],
 *   columns: [helper.accessor("name", { header: "Name" })],
 *   getRowId: (row) => row.id,
 * });
 *
 * export const widths = table
 *   .getHeaderGroups()
 *   .map((group) => group.headers.map((header) => `${header.id}: ${header.getSize()}px`));
 * ```
 * @see {@link HeaderGroup}
 * @since 1.0.0
 */
export interface Header<TData, TValue = unknown> {
  /** The header id: its column's id. */
  readonly id: string;
  /** The header's column. */
  readonly column: Column<TData, TValue>;
  /**
   * The number of visible leaf columns the header spans: 1 for a leaf, and the leaves of its run for
   * a group (the leaves under the group that are next to each other in column order).
   */
  readonly colSpan: number;
  /**
   * The number of rows the header spans: 1 for a group and for a placeholder; for a leaf, the rows
   * from its own row down to the deepest row, since the rows below it hold its placeholders.
   */
  readonly rowSpan: number;
  /** The header group level, which is the column's depth. */
  readonly depth: number;
  /**
   * `true` for a placeholder: a cell that fills a position in a row below a shallower leaf (the leaf
   * already spans down to this row). Render nothing for it. Its `column` is that leaf.
   */
  readonly isPlaceholder: boolean;
  /** The context to call the column's `header` or `footer` renderer with. */
  getContext(): HeaderContext<TData, TValue>;
  /** The sum of the sizes of the visible leaf columns the header spans. */
  getSize(): number;
}

/**
 * A row of headers: one group per level of column nesting, from the top level down to the deepest
 * visible leaf. The headers of a row follow the visible leaves in column order, so they line up with
 * the cells: a group header spans its leaves, a leaf spans down to the last row, and a row below a
 * shallower leaf holds a placeholder for it. A group with no visible leaf has no header.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   first: string;
 *   last: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table = createTable({
 *   data: [{ id: "1", first: "Ada", last: "Lovelace" }],
 *   columns: [
 *     helper.group({
 *       id: "name",
 *       header: "Name",
 *       columns: [helper.accessor("first"), helper.accessor("last")],
 *     }),
 *   ],
 *   getRowId: (row) => row.id,
 * });
 *
 * export const levels = table
 *   .getHeaderGroups()
 *   .map((group) => group.headers.map((header) => `${header.id} spans ${header.colSpan}`));
 * ```
 * @see {@link Table.getHeaderGroups}
 * @since 1.0.0
 */
export interface HeaderGroup<TData> {
  /** The nesting level, from 0 for the top-level columns. */
  readonly depth: number;
  /** The headers of this row, in column order: groups, leaves and placeholders. */
  readonly headers: readonly Header<TData>[];
}

/**
 * Options of {@link createTable}: the data, the columns, the starting or controlled state, and the
 * switches for server-side work.
 *
 * @example
 * ```ts
 * import { useSignal } from "@shadow-js/core";
 * import { createColumnHelper, createTable, type TableOptions } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const [people] = useSignal<readonly Person[]>([{ id: "1", name: "Ada" }]);
 *
 * const options: TableOptions<Person> = {
 *   data: people,
 *   columns: [helper.accessor("name", { header: "Name" })],
 *   getRowId: (row) => row.id,
 *   initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
 * };
 * export const table = createTable(options);
 * ```
 * @since 1.0.0
 */
export interface TableOptions<TData> {
  /**
   * The rows' data. Pass an accessor (a signal) for data that changes: the row models rebuild when it
   * does. A plain array is not tracked.
   */
  readonly data: readonly TData[] | Accessor<readonly TData[]>;
  /** The column definitions. Read once, when the table is created. */
  readonly columns: readonly ColumnDef<TData>[];
  /**
   * The language of the data, as a BCP 47 tag (`"de"`, `"ar"`) or a list in order of preference. Needs the `locale`
   * feature (`@shadow-js/table/locale`). Read once, when the table is created. With it the built-in text sorts order text
   * with `Intl.Collator` (accented letters with their base letter, numbers inside text by value, so `item 2` comes before
   * `item 10`; `basic` stays case-sensitive) and the text filters fold case by the language's rules (Turkish `I` is
   * dotless). Without it the table is independent of the language: text is folded with `toLowerCase` and ordered by
   * character code. A custom `sortingFn` or `filterFn` decides for itself.
   * @throws TypeError at creation when the `locale` feature is not installed.
   * @throws RangeError at creation when a tag is not well formed.
   * @example
   * ```ts
   * import { createColumnHelper, createTable } from "@shadow-js/table";
   * import { locale } from "@shadow-js/table/locale";
   *
   * const helper = createColumnHelper<{ name: string }>();
   * const table = createTable({
   *   data: [{ name: "zebra" }, { name: "ärger" }],
   *   columns: [helper.accessor("name")],
   *   features: [locale],
   *   locale: "de",
   * });
   * console.log(table.getRowModel().rows.length); // 2
   * ```
   * @default undefined
   */
  readonly locale?: string | readonly string[];
  /**
   * The id of a row, the key of the selection and expansion state. Give a stable id (a database key)
   * so the state follows the row when the data changes.
   * @default the index, joined to the parent's id by `.` for a sub row (`"0"`, `"0.1"`)
   */
  readonly getRowId?: (original: TData, index: number, parent: Row<TData> | undefined) => string;
  /**
   * The sub rows of a data item, at any depth; `undefined` or an empty array for none. Column and
   * global filters apply at every depth: a row is shown when it passes or a row under it does, and
   * its sub rows are shown only when they pass or lead to a passing row.
   */
  readonly getSubRows?: (original: TData, index: number) => readonly TData[] | undefined;
  /**
   * The starting value of each slice that is not controlled, and the value the `reset` methods
   * return to. A slice left out starts at its {@link TableState} default.
   */
  readonly initialState?: Partial<TableState>;
  /**
   * Controlled slices: the table reads each given accessor and does not keep its own copy; a change
   * is only reported through `onStateChange`.
   */
  readonly state?: { readonly [K in keyof TableState]?: Accessor<TableState[K]> };
  /**
   * Called after every state change, controlled or not, with the slice name and its new value.
   * @param name The slice that changed.
   * @param value The slice's new value.
   */
  readonly onStateChange?: <K extends keyof TableState>(name: K, value: TableState[K]) => void;
  /**
   * `true` keeps the rows in the order they were given: the sorting state is kept but not applied.
   * @default false
   */
  readonly manualSorting?: boolean;
  /**
   * `true` keeps every row: the column and global filters are kept but not applied to the row models
   * (faceted values still apply them).
   * @default false
   */
  readonly manualFiltering?: boolean;
  /**
   * `true` shows every row instead of a page, and `getPageCount` returns `pageCount`.
   * @default false
   */
  readonly manualPagination?: boolean;
  /**
   * `true` makes no group rows: the grouping state is kept but not applied.
   * @default false
   */
  readonly manualGrouping?: boolean;
  /**
   * The page count when pagination is manual (the server knows it). Ignored otherwise. A negative
   * count means unknown: `getCanNextPage` is always `true` and `setPageIndex` has no upper bound.
   * @default -1
   */
  readonly pageCount?: number;
  /**
   * Read by `Row.getCanSelect` only: `false` makes it false.
   * @default true
   */
  readonly enableRowSelection?: boolean;
  /**
   * `false` makes `Row.toggleSelected` select only the row, not the rows under it.
   * @default true
   */
  readonly enableSubRowSelection?: boolean;
  /**
   * Read by `Row.getCanExpand` only: `false` makes it false.
   * @default true
   */
  readonly enableExpanding?: boolean;
  /**
   * The size of a column whose definition has no `size`.
   * @default 150
   */
  readonly defaultColumnSize?: number;
  /**
   * The opt-in features of this table (see {@link TableFeature}). A feature a table does not list is
   * not in its bundle, and its members throw a `TypeError` that names the feature and its import.
   * @default []
   */
  readonly features?: readonly TableFeature[];
}

/**
 * The table: state accessors and setters, columns and headers, row models, pagination, selection
 * and expansion. Made by {@link createTable}. Row models are memoized on the state they read, so a
 * reader reruns when that state changes.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable, type Table } from "@shadow-js/table";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const table: Table<Person> = createTable({
 *   data: [
 *     { id: "1", name: "Ada", age: 36 },
 *     { id: "2", name: "Grace", age: 85 },
 *   ],
 *   columns: [helper.accessor("name"), helper.accessor("age")],
 *   getRowId: (row) => row.id,
 * });
 *
 * table.setSorting([{ id: "age", desc: true }]);
 * table.setPageSize(1);
 * export const firstPage = table.getRowModel().rows.map((row) => row.original.name);
 * ```
 * @see {@link createTable}
 * @since 1.0.0
 */
export interface Table<TData> {
  /** A snapshot of every slice. Reads them all: use the per-slice accessors for fine-grained reads. */
  getState(): TableState;
  /** The sorting state. Reading it subscribes to this slice only. */
  readonly sorting: Accessor<SortingState>;
  /** The column filters state. Reading it subscribes to this slice only. */
  readonly columnFilters: Accessor<ColumnFiltersState>;
  /** The global filter. Reading it subscribes to this slice only. */
  readonly globalFilter: Accessor<unknown>;
  /** The pagination state. Reading it subscribes to this slice only. */
  readonly pagination: Accessor<PaginationState>;
  /** The row selection state. Reading it subscribes to this slice only. */
  readonly rowSelection: Accessor<RowSelectionState>;
  /** The expansion state. Reading it subscribes to this slice only. */
  readonly expanded: Accessor<ExpandedState>;
  /** The column visibility state. Reading it subscribes to this slice only. */
  readonly columnVisibility: Accessor<ColumnVisibilityState>;
  /** The column order state. Reading it subscribes to this slice only. */
  readonly columnOrder: Accessor<ColumnOrderState>;
  /** The column pinning state. Reading it subscribes to this slice only. */
  readonly columnPinning: Accessor<ColumnPinningState>;
  /** The column sizing state. Reading it subscribes to this slice only. */
  readonly columnSizing: Accessor<ColumnSizingState>;
  /** The grouping state. Reading it subscribes to this slice only. */
  readonly grouping: Accessor<GroupingState>;

  /**
   * Sets the sorting state. On a controlled slice the value is only reported to `onStateChange`, as
   * for every setter below.
   * @param value The new state, or a function of the previous state.
   */
  setSorting(value: SortingState | ((previous: SortingState) => SortingState)): void;
  /**
   * Sets the column filters state.
   * @param value The new state, or a function of the previous state.
   */
  setColumnFilters(
    value: ColumnFiltersState | ((previous: ColumnFiltersState) => ColumnFiltersState),
  ): void;
  /**
   * Sets the global filter.
   * @param value The new filter. Stored as given: a function is the value, not an updater.
   */
  setGlobalFilter(value: unknown): void;
  /**
   * Sets the pagination state as given, without clamping (see {@link Table.setPageIndex}).
   * @param value The new state, or a function of the previous state.
   */
  setPagination(value: PaginationState | ((previous: PaginationState) => PaginationState)): void;
  /**
   * Sets the row selection state.
   * @param value The new state, or a function of the previous state.
   */
  setRowSelection(
    value: RowSelectionState | ((previous: RowSelectionState) => RowSelectionState),
  ): void;
  /**
   * Sets the expansion state.
   * @param value The new state, or a function of the previous state.
   */
  setExpanded(value: ExpandedState | ((previous: ExpandedState) => ExpandedState)): void;
  /**
   * Sets the column visibility state.
   * @param value The new state, or a function of the previous state.
   */
  setColumnVisibility(
    value: ColumnVisibilityState | ((previous: ColumnVisibilityState) => ColumnVisibilityState),
  ): void;
  /**
   * Sets the column order state.
   * @param value The new state, or a function of the previous state.
   */
  setColumnOrder(
    value: ColumnOrderState | ((previous: ColumnOrderState) => ColumnOrderState),
  ): void;
  /**
   * Sets the column pinning state.
   * @param value The new state, or a function of the previous state.
   */
  setColumnPinning(
    value: ColumnPinningState | ((previous: ColumnPinningState) => ColumnPinningState),
  ): void;
  /**
   * Sets the column sizing state.
   * @param value The new state, or a function of the previous state.
   */
  setColumnSizing(
    value: ColumnSizingState | ((previous: ColumnSizingState) => ColumnSizingState),
  ): void;
  /**
   * Sets the grouping state.
   * @param value The new state, or a function of the previous state.
   */
  setGrouping(value: GroupingState | ((previous: GroupingState) => GroupingState)): void;
  /** Sets the sorting state back to `initialState.sorting`, or `[]`. */
  resetSorting(): void;
  /** Sets the column filters back to `initialState.columnFilters`, or `[]`. */
  resetColumnFilters(): void;
  /** Sets the global filter back to `initialState.globalFilter`, or `""`. */
  resetGlobalFilter(): void;
  /** Sets the row selection back to `initialState.rowSelection`, or `{}`. */
  resetRowSelection(): void;
  /** Sets the expansion back to `initialState.expanded`, or `{}`. */
  resetExpanded(): void;

  /** Every column at every depth, parents before their children, in definition order. */
  getAllColumns(): readonly Column<TData>[];
  /** The columns without children, in definition order, hidden ones included. */
  getAllLeafColumns(): readonly Column<TData>[];
  /** The visible leaf columns, in column order. */
  getVisibleLeafColumns(): readonly Column<TData>[];
  /** The visible leaf columns pinned left, in the order of `columnPinning.left`. */
  getLeftLeafColumns(): readonly Column<TData>[];
  /** The visible leaf columns that are not pinned, in column order. */
  getCenterLeafColumns(): readonly Column<TData>[];
  /** The visible leaf columns pinned right, in the order of `columnPinning.right`. */
  getRightLeafColumns(): readonly Column<TData>[];
  /**
   * A column at any depth by id.
   * @param id The column id.
   * @returns The column, or `undefined` when no column has the id.
   */
  getColumn(id: string): Column<TData> | undefined;
  /**
   * One header group per level of column nesting, from the top level down to the deepest visible
   * leaf, over the visible leaves in column order. Empty when no leaf is visible.
   */
  getHeaderGroups(): readonly HeaderGroup<TData>[];
  /** The sum of the sizes of the visible leaf columns. */
  getTotalSize(): number;

  /** Every row made from the data: the root rows in data order, with their sub rows. */
  getCoreRowModel(): RowModel<TData>;
  /**
   * The rows the column and global filters keep, as a tree: a row is kept when it passes or a row
   * under it is kept, and each kept row holds only its kept sub rows. Every row with `manualFiltering`.
   */
  getFilteredRowModel(): RowModel<TData>;
  /**
   * The group rows when the grouping state is set (and `manualGrouping` is off), one per value in the
   * order values first appear; otherwise the filtered rows.
   */
  getGroupedRowModel(): RowModel<TData>;
  /**
   * The grouped tree sorted at every depth: the roots and the sub rows of each row in sorted order
   * (unchanged with `manualSorting`).
   */
  getSortedRowModel(): RowModel<TData>;
  /** The sorted root rows, each expanded row followed by its sorted sub rows: every row to page. */
  getExpandedRowModel(): RowModel<TData>;
  /** The rows before pagination: the same rows as {@link Table.getExpandedRowModel}. */
  getPrePaginationRowModel(): RowModel<TData>;
  /**
   * The rows to show: the current page of the expanded model (every row of it with
   * `manualPagination`).
   */
  getRowModel(): RowModel<TData>;
  /** The selected rows made from the data, at every depth, parents before children. */
  getSelectedRowModel(): RowModel<TData>;
  /**
   * A row made from the data, at any depth, by id. Group rows are not found.
   * @param id The row id.
   * @returns The row, or `undefined` when no row has the id.
   */
  getRow(id: string): Row<TData> | undefined;
  /**
   * The number of rows the filters keep, at every depth: the rows of the filtered model. Every row
   * with `manualFiltering`. Grouping and pagination do not change it.
   */
  getRowCount(): number;

  /**
   * The number of pages of the expanded model (0 when it has no rows), or `pageCount` with
   * `manualPagination`.
   */
  getPageCount(): number;
  /** Whether the page index is above 0. */
  getCanPreviousPage(): boolean;
  /** Whether a page follows the current one, or the page count is unknown (negative). */
  getCanNextPage(): boolean;
  /**
   * Shows a page. The index is rounded down and clamped between 0 and the last page (no upper bound
   * while the page count is unknown).
   * @param index The page index, from 0.
   */
  setPageIndex(index: number): void;
  /**
   * Sets the rows per page (rounded down, at least 1) and moves to the page that holds the first row
   * of the current page.
   * @param size The rows per page.
   */
  setPageSize(size: number): void;
  /** Shows the previous page; stays on the first page. */
  previousPage(): void;
  /** Shows the next page; stays on the last page. */
  nextPage(): void;
  /** Shows the first page. */
  firstPage(): void;
  /** Shows the last page. */
  lastPage(): void;

  /** Whether every root row is selected; `false` when there are no rows. */
  getIsAllRowsSelected(): boolean;
  /** Whether some root rows are selected, but not all. */
  getIsSomeRowsSelected(): boolean;
  /**
   * Selects every row made from the data, at every depth, or clears the selection.
   * @param value `true` to select all, `false` to clear; omitted, selects all unless all are selected.
   */
  toggleAllRowsSelected(value?: boolean): void;
  /** Whether the expansion state is `true` (every row expanded). */
  getIsAllRowsExpanded(): boolean;
  /** Whether any row made from the data has sub rows. */
  getCanSomeRowsExpand(): boolean;
  /**
   * Expands every row (state `true`) or collapses every row (state `{}`).
   * @param value `true` to expand, `false` to collapse; omitted, the opposite of
   *   {@link Table.getIsAllRowsExpanded}.
   */
  toggleAllRowsExpanded(value?: boolean): void;
}

/**
 * The opt-in features a table can have. Each is a subpath of `@shadow-js/table`, and its name is the
 * name of its export and of its subpath: `grouping` (grouping and aggregation), `expanding` (sub
 * rows), `pinning`, `sizing`, `layout` (header rows and `getStart`), `faceting`, `visibility` and
 * `ordering`.
 * @example
 * ```ts
 * import type { TableFeatureName } from "@shadow-js/table";
 *
 * const name: TableFeatureName = "grouping";
 * ```
 * @since 1.0.0
 */
export type TableFeatureName =
  | "grouping"
  | "expanding"
  | "pinning"
  | "sizing"
  | "layout"
  | "faceting"
  | "visibility"
  | "ordering"
  | "locale";

/**
 * One opt-in feature of a table. The objects come from their subpaths (`grouping` from
 * `@shadow-js/table/grouping`, and so on), or all of them from `@shadow-js/table/full`.
 * @example
 * ```ts
 * import { type TableFeature } from "@shadow-js/table";
 * import { grouping } from "@shadow-js/table/grouping";
 *
 * const features: readonly TableFeature[] = [grouping];
 * ```
 * @since 1.0.0
 */
export interface TableFeature<N extends TableFeatureName = TableFeatureName> {
  /** The feature's name, which is also its export name and subpath. */
  readonly name: N;
  /** Attaches the feature to a new table. Called once by `createTable`, before anything is read. */
  readonly install: <TData>(host: TableHost<TData>) => void;
}
