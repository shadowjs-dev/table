/**
 * `createTable`: the headless table over signals. The core holds the columns, the rows, sorting,
 * filtering, pagination and row selection. Row models are memoized pipelines (core, filtered,
 * sorted, paginated), and selection is a per-row signal, so a row's checkbox updates alone.
 *
 * Everything else is an opt-in feature (`features`, see `@shadow-js/table/full`): grouping, sub rows,
 * pinning, sizing, header rows, faceting, visibility and column order. A table without a feature does
 * not contain its code, and calling one of its members throws a `TypeError` that names the feature.
 * @packageDocumentation
 */
import { type Accessor, untrack, useMemo, useSignal } from "@shadow-js/core";
import {
  compareCaseless,
  compareCodes,
  compareValues,
  filterByName,
  includesString,
  isUnordered,
} from "./internal/functions";
import {
  type CoreRows,
  DEFAULT_SIZE,
  type RowInit,
  type Side,
  type Slice,
  sizeOfDef,
  type TableHooks,
  type TableHost,
  untracked,
} from "./internal/host";
import { keyedFlags } from "./internal/keyed";
import { absent, featureMissing } from "./internal/missing";
import {
  leavesOf,
  NO_ROWS,
  pushReversed,
  subRowsOf,
  treeModel,
  type View,
  walk,
} from "./internal/tree";
import type {
  Cell,
  CellContext,
  Column,
  ColumnDef,
  FilterFn,
  PaginationState,
  Row,
  RowModel,
  SortingEntry,
  Table,
  TableFeature,
  TableFeatureName,
  TableOptions,
  TableState,
} from "./types";

/** The state an uncontrolled table starts from when a feature is not installed. */
const EMPTY: TableState = {
  sorting: [],
  columnFilters: [],
  globalFilter: "",
  pagination: { pageIndex: 0, pageSize: 10 },
  rowSelection: {},
  expanded: {},
  columnVisibility: {},
  columnOrder: [],
  columnPinning: {},
  columnSizing: {},
  grouping: [],
};

/**
 * The table members each feature owns, one group per feature: the feature, then its members. They
 * exist from the start and throw until the feature is installed.
 */
const OWNED_TABLE =
  "grouping grouping setGrouping getGroupedRowModel," +
  "expanding expanded setExpanded resetExpanded getIsAllRowsExpanded getCanSomeRowsExpand toggleAllRowsExpanded," +
  "pinning columnPinning setColumnPinning getLeftLeafColumns getCenterLeafColumns getRightLeafColumns," +
  "sizing columnSizing setColumnSizing," +
  "layout getHeaderGroups getTotalSize," +
  "visibility columnVisibility setColumnVisibility," +
  "ordering columnOrder setColumnOrder";

/** The column members each feature owns (see {@link OWNED_TABLE}). */
const OWNED_COLUMN =
  "grouping getCanGroup getIsGrouped toggleGrouping," +
  "pinning getIsPinned getCanPin pin," +
  "sizing getCanResize," +
  "layout getStart," +
  "faceting getFacetedRowModel getFacetedUniqueValues getFacetedMinMaxValues," +
  "visibility getIsVisible getCanHide toggleVisibility";

/** Something both a column and a row can be asked for by id. */
type Lookup<TData> = Map<string, Column<TData>>;

/** The members that the state slices add to the table: the core literal leaves them out. */
type CoreSliceMember =
  | "sorting"
  | "setSorting"
  | "columnFilters"
  | "setColumnFilters"
  | "globalFilter"
  | "setGlobalFilter"
  | "pagination"
  | "setPagination"
  | "rowSelection"
  | "setRowSelection";

/** The table members the features own (the names only), so the core literal leaves them out. */
type OwnedTableName =
  | "grouping"
  | "setGrouping"
  | "getGroupedRowModel"
  | "expanded"
  | "setExpanded"
  | "resetExpanded"
  | "getIsAllRowsExpanded"
  | "getCanSomeRowsExpand"
  | "toggleAllRowsExpanded"
  | "columnPinning"
  | "setColumnPinning"
  | "getLeftLeafColumns"
  | "getCenterLeafColumns"
  | "getRightLeafColumns"
  | "columnSizing"
  | "setColumnSizing"
  | "getHeaderGroups"
  | "getTotalSize"
  | "columnVisibility"
  | "setColumnVisibility"
  | "columnOrder"
  | "setColumnOrder";

/**
 * The members a list of owned names needs, each a function that throws the feature error. A name that
 * is a state slice (a key of {@link EMPTY}) is recorded in `owners` with the feature that owns it: a
 * table that starts from that state needs the feature.
 */
function absentMembers(
  owned: string,
  prefix: string,
  owners?: Map<string, TableFeatureName>,
): Record<string, () => never> {
  const out: Record<string, () => never> = {};
  for (const group of owned.split(",")) {
    const [feature, ...names] = group.split(" ") as [TableFeatureName, ...string[]];
    for (const name of names) {
      out[name] = absent(feature, `${prefix}.${name}`);
      if (name in EMPTY) owners?.set(name, feature);
    }
  }
  return out;
}

