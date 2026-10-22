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
  isMissing,
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
  Row,
  RowModel,
  SortingEntry,
  SortingFn,
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

/** The state slices a feature owns, and the feature that owns each. A table that starts from one needs it. */
const STATE_OWNER: readonly (readonly [keyof TableState, TableFeatureName])[] = [
  ["grouping", "grouping"],
  ["expanded", "expanding"],
  ["columnPinning", "pinning"],
  ["columnSizing", "sizing"],
  ["columnVisibility", "visibility"],
  ["columnOrder", "ordering"],
];

/** The table members each feature owns: they exist from the start and throw until the feature is installed. */
const OWNED_TABLE = [
  ["grouping", ["grouping", "setGrouping", "getGroupedRowModel"]],
  [
    "expanding",
    [
      "expanded",
      "setExpanded",
      "resetExpanded",
      "getIsAllRowsExpanded",
      "getCanSomeRowsExpand",
      "toggleAllRowsExpanded",
    ],
  ],
  [
    "pinning",
    [
      "columnPinning",
      "setColumnPinning",
      "getLeftLeafColumns",
      "getCenterLeafColumns",
      "getRightLeafColumns",
    ],
  ],
  ["sizing", ["columnSizing", "setColumnSizing"]],
  ["layout", ["getHeaderGroups", "getTotalSize"]],
  ["visibility", ["columnVisibility", "setColumnVisibility"]],
  ["ordering", ["columnOrder", "setColumnOrder"]],
] as const;

/** The column members each feature owns (see {@link OWNED_TABLE}). */
const OWNED_COLUMN = [
  ["grouping", ["getCanGroup", "getIsGrouped", "toggleGrouping"]],
  ["pinning", ["getIsPinned", "getCanPin", "pin"]],
  ["sizing", ["getCanResize"]],
  ["layout", ["getStart"]],
  ["faceting", ["getFacetedRowModel", "getFacetedUniqueValues", "getFacetedMinMaxValues"]],
  ["visibility", ["getIsVisible", "getCanHide", "toggleVisibility"]],
] as const;

/** Something both a column and a row can be asked for by id. */
type Lookup<TData> = Map<string, Column<TData>>;

/** The table members the features own (the names only), so the core literal leaves them out. */
type OwnedTableName = (typeof OWNED_TABLE)[number][1][number];

/** The members a list of owned names needs, each a function that throws the feature error. */
function absentMembers(
  owned: readonly (readonly [TableFeatureName, readonly string[]])[],
  prefix: string,
): Record<string, () => never> {
  const out: Record<string, () => never> = {};
  for (const [feature, names] of owned) {
    for (const name of names) out[name] = absent(feature, `${prefix}.${name}`);
  }
  return out;
}

/**
 * The column definitions flattened to columns, each knowing its parent and its children. `out`
 * receives every column at every depth, parents before their children; the return value is the
 * columns made at this level only.
 */
function buildColumns<TData>(
  defs: readonly ColumnDef<TData>[],
  parent: Column<TData> | undefined,
  depth: number,
  out: Column<TData>[],
  lookup: Lookup<TData>,
): Column<TData>[] {
  const made: Column<TData>[] = [];
  for (const def of defs) {
    const children: Column<TData>[] = [];
    const id = def.id ?? accessorKeyOf(def) ?? "";
    const column = createColumn(def, id, parent, depth, children);
    out.push(column);
    if ("columns" in def) {
      children.push(...buildColumns(def.columns, column, depth + 1, out, lookup));
    }
    made.push(column);
    if (column.id !== "") lookup.set(column.id, column);
  }
  return made;
}

/** The key a column reads, when it has one. */
function accessorKeyOf<TData>(def: ColumnDef<TData>): string | undefined {
  return "accessorKey" in def ? def.accessorKey : undefined;
}

