/**
 * What `createTable` hands to a feature when it installs it: the table object (the feature replaces
 * the members it owns), the hooks the core asks for the parts a feature changes, and the core's
 * internals the feature builds on.
 * @packageDocumentation
 */
import type { Accessor } from "@shadow-js/core";
import type { Column, ColumnDef, Row, RowModel, Table, TableOptions, TableState } from "../types";
import type { View } from "./tree";

/** The default width of a column, when neither the column nor the table sizes it. */
export const DEFAULT_SIZE = 150;

/** The narrowest a column is, unless its definition says otherwise. */
export const MIN_SIZE = 20;

/** The sections a column can render in: pinned left, the center, pinned right. */
export type Side = "left" | "center" | "right";

/** One slice of state: its signal (or the controlled accessor) and its setter. @internal */
export interface Slice<T> {
  readonly current: Accessor<T>;
  readonly set: (value: T | ((previous: T) => T)) => void;
  readonly controlled: boolean;
}

/** The core rows: the roots of the data, and every row by id. @internal */
export interface CoreRows<TData> {
  readonly roots: Row<TData>[];
  readonly rowsById: Map<string, Row<TData>>;
}

/** What a row object is built from. @internal */
export interface RowInit<TData> {
  readonly id: string;
  readonly index: number;
  readonly depth: number;
  readonly original: TData;
  readonly parent: Row<TData> | undefined;
  readonly subRows: Row<TData>[];
  readonly isGrouped: boolean;
  readonly groupingColumnId: string | undefined;
  readonly groupingValue: unknown;
}

/**
 * The parts of the table a feature changes. Each hook has a default that the table without the
 * feature uses: no grouping, no sub rows shown, every column visible in definition order, one
 * section, the column's own width. A feature replaces the hooks it owns when it is installed.
 * @internal
 */
export interface TableHooks<TData> {
  /** Builds the view the rows are shown in from the filtered view (grouping). */
  group: (view: View<TData>) => View<TData>;
  /** The value of a column for a grouped row (grouping). */
  groupValue: (row: Row<TData>, columnId: string) => unknown;
  /** Whether a row shows its sub rows (expanding). */
  expands: (row: Row<TData>) => boolean;
  /** Whether a column is shown. */
  visible: (column: Column<TData>) => boolean;
  /** The leaf columns in display order. */
  ordered: () => readonly Column<TData>[];
  /** The section a leaf column is pinned to (pinning). */
  side: (leaf: Column<TData>) => Side;
  /** The shown leaf columns of one section, in the order they render (pinning). */
  sections: (side: Side) => readonly Column<TData>[];
  /** The width of a column (sizing). */
  size: (column: Column<TData>) => number;
  /** How case is folded for text filters (locale). */
  fold: (text: string) => string;
  /** The text comparison of the sort `basic` (case-sensitive) or of the others (case ignored) (locale). */
  collate: (basic: boolean) => (left: string, right: string) => number;
  /** The expanding row methods: whether a row can expand, is expanded, and is toggled. */
  canExpand: (row: Row<TData>) => boolean;
  isExpanded: (row: Row<TData>) => boolean;
  toggleRow: (row: Row<TData>, value: boolean | undefined) => void;
}

/**
 * What a feature is given when it is installed. A feature adds its members to `table` and its
 * columns, and may set the hooks it owns.
 * @internal
 */
export interface TableHost<TData> {
  /** The table object. A feature replaces the members it owns. */
  readonly table: Table<TData>;
  /** The options `createTable` was given. */
  readonly options: TableOptions<TData>;
  /** The starting state from `initialState`. */
  readonly initial: Partial<TableState>;
  /** The hooks the core asks (see {@link TableHooks}). */
  readonly hooks: TableHooks<TData>;
  /** The width of a column that has no size of its own. */
  readonly defaultSize: number;
  /** Every column at every depth, parents first. */
  readonly columns: readonly Column<TData>[];
  /** The leaf columns, in definition order. */
  readonly leaves: readonly Column<TData>[];
  /** The column with an id, if there is one. */
  readonly columnOf: (id: string) => Column<TData> | undefined;
  /** The leaf columns a column's state applies to: its own leaves for a group, itself for a leaf. */
  readonly targetsOf: (column: Column<TData>) => readonly Column<TData>[];
  /** Creates one slice of state, registered for `getState`. */
  readonly slice: <K extends keyof TableState>(
    name: K,
    fallback: TableState[K],
    onWrite?: (next: TableState[K]) => void,
  ) => Slice<TableState[K]>;
  /** Returns to the first page (a change of the rows a filter or a grouping keeps). */
  readonly resetPage: () => void;
  /** The data as a tree of core rows. */
  readonly core: () => CoreRows<TData>;
  /** Creates a row object bound to this table. */
  readonly makeRow: (init: RowInit<TData>) => Row<TData>;
  /** The rows the filters keep, as a view. */
  readonly filtered: () => View<TData>;
  /** The rows in the shape they are shown in (grouped when grouping is set). */
  readonly grouped: () => View<TData>;
  /** The ids of the core rows kept by the filters, leaving one column's own filter out when given. */
  readonly keepFor: (skip: string | undefined) => Set<string>;
  /** Creates a memoized row model. */
  readonly model: (build: () => RowModel<TData>, name: string) => () => RowModel<TData>;
}

/**
 * The width of a column: `base`, clamped to the column's minimum and maximum.
 * @internal
 */
export function sizeOfDef<TData>(def: ColumnDef<TData>, base: number): number {
  const min = def.minSize ?? MIN_SIZE;
  const max = def.maxSize ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(base, min), max);
}