/**
 * The column definitions flattened to columns, each knowing its parent and its children. `out` receives every column at
 * every depth, parents before their children. Iterative: how deep column groups nest is the app's choice, so it must not
 * be a limit of the call stack. A work item is a definition, its parent and the array the column joins; an item without a
 * definition marks its column complete, which is when its id is registered (after its children's).
 */
function buildColumns<TData>(
  defs: readonly ColumnDef<TData>[],
  out: Column<TData>[],
  lookup: Lookup<TData>,
): void {
  type Work = readonly [ColumnDef<TData> | undefined, Column<TData> | undefined, Column<TData>[]];
  const stack: Work[] = [];
  // The stack pops the last pushed, so a list goes in reversed to be made in order.
  const queue = (
    list: readonly ColumnDef<TData>[],
    parent: Column<TData> | undefined,
    into: Column<TData>[],
  ) => {
    for (const def of [...list].reverse()) stack.push([def, parent, into]);
  };
  queue(defs, undefined, []);
  for (let work = stack.pop(); work !== undefined; work = stack.pop()) {
    const [def, parent, into] = work;
    if (def === undefined) {
      if (parent !== undefined && parent.id !== "") lookup.set(parent.id, parent);
      continue;
    }
    const children: Column<TData>[] = [];
    const depth = parent === undefined ? 0 : parent.depth + 1;
    const column = createColumn(def, parent, depth, children);
    out.push(column);
    into.push(column);
    stack.push([undefined, column, children]);
    if ("columns" in def) queue(def.columns, column, children);
  }
}

/** One column object; the state methods are attached by {@link createTable}. */
function createColumn<TData>(
  def: ColumnDef<TData>,
  parent: Column<TData> | undefined,
  depth: number,
  children: Column<TData>[],
): Column<TData> {
  const key = "accessorKey" in def ? def.accessorKey : undefined;
  const computed = "accessorFn" in def ? def.accessorFn : undefined;
  return {
    id: def.id ?? key ?? "",
    depth,
    columnDef: def,
    parent,
    columns: children,
    accessorFn:
      computed ??
      (key === undefined
        ? undefined
        : (original: TData) => (original as Record<string, unknown>)[key]),
  } as unknown as Column<TData>;
}

/**
 * Creates a headless table over signals: the state slices, the columns and headers, and the row
 * model pipeline (core, filtered, sorted, paginated). Call it in a component or once at module scope.
 * Nothing is computed until a row model is read, and each model is memoized on the state it reads.
 * The table renders nothing and owns no effects or timers, so it runs on the server too.
 *
 * Pass the features the table uses in `features`: `grouping` (`@shadow-js/table/grouping`) groups
 * rows, `expanding` shows sub rows, and so on. Without `expanding`, only the root rows are shown.
 *
 * @param options The data, the columns, the features, the starting or controlled state, and the manual switches.
 * @returns The table.
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
 *   data: [
 *     { id: "1", name: "Ada", age: 36 },
 *     { id: "2", name: "Grace", age: 85 },
 *     { id: "3", name: "Linus", age: 54 },
 *   ],
 *   columns: [helper.accessor("name", { header: "Name" }), helper.accessor("age", { header: "Age" })],
 *   getRowId: (row) => row.id,
 *   initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
 * });
 *
 * table.getColumn("age")?.toggleSorting(true);
 * export const firstPage = table.getRowModel().rows.map((row) => row.original.name);
 * ```
 * @see {@link useTable}
 * @see {@link TableOptions}
 * @since 1.0.0
 */