/** The function a column computes its value with, when it has one. */
function accessorFnOf<TData>(
  def: ColumnDef<TData>,
): ((original: TData, index: number) => unknown) | undefined {
  return "accessorFn" in def
    ? (def.accessorFn as ((original: TData, index: number) => unknown) | undefined)
    : undefined;
}

/** One column object; the state methods are attached by {@link createTable}. */
function createColumn<TData>(
  def: ColumnDef<TData>,
  id: string,
  parent: Column<TData> | undefined,
  depth: number,
  children: Column<TData>[],
): Column<TData> {
  const key = accessorKeyOf(def);
  const computed = accessorFnOf(def);
  const accessorFn: ((original: TData, index: number) => unknown) | undefined =
    computed !== undefined
      ? computed
      : key !== undefined
        ? (original: TData) => (original as Record<string, unknown>)[key]
        : undefined;
  const column = {
    id,
    depth,
    columnDef: def,
    parent,
    columns: children,
    accessorFn,
  } as unknown as Column<TData>;
  return column;
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
  const readers = new Map<keyof TableState, () => unknown>();

  /** One slice of state: its signal, or the controlled accessor, and the setter. */
  function slice<K extends keyof TableState>(
    name: K,
    fallback: TableState[K],
    onWrite?: (next: TableState[K]) => void,
  ): Slice<TableState[K]> {
    const controlled = options.state?.[name] as Accessor<TableState[K]> | undefined;
    const [read, write] = useSignal<TableState[K]>(initial[name] ?? fallback);
    const current: Accessor<TableState[K]> = controlled ?? read;
    const set = (value: TableState[K] | ((previous: TableState[K]) => TableState[K])): void => {
      const previous = untrack(current);
      const next =
        typeof value === "function" && name !== "globalFilter"
          ? (value as (previous: TableState[K]) => TableState[K])(previous)
          : (value as TableState[K]);
      if (controlled === undefined) {
        // An updater that ignores its argument: the value itself may be a function (a global filter).
        write(() => next);
        onWrite?.(next);
      }
      options.onStateChange?.(name, next);
    };
    readers.set(name, current);
    return { current, set, controlled: controlled !== undefined };
  }

  /** The current value of a slice; a slice whose feature is not installed reads as its empty value. */
  const read = <K extends keyof TableState>(name: K): TableState[K] => {
    const reader = readers.get(name);
    return reader === undefined ? EMPTY[name] : (reader() as TableState[K]);
  };

  /**
   * Automatic pagination: a change of the rows a filter or a grouping keeps returns to the first
   * page, so a page that no longer exists is never shown. Sorting keeps the page. Manual pagination
   * and a controlled page are left to the caller.
   */
  const resetPage = (): void => {
    if (options.manualPagination === true || paginationSlice.controlled) return;
    const page = paginationSlice.current();
    if (page.pageIndex !== 0) paginationSlice.set({ ...page, pageIndex: 0 });
  };

  const sortingSlice = slice("sorting", []);
  const filtersSlice = slice("columnFilters", [], resetPage);
  const globalSlice = slice("globalFilter", "", resetPage);
  const paginationSlice = slice("pagination", { pageIndex: 0, pageSize: 10 });
  // Every write goes through the slice, so the per-key flags can never disagree with the state.
  const selectionSlice = slice("rowSelection", {}, (next) => selectionFlags.sync(next));
  const selectionFlags = keyedFlags(untrack(selectionSlice.current));

  // ---------------------------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------------------------
  const allColumns: Column<TData>[] = [];
  const lookup: Lookup<TData> = new Map();
  buildColumns(options.columns, undefined, 0, allColumns, lookup);
  const leafColumns = allColumns.filter((column) => column.columns.length === 0);
  const columnOf = (id: string): Column<TData> | undefined => lookup.get(id);

  /**
   * The leaf columns under each column, in definition order (a leaf is its own). Built once, so the
   * state of a group is read without walking the column tree.
   */
  const leavesUnder = new Map<Column<TData>, Column<TData>[]>();
  for (const leaf of leafColumns) {
    let cursor: Column<TData> | undefined = leaf;
    while (cursor !== undefined) {
      const list = leavesUnder.get(cursor);
      if (list === undefined) leavesUnder.set(cursor, [leaf]);
      else list.push(leaf);
      cursor = cursor.parent;
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
    let cursor = 0;
    while (cursor < queue.length) {
      const level = queue[cursor];
      cursor += 1;
      if (level === undefined) continue;
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
          isGrouped: false,
          groupingColumnId: undefined,
          groupingValue: undefined,
        });
        if (level.parent === undefined) roots.push(row);
        else (level.parent.subRows as Row<TData>[]).push(row);
        rowsById.set(id, row);
        if (children.length > 0)
          queue.push({ items: children, parent: row, depth: level.depth + 1 });
      });
    }
    return { roots, rowsById };
  };

  const coreTree = useMemo(buildCore, { lazy: true, name: "table.core" });

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
      isGrouped: init.isGrouped,
      groupingColumnId: init.groupingColumnId,
      groupingValue: init.groupingValue,
      getValue<TValue = unknown>(columnId: string): TValue {
        if (valueCache.has(columnId)) return valueCache.get(columnId) as TValue;
        const value = valueOfCell(row, columnId);
        valueCache.set(columnId, value);
        return value as TValue;
      },
      getGroupingValue(columnId: string): unknown {
        return row.getValue(columnId);
      },
      getIsGrouped(): boolean {
        return init.isGrouped;
      },
      getAllCells(): readonly Cell<TData>[] {
        return leafColumns.map((column) => cellFor(column));
      },
      getVisibleCells(): readonly Cell<TData>[] {
        return visibleLeaves().map((column) => cellFor(column));
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
        return row.subRows.some((child) => isSelected(child.id));
      },
      toggleSelected(value?: boolean): void {
        const next = value ?? !isSelected(row.id);
        const targets: Row<TData>[] = [];
        if (options.enableSubRowSelection === false) targets.push(row);
        else walk([row], subRowsOf, (each) => targets.push(each));
        const map = { ...selectionSlice.current() } as Record<string, boolean>;
        for (const target of targets) {
          if (next) map[target.id] = true;
          else delete map[target.id];
        }
        selectionSlice.set(map);
      },
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
      const cell: Cell<TData> = {
        id: `${row.id}_${column.id}`,
        column,
        row,
        getValue: () => row.getValue(column.id),
        renderValue: () => row.getValue(column.id),
        getContext(): CellContext<TData, unknown> {
          return {
            table: complete,
            column,
            row,
            cell,
            getValue: cell.getValue,
            renderValue: cell.renderValue,
          };
        },
      };
      cellCache.set(column.id, cell);
      return cell;
    }
    return row;
  }

  /** The value of a column for a row: its accessor, or for a grouped row what the grouping gives. */
  function valueOfCell(row: Row<TData>, columnId: string): unknown {
    if (row.isGrouped) return hooks.groupValue(row, columnId);
    const column = columnOf(columnId);
    if (column?.accessorFn === undefined) return undefined;
    return column.accessorFn(row.original, row.index);
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
    for (const test of plan.columns) if (!test(row)) return false;
    if (plan.globalActive) {
      const matched = plan.globalIds.some((id) =>
        includesString(row.getValue(id), plan.global, hooks.fold),
      );
      if (!matched) return false;
    }
    return true;
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
    for (let index = order.length - 1; index >= 0; index -= 1) {
      const row = order[index];
      if (row === undefined) continue;
      if (row.subRows.some((child) => kept.has(child.id)) || passesPlan(row, plan))
        kept.add(row.id);
    }
    return kept;
  };

  /** The kept ids for the rows shown: every row with manual filtering (the server filtered them). */
  const filteredKept = useMemo(
    (): Set<string> =>
      options.manualFiltering === true ? new Set(coreTree().rowsById.keys()) : keepFor(undefined),
    { lazy: true, name: "table.filtered" },
  );

  /**
   * The core rows the filters keep, as a tree: each kept row has the kept rows among its sub rows,
   * so a row that does not pass is not shown with its siblings.
   */
  const filteredView = useMemo(
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
    { lazy: true, name: "table.filteredView" },
  );

  /** The tree the rows are shown in: the filtered rows, reshaped by the grouping hook (identity without it). */
  const groupedView = useMemo((): View<TData> => hooks.group(filteredView()), {
    lazy: true,
    name: "table.grouped",
  });

  // ---------------------------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------------------------
  const comparatorOf = (
    entries: readonly SortingEntry[],
  ): ((a: Row<TData>, b: Row<TData>) => number) | undefined => {
    const parts = entries.flatMap((entry) => {
      const column = columnOf(entry.id);
      if (column === undefined || column.columnDef.enableSorting === false) return [];
      const custom = column.columnDef.sortingFn;
      const compare: (a: Row<TData>, b: Row<TData>) => number =
        typeof custom === "function"
          ? (a, b) => (custom as SortingFn<TData>)(a, b, column.id)
          : (a, b) => {
              const va = a.getValue(column.id);
              const vb = b.getValue(column.id);
              if (isMissing(va) || isMissing(vb)) return 0;
              return compareValues(va, vb, hooks.collate(custom === "basic"));
            };
      return [
        { compare, missingAware: typeof custom !== "function", desc: entry.desc, id: column.id },
      ];
    });
    if (parts.length === 0) return undefined;
    return (a, b) => {
      for (const part of parts) {
        const va = a.getValue(part.id);
        const vb = b.getValue(part.id);
        if (part.missingAware && (isMissing(va) || isMissing(vb))) {
          // Missing values go last whatever the direction.
          if (isMissing(va) && isMissing(vb)) continue;
          return isMissing(va) ? 1 : -1;
        }
        const result = part.compare(a, b);
        if (result !== 0) return part.desc ? -result : result;
      }
      return 0;
    };
  };

  /**
   * The grouped tree sorted at every depth: the roots, and the children of each row, in order. The
   * sort is stable, so rows that compare equal keep their order.
   */
  const sortedView = useMemo(
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
    { lazy: true, name: "table.sorted" },
  );

  // ---------------------------------------------------------------------------------------------
  // Expansion and pagination
  // ---------------------------------------------------------------------------------------------
  function isSelected(id: string): boolean {
    if (selectionSlice.controlled) return selectionSlice.current()[id] === true;
    return selectionFlags.get(id);
  }

  /** The visible rows: sorted roots, and the children of each row the expanding hook shows, in order. */
  const expandedRows = useMemo(
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
    { lazy: true, name: "table.expanded" },
  );

  const pageCountOf = (): number => {
    if (options.manualPagination === true) return options.pageCount ?? -1;
    const size = Math.max(1, paginationSlice.current().pageSize);
    return Math.ceil(expandedRows().length / size);
  };

  /** The rows of the current page. */
  const pageRows = useMemo(
    (): readonly Row<TData>[] => {
      const rows = expandedRows();
      if (options.manualPagination === true) return rows;
      const { pageIndex, pageSize } = paginationSlice.current();
      const size = Math.max(1, pageSize);
      return rows.slice(pageIndex * size, pageIndex * size + size);
    },
    { lazy: true, name: "table.page" },
  );

  // ---------------------------------------------------------------------------------------------
  // Row models
  // ---------------------------------------------------------------------------------------------
  /** A model that is a list of rows: its flat rows are its rows. */
  const listModel = (rows: readonly Row<TData>[]): RowModel<TData> => {
    const rowsById = new Map<string, Row<TData>>();
    for (const row of rows) rowsById.set(row.id, row);
    return { rows, flatRows: rows, rowsById };
  };

  const model = (build: () => RowModel<TData>, name: string): (() => RowModel<TData>) =>
    useMemo(build, { lazy: true, name: `table.model.${name}` });
  const coreModel = model(
    () => treeModel({ roots: coreTree().roots, childrenOf: subRowsOf }),
    "core",
  );
  const filteredModel = model(() => treeModel(filteredView()), "filtered");
  const sortedModel = model(() => treeModel(sortedView()), "sorted");
  const expandedModel = model(() => listModel(expandedRows()), "expanded");
  const pageModel = model(() => listModel(pageRows()), "page");
  const selectedModel = model(() => {
    const selection = selectionSlice.current();
    const selected: Row<TData>[] = [];
    walk(coreTree().roots, subRowsOf, (row) => {
      if (selection[row.id] === true) selected.push(row);
    });
    return listModel(selected);
  }, "selected");

  // ---------------------------------------------------------------------------------------------
  // The table
  // ---------------------------------------------------------------------------------------------
  const table: Omit<Table<TData>, OwnedTableName> = {
    getState(): TableState {
      return {
        sorting: read("sorting"),
        columnFilters: read("columnFilters"),
        globalFilter: read("globalFilter"),
        pagination: read("pagination"),
        rowSelection: read("rowSelection"),
        expanded: read("expanded"),
        columnVisibility: read("columnVisibility"),
        columnOrder: read("columnOrder"),
        columnPinning: read("columnPinning"),
        columnSizing: read("columnSizing"),
        grouping: read("grouping"),
      };
    },
    sorting: sortingSlice.current,
    columnFilters: filtersSlice.current,
    globalFilter: globalSlice.current,
    pagination: paginationSlice.current,
    rowSelection: selectionSlice.current,

    setSorting: (value) => sortingSlice.set(value),
    setColumnFilters: (value) => filtersSlice.set(value),
    setGlobalFilter: (value) => globalSlice.set(value),
    setPagination: (value) => paginationSlice.set(value),
    setRowSelection: (value) => selectionSlice.set(value),
    resetSorting: () => sortingSlice.set(initial.sorting ?? []),
    resetColumnFilters: () => filtersSlice.set(initial.columnFilters ?? []),
    resetGlobalFilter: () => globalSlice.set(initial.globalFilter ?? ""),
    resetRowSelection: () => table.setRowSelection(initial.rowSelection ?? {}),

    getAllColumns: () => allColumns,
    getAllLeafColumns: () => leafColumns,
    getVisibleLeafColumns: () => visibleLeaves(),
    getColumn: (id) => columnOf(id),

    getCoreRowModel: () => coreModel(),
    getFilteredRowModel: () => filteredModel(),
    getSortedRowModel: () => sortedModel(),
    getExpandedRowModel: () => expandedModel(),
    getPrePaginationRowModel: () => expandedModel(),
    getRowModel: () => pageModel(),
    getSelectedRowModel: () => selectedModel(),
    getRow: (id) => coreTree().rowsById.get(id),
    getRowCount: () => filteredKept().size,

    getPageCount: () => pageCountOf(),
    getCanPreviousPage: () => paginationSlice.current().pageIndex > 0,
    getCanNextPage: () => {
      const count = pageCountOf();
      return count < 0 || paginationSlice.current().pageIndex < count - 1;
    },
    setPageIndex(index) {
      const count = pageCountOf();
      const upper = count < 0 ? Number.MAX_SAFE_INTEGER : Math.max(0, count - 1);
      const clamped = Math.min(Math.max(0, Math.floor(index)), upper);
      paginationSlice.set({ ...paginationSlice.current(), pageIndex: clamped });
    },
    setPageSize(size) {
      const next = Math.max(1, Math.floor(size));
      const current = paginationSlice.current();
      const firstRow = current.pageIndex * current.pageSize;
      paginationSlice.set({ pageIndex: Math.floor(firstRow / next), pageSize: next });
    },
    previousPage: () => table.setPageIndex(paginationSlice.current().pageIndex - 1),
    nextPage: () => table.setPageIndex(paginationSlice.current().pageIndex + 1),
    firstPage: () => table.setPageIndex(0),
    lastPage: () => table.setPageIndex(Math.max(0, pageCountOf() - 1)),

    getIsAllRowsSelected(): boolean {
      const roots = coreTree().roots;
      if (roots.length === 0) return false;
      return roots.every((row) => isSelected(row.id));
    },
    getIsSomeRowsSelected(): boolean {
      const roots = coreTree().roots;
      return roots.some((row) => isSelected(row.id)) && !table.getIsAllRowsSelected();
    },
    toggleAllRowsSelected(value) {
      const next = value ?? !table.getIsAllRowsSelected();
      const map: Record<string, boolean> = {};
      if (next) {
        walk(coreTree().roots, subRowsOf, (row) => {
          map[row.id] = true;
        });
      }
      table.setRowSelection(map);
    },
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
        return entry === undefined ? false : entry.desc ? "desc" : "asc";
      },
      getFirstSortDir: (): "asc" | "desc" =>
        column.columnDef.sortDescFirst === true ? "desc" : "asc",
      toggleSorting: (desc?: boolean, multi?: boolean): void => {
        const current = sortingSlice.current();
        const existing = current.find((item) => item.id === column.id);
        const first = column.columnDef.sortDescFirst === true;
        let nextEntry: SortingEntry | undefined;
        if (desc !== undefined) nextEntry = { id: column.id, desc };
        else if (existing === undefined) nextEntry = { id: column.id, desc: first };
        else if (existing.desc === first) nextEntry = { id: column.id, desc: !first };
        else nextEntry = undefined;
        const others = current.filter((item) => item.id !== column.id);
        const keep = multi === true && column.columnDef.enableMultiSort !== false;
        const base: SortingEntry[] = keep ? [...others] : [];
        if (nextEntry !== undefined) {
          if (keep && existing !== undefined) {
            sortingSlice.set(
              current.map((item) => (item.id === column.id && nextEntry ? nextEntry : item)),
            );
            return;
          }
          base.push(nextEntry);
        }
        sortingSlice.set(base);
      },
      getCanFilter: (): boolean =>
        column.columnDef.enableColumnFilter !== false && column.columns.length === 0,
      getFilterValue: (): unknown =>
        filtersSlice.current().find((item) => item.id === column.id)?.value,
      setFilterValue: (value: unknown): void => {
        const others = filtersSlice.current().filter((item) => item.id !== column.id);
        filtersSlice.set(isFilterActive(value) ? [...others, { id: column.id, value }] : others);
      },
      getCanGlobalFilter: (): boolean =>
        column.columnDef.enableGlobalFilter !== false && column.columns.length === 0,
    });
  }

  // Every member a feature owns exists from the start and throws until its feature is installed. The
  // literal above lists the core members only, so the cast adds the rest (they are all in place now).
  const columnStubs = absentMembers(OWNED_COLUMN, "column");
  const complete = Object.assign(
    table,
    absentMembers(OWNED_TABLE, "table"),
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
    core: () => coreTree(),
    makeRow,
    filtered: () => filteredView(),
    grouped: () => groupedView(),
    keepFor,
    model,
  };

  // Features: one object per name (the same object twice counts once), each installed once.
  const chosen = new Map<TableFeatureName, TableFeature>();
  for (const feature of options.features ?? []) {
    const known = chosen.get(feature.name);
    if (known === feature) continue;
    if (known !== undefined) {
      throw new TypeError(`[shadow-table] two different "${feature.name}" features were passed.`);
    }
    chosen.set(feature.name, feature);
  }
  for (const [key, feature] of STATE_OWNER) {
    if (chosen.has(feature)) continue;
    if (initial[key] !== undefined || options.state?.[key] !== undefined) {
      throw featureMissing(feature, `initialState.${key}`);
    }
  }
  if (options.locale !== undefined && !chosen.has("locale"))
    throw featureMissing("locale", "locale");
  for (const feature of chosen.values()) feature.install(host);
  return complete;
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