export function createTable<TData>(options: TableOptions<TData>): Table<TData> {
  const dataOf: () => readonly TData[] =
    typeof options.data === "function" ? options.data : () => options.data as readonly TData[];
  const initial = options.initialState ?? {};
  const defaultSize = options.defaultColumnSize ?? DEFAULT_SIZE;
  /** The members that the slices add to the table (`name` and `setName`), put on it once the features are installed. */
  const members: Record<string, unknown> = {};
  const register = (
    name: keyof TableState,
    slice: { readonly current: Accessor<unknown>; readonly set: unknown },
  ): void => {
    members[name] = slice.current;
    members[name.replace(/^./, (first) => `set${first.toUpperCase()}`)] = slice.set;
  };
  /** The controlled filters and grouping, with the value each had when the page was last written (see `pageNow`). */
  const seen = new Map<Accessor<unknown>, unknown>();
  /** Whether the table owns the page: manual pagination and a controlled page are left to the caller. */
  const auto = options.manualPagination !== true && options.state?.pagination === undefined;

  /** One slice of state: its signal, or the controlled accessor, and the setter. */
  function slice<K extends keyof TableState>(
    name: K,
    fallback: TableState[K],
    onWrite?: (next: TableState[K]) => void,
  ): Slice<TableState[K]> {
    const controlled = options.state?.[name] as Accessor<TableState[K]> | undefined;
    const [read, write] = useSignal<TableState[K]>(initial[name] ?? fallback);
    const current: Accessor<TableState[K]> = controlled ?? read;
    if (auto && controlled !== undefined && onWrite === resetPage)
      seen.set(controlled, untrack(controlled));
    // Untracked as a whole: the updater, `onWrite` and `onStateChange` are the app's callbacks.
    const set = untracked((value: TableState[K] | ((previous: TableState[K]) => TableState[K])) => {
      const next =
        typeof value === "function" && name !== "globalFilter"
          ? (value as (previous: TableState[K]) => TableState[K])(current())
          : (value as TableState[K]);
      if (controlled === undefined) {
        // An updater that ignores its argument: the value itself may be a function (a global filter).
        write(() => next);
        onWrite?.(next);
      }
      options.onStateChange?.(name, next);
    });
    const made = { current, set, controlled: controlled !== undefined };
    register(name, made);
    return made;
  }

  /**
   * Automatic pagination: a change of the rows a filter or a grouping keeps returns to the first
   * page, so a page that no longer exists is never shown. Sorting keeps the page. Manual pagination
   * and a controlled page are left to the caller.
   */
  const resetPage = (): void => {
    // Only a write calls it, which is untracked already.
    if (!auto) return;
    const page = paginationSlice.current();
    if (page.pageIndex !== 0) paginationSlice.set({ ...page, pageIndex: 0 });
  };

  const sortingSlice = slice("sorting", []);
  const filtersSlice = slice("columnFilters", [], resetPage);
  const globalSlice = slice("globalFilter", "", resetPage);
  const pagingSlice = slice("pagination", { pageIndex: 0, pageSize: 10 });
  /**
   * An uncontrolled pager meets a controlled filter or grouping without a write to hook: the table cannot see that
   * signal change, so the page it shows is the first one while any of them differs from what it was when the page was
   * last written, which is when the pager returns to the first page for an uncontrolled filter.
   */
  const pageNow = (): PaginationState => {
    const page = pagingSlice.current();
    return page.pageIndex !== 0 && [...seen].some(([read, value]) => read() !== value)
      ? { ...page, pageIndex: 0 }
      : page;
  };
  const paginationSlice: Slice<PaginationState> = {
    ...pagingSlice,
    current: pageNow,
    set: untracked((value) => {
      const next = typeof value === "function" ? value(pageNow()) : value;
      for (const read of seen.keys()) seen.set(read, read());
      pagingSlice.set(next);
    }),
  };
  register("pagination", paginationSlice);
  // Every write goes through the slice, so the per-key flags can never disagree with the state.
  const selectionSlice = slice("rowSelection", {}, (next) => selectionFlags.sync(next));
  const selectionFlags = keyedFlags(untrack(selectionSlice.current), liveRowIds);

  // ---------------------------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------------------------
  const allColumns: Column<TData>[] = [];
  const lookup: Lookup<TData> = new Map();
  buildColumns(options.columns, allColumns, lookup);
  const leafColumns = allColumns.filter((column) => column.columns.length === 0);
  const columnOf = (id: string): Column<TData> | undefined => lookup.get(id);

  /**
   * The leaf columns under each column, in definition order (a leaf is its own). Built once, so the
   * state of a group is read without walking the column tree.
   */
  const leavesUnder = new Map<Column<TData>, Column<TData>[]>();
  for (const leaf of leafColumns) {
    for (
      let cursor: Column<TData> | undefined = leaf;
      cursor !== undefined;
      cursor = cursor.parent
    ) {
      const list = leavesUnder.get(cursor) ?? [];
      list.push(leaf);
      leavesUnder.set(cursor, list);
    }
  }
  /** The leaves a column's state applies to: its own leaves for a group, itself for a leaf. */
  const targetsOf = (column: Column<TData>): readonly Column<TData>[] =>
    leavesUnder.get(column) ?? [column];

  // ---------------------------------------------------------------------------------------------
  // Hooks: the parts a feature changes. The defaults are the table without the feature.
  // ---------------------------------------------------------------------------------------------
  const hooks: TableHooks<TData> = {
    group: (view) => view,
    groupValue: () => undefined,
    expands: () => false,
    visible: () => true,
    ordered: () => leafColumns,
    side: () => "center",
    sections: (side: Side) => (side === "center" ? visibleLeaves() : []),
    size: (column) => sizeOfDef(column.columnDef, column.columnDef.size ?? defaultSize),
    fold: (text) => text.toLowerCase(),
    collate: (basic) => (basic ? compareCodes : compareCaseless),
    canExpand: absent("expanding", "row.getCanExpand"),
    isExpanded: absent("expanding", "row.getIsExpanded"),
    toggleRow: absent("expanding", "row.toggleExpanded"),
  };

  /** The leaf columns that are shown, in display order. */
  const visibleLeaves = (): Column<TData>[] =>
    hooks.ordered().filter((column) => hooks.visible(column));

  // ---------------------------------------------------------------------------------------------
  // Rows
  // ---------------------------------------------------------------------------------------------
  const rowIdOf = (original: TData, index: number, parent: Row<TData> | undefined): string => {
    if (options.getRowId !== undefined) return options.getRowId(original, index, parent);
    return parent === undefined ? String(index) : `${parent.id}.${index}`;
  };

  /** Builds the core tree iteratively: level by level, so order is kept and depth is not a limit. */
  const buildCore = (): CoreRows<TData> => {
    const roots: Row<TData>[] = [];
    const rowsById = new Map<string, Row<TData>>();
    const queue: { items: readonly TData[]; parent: Row<TData> | undefined; depth: number }[] = [
      { items: dataOf(), parent: undefined, depth: 0 },
    ];
    // The loop sees the levels pushed while it runs.
    for (const level of queue) {
      level.items.forEach((original, index) => {
        const id = rowIdOf(original, index, level.parent);
        const children = options.getSubRows?.(original, index) ?? [];
        const row = makeRow({
          id,
          index,
          depth: level.depth,
          original,
          parent: level.parent,
          subRows: [],
        });
        (level.parent === undefined ? roots : (level.parent.subRows as Row<TData>[])).push(row);
        rowsById.set(id, row);
        if (children.length > 0)
          queue.push({ items: children, parent: row, depth: level.depth + 1 });
      });
    }
    return { roots, rowsById };
  };

  /** A memo computed on first read. The name is a development label only: production passes none. */
  const lazy = <T>(build: () => T, name?: string): Accessor<T> =>
    useMemo(build, __DEV__ ? { lazy: true, name: `table.${name}` } : { lazy: true });

  const coreTree = lazy(buildCore, __DEV__ ? "core" : undefined);

  /** The ids a row can have now: the data's rows, and the group rows of the grouping. */
  function liveRowIds(): ReadonlySet<string> {
    const ids = new Set(coreTree().rowsById.keys());
    const shown = groupedView();
    walk(shown.roots, shown.childrenOf, (row) => {
      ids.add(row.id);
    });
    return ids;
  }

  /** One row object: values, cells, selection and expansion, bound to this table. */
  function makeRow(init: RowInit<TData>): Row<TData> {
    const valueCache = new Map<string, unknown>();
    const cellCache = new Map<string, Cell<TData>>();
    const row: Row<TData> = {
      id: init.id,
      index: init.index,
      depth: init.depth,
      original: init.original,
      parentId: init.parent?.id,
      subRows: init.subRows,
      isGrouped: init.groupingColumnId !== undefined,
      groupingColumnId: init.groupingColumnId,
      groupingValue: init.groupingValue,
      getValue<TValue = unknown>(columnId: string): TValue {
        if (valueCache.has(columnId)) return valueCache.get(columnId) as TValue;
        // The accessor of the column, or for a grouped row what the grouping gives.
        const value = row.isGrouped
          ? hooks.groupValue(row, columnId)
          : columnOf(columnId)?.accessorFn?.(row.original, row.index);
        valueCache.set(columnId, value);
        return value as TValue;
      },
      getGroupingValue(columnId: string): unknown {
        return row.getValue(columnId);
      },
      getIsGrouped(): boolean {
        return row.isGrouped;
      },
      getAllCells(): readonly Cell<TData>[] {
        return leafColumns.map(cellFor);
      },
      getVisibleCells(): readonly Cell<TData>[] {
        return visibleLeaves().map(cellFor);
      },
      getLeafRows(): readonly Row<TData>[] {
        return leavesOf(row, groupedView().childrenOf);
      },
      getParentRow(): Row<TData> | undefined {
        return init.parent;
      },
      getCanSelect(): boolean {
        return options.enableRowSelection !== false;
      },
      getIsSelected(): boolean {
        return isSelected(row.id);
      },
      getIsSomeSelected(): boolean {
        return someSelected(row.subRows);
      },
      toggleSelected: untracked((value?: boolean): void => {
        const next = value ?? !isSelected(row.id);
        const map = { ...selectionSlice.current() } as Record<string, boolean>;
        const mark = (id: string, on: boolean): void => {
          if (on) map[id] = true;
          else delete map[id];
        };
        if (options.enableSubRowSelection === false) mark(row.id, next);
        else {
          walk([row], subRowsOf, (each) => mark(each.id, next));
          // A parent is selected exactly when every row under it is, so the rows above follow this one.
          for (let up = init.parent; up !== undefined; up = up.getParentRow())
            mark(
              up.id,
              up.subRows.every((child) => map[child.id] === true),
            );
        }
        selectionSlice.set(map);
      }),
      getCanExpand(): boolean {
        return hooks.canExpand(row);
      },
      getIsExpanded(): boolean {
        return hooks.isExpanded(row);
      },
      toggleExpanded(value?: boolean): void {
        hooks.toggleRow(row, value);
      },
    };

    /** The cell of one column, created once per row. */
    function cellFor(column: Column<TData>): Cell<TData> {
      const known = cellCache.get(column.id);
      if (known !== undefined) return known;
      const getValue = (): unknown => row.getValue(column.id);
      const cell: Cell<TData> = {
        id: `${row.id}_${column.id}`,
        column,
        row,
        getValue,
        renderValue: getValue,
        getContext(): CellContext<TData, unknown> {
          return { table: complete, column, row, cell, getValue, renderValue: getValue };
        },
      };
      cellCache.set(column.id, cell);
      return cell;
    }
    return row;
  }

  // ---------------------------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------------------------
  const filterOf = (
    column: Column<TData>,
  ): ((row: Row<TData>, value: unknown) => boolean) | undefined => {
    const fn = column.columnDef.filterFn;
    if (typeof fn === "function") {
      const custom = fn as FilterFn<TData>;
      return (row, value) => custom(row, column.id, value);
    }
    const named = filterByName(fn ?? "auto", hooks.fold);
    if (named === undefined) return undefined;
    return (row, value) => named(row.getValue(column.id), value);
  };

  const isFilterActive = (value: unknown): boolean =>
    value !== undefined &&
    value !== null &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0);

  /** The tests of one filter pass, built once per pass: every active column filter and the global one. */
  interface FilterPlan<TData> {
    readonly columns: readonly ((row: Row<TData>) => boolean)[];
    readonly globalActive: boolean;
    readonly global: unknown;
    readonly globalIds: readonly string[];
  }

  /** The plan for the state, leaving out the column filter `skip` (a column's own filter, for facets). */
  const planFor = (skip: string | undefined): FilterPlan<TData> => {
    const columns: ((row: Row<TData>) => boolean)[] = [];
    for (const entry of filtersSlice.current()) {
      if (entry.id === skip || !isFilterActive(entry.value)) continue;
      const column = columnOf(entry.id);
      if (column === undefined) continue;
      const fn = filterOf(column);
      if (fn !== undefined) columns.push((row) => fn(row, entry.value));
    }
    const global = globalSlice.current();
    return {
      columns,
      globalActive: isFilterActive(global),
      global,
      globalIds: leafColumns
        .filter((column) => column.columnDef.enableGlobalFilter !== false)
        .map((column) => column.id),
    };
  };

  /** Whether a row passes every test of a plan: all column filters, and any column for the global one. */
  const passesPlan = (row: Row<TData>, plan: FilterPlan<TData>): boolean => {
    return (
      plan.columns.every((test) => test(row)) &&
      (!plan.globalActive ||
        plan.globalIds.some((id) => includesString(row.getValue(id), plan.global, hooks.fold)))
    );
  };

  /**
   * The ids of the core rows the filters keep. A row is kept when it passes, or when a row under it is
   * kept: so a kept row's ancestors are kept too, and the rows shown are exactly the kept ones.
   * `skip` leaves one column's filter out (its facets).
   */
  const keepFor = (skip: string | undefined): Set<string> => {
    const plan = planFor(skip);
    const kept = new Set<string>();
    const order: Row<TData>[] = [];
    walk(coreTree().roots, subRowsOf, (row) => {
      order.push(row);
    });
    // Children first: the reverse of the parents-first order.
    for (const row of order.reverse())
      if (row.subRows.some((child) => kept.has(child.id)) || passesPlan(row, plan))
        kept.add(row.id);
    return kept;
  };

  /** The kept ids for the rows shown: every row with manual filtering (the server filtered them). */
  const filteredKept = lazy(
    (): Set<string> =>
      options.manualFiltering === true ? new Set(coreTree().rowsById.keys()) : keepFor(undefined),
    __DEV__ ? "filtered" : undefined,
  );

  /**
   * The core rows the filters keep, as a tree: each kept row has the kept rows among its sub rows,
   * so a row that does not pass is not shown with its siblings.
   */
  const filteredView = lazy(
    (): View<TData> => {
      const roots = coreTree().roots;
      const kept = filteredKept();
      if (kept.size === coreTree().rowsById.size) return { roots, childrenOf: subRowsOf };
      const children = new Map<string, readonly Row<TData>[]>();
      walk(roots, subRowsOf, (row) => {
        if (row.subRows.length === 0) return;
        const shown = row.subRows.filter((child) => kept.has(child.id));
        if (shown.length > 0) children.set(row.id, shown);
      });
      return {
        roots: roots.filter((row) => kept.has(row.id)),
        childrenOf: (row) => children.get(row.id) ?? NO_ROWS,
      };
    },
    __DEV__ ? "filteredView" : undefined,
  );

  /** The tree the rows are shown in: the filtered rows, reshaped by the grouping hook (identity without it). */
  const groupedView = lazy(
    (): View<TData> => hooks.group(filteredView()),
    __DEV__ ? "grouped" : undefined,
  );

  // ---------------------------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------------------------
  const comparatorOf = (
    entries: readonly SortingEntry[],
  ): ((a: Row<TData>, b: Row<TData>) => number) | undefined => {
    const parts = entries.flatMap((entry) => {
      const column = columnOf(entry.id);
      if (column === undefined || column.columnDef.enableSorting === false) return [];
      return [{ id: column.id, desc: entry.desc, custom: column.columnDef.sortingFn }];
    });
    if (parts.length === 0) return undefined;
    return (a, b) => {
      for (const { id, desc, custom } of parts) {
        let result: number;
        if (typeof custom === "function") result = custom(a, b, id);
        else {
          const va = a.getValue(id);
          const vb = b.getValue(id);
          const missing = isUnordered(va);
          if (missing || isUnordered(vb)) {
            // Missing values, NaN and invalid dates go last whatever the direction.
            if (missing && isUnordered(vb)) continue;
            return missing ? 1 : -1;
          }
          result = compareValues(va, vb, hooks.collate(custom === "basic"));
        }
        if (result !== 0) return desc ? -result : result;
      }
      return 0;
    };
  };

  /**
   * The grouped tree sorted at every depth: the roots, and the children of each row, in order. The
   * sort is stable, so rows that compare equal keep their order.
   */
  const sortedView = lazy(
    (): View<TData> => {
      const grouped = groupedView();
      const compare =
        options.manualSorting === true ? undefined : comparatorOf(sortingSlice.current());
      if (compare === undefined) return grouped;
      const children = new Map<string, readonly Row<TData>[]>();
      const roots = [...grouped.roots].sort(compare);
      walk(roots, grouped.childrenOf, (row) => {
        const kids = grouped.childrenOf(row);
        if (kids.length > 0) children.set(row.id, [...kids].sort(compare));
      });
      return { roots, childrenOf: (row) => children.get(row.id) ?? NO_ROWS };
    },
    __DEV__ ? "sorted" : undefined,
  );

  // ---------------------------------------------------------------------------------------------
  // Expansion and pagination
  // ---------------------------------------------------------------------------------------------
  /** Whether any row at or under the given rows is selected (stops reading at the first one). */
  function someSelected(rows: readonly Row<TData>[]): boolean {
    let found = false;
    walk(rows, subRowsOf, (row) => {
      found ||= isSelected(row.id);
    });
    return found;
  }

  function isSelected(id: string): boolean {
    if (selectionSlice.controlled) return selectionSlice.current()[id] === true;
    return selectionFlags.get(id);
  }

  /** The visible rows: sorted roots, and the children of each row the expanding hook shows, in order. */
  const expandedRows = lazy(
    (): readonly Row<TData>[] => {
      const sorted = sortedView();
      const out: Row<TData>[] = [];
      const stack: Row<TData>[] = [];
      pushReversed(stack, sorted.roots);
      for (let row = stack.pop(); row !== undefined; row = stack.pop()) {
        out.push(row);
        const children = sorted.childrenOf(row);
        if (children.length > 0 && hooks.expands(row)) pushReversed(stack, children);
      }
      return out;
    },
    __DEV__ ? "expanded" : undefined,
  );

  /** A page size the pager can use: a whole number of at least 1 (`Infinity` shows every row), 10 for NaN. */
  const pageSizeOf = (raw: number): number => (raw >= 1 ? Math.floor(raw) : raw < 1 ? 1 : 10);
  /** The first row of a page; `0 * Infinity` is NaN, so the first page starts at 0 whatever the size. */
  const startOf = (index: number, size: number): number => (index === 0 ? 0 : index * size);

  const pageCountOf = (): number => {
    if (options.manualPagination === true) return options.pageCount ?? -1;
    const total = expandedRows().length;
    return total === 0
      ? 0
      : Math.max(1, Math.ceil(total / pageSizeOf(paginationSlice.current().pageSize)));
  };

  /** The page index in effect: a whole number from 0. A page past the last one shows no rows (documented). */
  const pageIndexOf = (): number => {
    const asked = paginationSlice.current().pageIndex;
    if (options.manualPagination === true) return asked;
    return asked > 0 ? Math.floor(asked) : 0;
  };

  /** The rows of the current page. */
  const pageRows = lazy(
    (): readonly Row<TData>[] => {
      const rows = expandedRows();
      if (options.manualPagination === true) return rows;
      const size = pageSizeOf(paginationSlice.current().pageSize);
      const start = startOf(pageIndexOf(), size);
      return rows.slice(start, start + size);
    },
    __DEV__ ? "page" : undefined,
  );

  // ---------------------------------------------------------------------------------------------
  // Row models
  // ---------------------------------------------------------------------------------------------
  /** A model that is a list of rows: its flat rows are its rows. */
  const listModel = (rows: readonly Row<TData>[]): RowModel<TData> =>
    treeModel({ roots: rows, childrenOf: () => NO_ROWS });

  const coreModel = lazy(
    () => treeModel({ roots: coreTree().roots, childrenOf: subRowsOf }),
    __DEV__ ? "model.core" : undefined,
  );
  const filteredModel = lazy(
    () => treeModel(filteredView()),
    __DEV__ ? "model.filtered" : undefined,
  );
  const sortedModel = lazy(() => treeModel(sortedView()), __DEV__ ? "model.sorted" : undefined);
  const expandedModel = lazy(
    () => listModel(expandedRows()),
    __DEV__ ? "model.expanded" : undefined,
  );
  const pageModel = lazy(() => listModel(pageRows()), __DEV__ ? "model.page" : undefined);
  const selectedModel = lazy(
    () => {
      const selection = selectionSlice.current();
      const selected: Row<TData>[] = [];
      walk(coreTree().roots, subRowsOf, (row) => {
        if (selection[row.id] === true) selected.push(row);
      });
      return listModel(selected);
    },
    __DEV__ ? "model.selected" : undefined,
  );

  // ---------------------------------------------------------------------------------------------
  // The table
  // ---------------------------------------------------------------------------------------------
  const table: Omit<Table<TData>, OwnedTableName | CoreSliceMember> = {
    getState(): TableState {
      // The keys of EMPTY are the slices, in the order the state is documented; a slice whose feature is not installed
      // reads as its empty value.
      return Object.fromEntries(
        Object.keys(EMPTY).map((name) => {
          const reader = members[name] as (() => unknown) | undefined;
          return [name, reader === undefined ? EMPTY[name as keyof TableState] : reader()];
        }),
      ) as unknown as TableState;
    },
    resetSorting: () => sortingSlice.set(initial.sorting ?? []),
    resetColumnFilters: () => filtersSlice.set(initial.columnFilters ?? []),
    resetGlobalFilter: () => globalSlice.set(initial.globalFilter ?? ""),
    resetRowSelection: () => selectionSlice.set(initial.rowSelection ?? {}),

    getAllColumns: () => allColumns,
    getAllLeafColumns: () => leafColumns,
    getVisibleLeafColumns: visibleLeaves,
    getColumn: columnOf,

    getCoreRowModel: coreModel,
    getFilteredRowModel: filteredModel,
    getSortedRowModel: sortedModel,
    getExpandedRowModel: expandedModel,
    getPrePaginationRowModel: expandedModel,
    getRowModel: pageModel,
    getSelectedRowModel: selectedModel,
    getRow: (id) => coreTree().rowsById.get(id),
    getRowCount: () => filteredKept().size,

    getPageCount: pageCountOf,
    getCanPreviousPage: () => pageIndexOf() > 0,
    getCanNextPage: () => {
      const count = pageCountOf();
      return count < 0 || pageIndexOf() < count - 1;
    },
    setPageIndex: untracked((index: number): void => {
      const count = pageCountOf();
      const upper = count < 0 ? Number.MAX_SAFE_INTEGER : Math.max(0, count - 1);
      // A NaN (an empty number input, `parseInt("")`) is the first page, never a NaN in the state.
      const clamped = Math.min(index > 0 ? Math.floor(index) : 0, upper);
      paginationSlice.set({ ...paginationSlice.current(), pageIndex: clamped });
    }),
    setPageSize: untracked((size: number): void => {
      const next = pageSizeOf(size);
      const current = paginationSlice.current();
      const firstRow = startOf(pageIndexOf(), pageSizeOf(current.pageSize));
      // An index past the one page of an `Infinity` size (written through `setPagination`) starts at no finite row: the
      // first page, never an `Infinity` or `NaN` index.
      const pageIndex = firstRow < Infinity ? Math.floor(firstRow / next) : 0;
      paginationSlice.set({ pageIndex, pageSize: next });
    }),
    previousPage: untracked(() => table.setPageIndex(pageIndexOf() - 1)),
    nextPage: untracked(() => table.setPageIndex(pageIndexOf() + 1)),
    firstPage: () => table.setPageIndex(0),
    lastPage: untracked(() => table.setPageIndex(Math.max(0, pageCountOf() - 1))),

    getIsAllRowsSelected(): boolean {
      const roots = coreTree().roots;
      return roots.length > 0 && roots.every((row) => isSelected(row.id));
    },
    getIsSomeRowsSelected(): boolean {
      // Some row at any depth: a lone selected child counts, though no root row is selected.
      return !table.getIsAllRowsSelected() && someSelected(coreTree().roots);
    },
    toggleAllRowsSelected: untracked((value?: boolean): void => {
      const next = value ?? !table.getIsAllRowsSelected();
      const map: Record<string, boolean> = {};
      if (next) {
        walk(coreTree().roots, subRowsOf, (row) => {
          map[row.id] = true;
        });
      }
      selectionSlice.set(map);
    }),
  };

  // Column methods of the core: sorting, and the column and global filters.
  const isSortable = (column: Column<TData>): boolean =>
    column.columnDef.enableSorting !== false && column.columns.length === 0;
  for (const column of allColumns) {
    Object.assign(column, {
      getSize: (): number => hooks.size(column),
      getCanSort: (): boolean => isSortable(column),
      getIsSorted: (): false | "asc" | "desc" => {
        const entry = sortingSlice.current().find((item) => item.id === column.id);
        return entry !== undefined && (entry.desc ? "desc" : "asc");
      },
      getFirstSortDir: (): "asc" | "desc" =>
        column.columnDef.sortDescFirst === true ? "desc" : "asc",
      toggleSorting: untracked((desc?: boolean, multi?: boolean): void => {
        const current = sortingSlice.current();
        const existing = current.find((item) => item.id === column.id);
        const first = column.columnDef.sortDescFirst === true;
        // `undefined` removes the column from the sorting.
        const next =
          desc ?? (existing === undefined ? first : existing.desc === first ? !first : undefined);
        const entry: SortingEntry[] = next === undefined ? [] : [{ id: column.id, desc: next }];
        sortingSlice.set(
          multi === true && column.columnDef.enableMultiSort !== false
            ? existing === undefined
              ? [...current, ...entry]
              : current.flatMap((item) => (item.id === column.id ? entry : [item]))
            : entry,
        );
      }),
      getCanFilter: (): boolean =>
        column.columnDef.enableColumnFilter !== false && column.columns.length === 0,
      getFilterValue: (): unknown =>
        filtersSlice.current().find((item) => item.id === column.id)?.value,
      setFilterValue: untracked((value: unknown): void => {
        const others = filtersSlice.current().filter((item) => item.id !== column.id);
        filtersSlice.set(isFilterActive(value) ? [...others, { id: column.id, value }] : others);
      }),
      getCanGlobalFilter: (): boolean =>
        column.columnDef.enableGlobalFilter !== false && column.columns.length === 0,
    });
  }

  // Every member a feature owns exists from the start and throws until its feature is installed. The
  // literal above lists the core members only, so the cast adds the rest (they are all in place now).
  const columnStubs = absentMembers(OWNED_COLUMN, "column");
  const owners = new Map<string, TableFeatureName>();
  const complete = Object.assign(
    table,
    absentMembers(OWNED_TABLE, "table", owners),
  ) as unknown as Table<TData>;
  for (const column of allColumns) Object.assign(column, columnStubs);

  const host: TableHost<TData> = {
    table: complete,
    options,
    initial,
    hooks,
    defaultSize,
    columns: allColumns,
    leaves: leafColumns,
    columnOf,
    targetsOf,
    slice,
    resetPage,
    liveRowIds,
    core: coreTree,
    makeRow,
    filtered: filteredView,
    grouped: groupedView,
    keepFor,
    model: lazy,
  };

  // Features: one object per name (the same object twice counts once), each installed once.
  const chosen = new Map<TableFeatureName, TableFeature>();
  for (const feature of options.features ?? []) {
    const known = chosen.get(feature.name);
    if (known === feature) continue;
    if (known !== undefined) {
      throw new TypeError(
        __DEV__
          ? `[shadow-table] two different "${feature.name}" features were passed.`
          : `TABLE_DUPLICATE ${feature.name}`,
      );
    }
    chosen.set(feature.name, feature);
  }
  for (const [name, feature] of owners) {
    if (chosen.has(feature)) continue;
    const key = name as keyof TableState;
    if (initial[key] !== undefined || options.state?.[key] !== undefined) {
      throw featureMissing(feature, `initialState.${name}`);
    }
  }
  if (options.locale !== undefined && !chosen.has("locale"))
    throw featureMissing("locale", "locale");
  for (const feature of chosen.values()) feature.install(host);
  return Object.assign(complete, members);
}

/**
 * The name component code uses for {@link createTable}: the same function, with the same options
 * and result. The table is created by the component that calls it and owns no effects, so nothing is
 * cleaned up when the component is disposed.
 *
 * @param options The data, the columns, the starting or controlled state, and the manual switches.
 * @returns The table.
 * @example
 * ```tsx
 * import { createColumnHelper, useTable } from "@shadow-js/table";
 * import { For } from "@shadow-js/web";
 *
 * interface Person {
 *   id: string;
 *   name: string;
 * }
 *
 * const helper = createColumnHelper<Person>();
 * const columns = [helper.accessor("name", { header: "Name" })];
 *
 * export function People(props: { people: readonly Person[] }) {
 *   const table = useTable({ data: () => props.people, columns, getRowId: (row) => row.id });
 *   return (
 *     <table>
 *       <tbody>
 *         <For each={table.getRowModel().rows}>
 *           {(row) => (
 *             <tr>
 *               <For each={row.getVisibleCells()}>{(cell) => <td>{String(cell.getValue())}</td>}</For>
 *             </tr>
 *           )}
 *         </For>
 *       </tbody>
 *     </table>
 *   );
 * }
 * ```
 * @see {@link createTable}
 * @since 1.0.0
 */
export const useTable: typeof createTable = createTable;
