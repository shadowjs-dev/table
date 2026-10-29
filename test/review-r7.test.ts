/**
 * Review round 7: aggregations over very large groups, the page index when controlled filters change,
 * mutators called inside an effect, tree selection, per-row expansion readers, `inNumberRange` with NaN
 * and memoized facets.
 */
import { createRoot, flushSync, useEffect, useSignal } from "@shadow-js/core";
import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";
import { aggregate, inNumberRange } from "../src/internal/functions";
import type { ColumnFiltersState, FilterFn, GroupingState } from "../src/types";

interface Item {
  id: string;
  name: string;
  team: string;
  amount: number;
  children?: Item[];
}

const helper = createColumnHelper<Item>();
const columns = [
  helper.accessor("name", { header: "Name", enableGrouping: true }),
  helper.accessor("team", { header: "Team", enableGrouping: true }),
  helper.accessor("amount", { header: "Amount", filterFn: "inNumberRange" }),
];

function items(count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: `n${index}`,
    team: index % 2 === 0 ? "a" : "b",
    amount: index,
  }));
}

describe("aggregations over a very large group", () => {
  it("[TBL-R7-1] min, max and extent do not throw for 200000 values", () => {
    const values = Array.from({ length: 200_000 }, (_, index) => index - 100_000);
    expect(aggregate(values, "min")).toBe(-100_000);
    expect(aggregate(values, "max")).toBe(99_999);
    expect(aggregate(values, "extent")).toEqual([-100_000, 99_999]);
    expect(aggregate([], "extent")).toBeUndefined();
    expect(aggregate([Number.NaN, 1], "min")).toBeNaN();
  });
});

describe("the page index follows controlled filters", () => {
  it("[TBL-R7-2] a controlled column filter change returns an uncontrolled pager to the first page", () => {
    const [filters, setFilters] = useSignal<ColumnFiltersState>([]);
    const table = createTable({
      features: full,
      data: items(30),
      columns,
      getRowId: (row) => row.id,
      state: { columnFilters: filters },
      initialState: { pagination: { pageIndex: 2, pageSize: 10 } },
    });
    expect(table.getRowModel().rows.length).toBe(10);
    setFilters([{ id: "team", value: "a" }]);
    expect(table.getState().pagination.pageIndex).toBe(0);
    expect(table.getRowModel().rows.length).toBe(10);
    table.setPageIndex(1);
    expect(table.getState().pagination.pageIndex).toBe(1);
    expect(table.getRowModel().rows.length).toBe(5);
    table.setPageSize(5);
    expect(table.getState().pagination).toEqual({ pageIndex: 2, pageSize: 5 });
    expect(table.getRowModel().rows.length).toBe(5);
  });

  it("[TBL-R7-2] a controlled global filter and a controlled grouping do the same", () => {
    const [global, setGlobal] = useSignal("");
    const [grouping, setGrouping] = useSignal<GroupingState>([]);
    const table = createTable({
      features: full,
      data: items(30),
      columns,
      getRowId: (row) => row.id,
      state: { globalFilter: global, grouping },
      initialState: { pagination: { pageIndex: 2, pageSize: 10 } },
    });
    expect(table.getRowModel().rows.length).toBe(10);
    setGlobal("n1");
    expect(table.getState().pagination.pageIndex).toBe(0);
    expect(table.getRowModel().rows.length).toBe(10);
    table.setPageIndex(1);
    expect(table.getRowModel().rows.length).toBe(1);
    setGlobal("");
    table.setPageIndex(2);
    expect(table.getRowModel().rows.length).toBe(10);
    setGrouping(["team"]);
    expect(table.getState().pagination.pageIndex).toBe(0);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["team:a", "team:b"]);
  });

  it("[TBL-R7-2] a controlled pager and a manual pager are left to the caller", () => {
    const [filters, setFilters] = useSignal<ColumnFiltersState>([]);
    const [page] = useSignal({ pageIndex: 2, pageSize: 10 });
    const controlled = createTable({
      features: full,
      data: items(30),
      columns,
      getRowId: (row) => row.id,
      state: { columnFilters: filters, pagination: page },
    });
    setFilters([{ id: "team", value: "a" }]);
    expect(controlled.getState().pagination.pageIndex).toBe(2);
    const manual = createTable({
      features: full,
      data: items(30),
      columns,
      getRowId: (row) => row.id,
      manualPagination: true,
      state: { columnFilters: filters },
      initialState: { pagination: { pageIndex: 2, pageSize: 10 } },
    });
    setFilters([{ id: "team", value: "b" }]);
    expect(manual.getState().pagination.pageIndex).toBe(2);
  });
});

describe("mutators called inside an effect", () => {
  const tree: Item[] = [
    {
      id: "a",
      name: "A",
      team: "x",
      amount: 1,
      children: [{ id: "a1", name: "A1", team: "x", amount: 2 }],
    },
    { id: "b", name: "B", team: "y", amount: 3 },
    { id: "c", name: "C", team: "y", amount: 4 },
  ];
  const make = () =>
    createTable({
      features: full,
      data: tree,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
  type Table = ReturnType<typeof make>;
  const mutators: Record<string, (table: Table) => void> = {
    setPageIndex: (table) => table.setPageIndex(1),
    nextPage: (table) => table.nextPage(),
    previousPage: (table) => table.previousPage(),
    firstPage: (table) => table.firstPage(),
    lastPage: (table) => table.lastPage(),
    setPageSize: (table) => table.setPageSize(2),
    toggleSelected: (table) => table.getRow("a")?.toggleSelected(),
    toggleAllRowsSelected: (table) => table.toggleAllRowsSelected(),
    toggleExpanded: (table) => table.getRow("a")?.toggleExpanded(),
    toggleAllRowsExpanded: (table) => table.toggleAllRowsExpanded(),
    toggleSorting: (table) => table.getColumn("name")?.toggleSorting(),
    setFilterValue: (table) => table.getColumn("team")?.setFilterValue("x"),
    pin: (table) => table.getColumn("name")?.pin("left"),
    toggleVisibility: (table) => table.getColumn("team")?.toggleVisibility(),
    toggleGrouping: (table) => table.getColumn("team")?.toggleGrouping(),
  };

  for (const [name, mutate] of Object.entries(mutators)) {
    it(`[TBL-R7-3] ${name} does not make the calling effect depend on the table state`, () => {
      const table = make();
      let runs = 0;
      createRoot(() => {
        useEffect(() => {
          runs += 1;
          mutate(table);
        });
      });
      flushSync();
      expect(runs).toBe(1);
      // State the mutator read changes elsewhere: the effect must not hear of it.
      table.setSorting([{ id: "amount", desc: true }]);
      table.setGlobalFilter("zzz");
      table.setPagination({ pageIndex: 0, pageSize: 3 });
      table.setRowSelection({ c: true });
      table.setExpanded({ a: true });
      flushSync();
      expect(runs).toBe(1);
    });
  }
});

describe("state updaters", () => {
  it("[TBL-R7-3] an updater function runs untracked", () => {
    const [probe, setProbe] = useSignal(0);
    const table = createTable({ data: items(3), columns, getRowId: (row) => row.id });
    let runs = 0;
    createRoot(() => {
      useEffect(() => {
        runs += 1;
        table.setSorting((previous) => (probe() >= 0 ? previous : []));
      });
    });
    flushSync();
    setProbe(1);
    flushSync();
    expect(runs).toBe(1);
  });
});

describe("tree selection", () => {
  const tree: Item[] = [
    {
      id: "a",
      name: "A",
      team: "x",
      amount: 1,
      children: [
        { id: "a1", name: "A1", team: "x", amount: 2 },
        { id: "a2", name: "A2", team: "x", amount: 3 },
      ],
    },
    { id: "b", name: "B", team: "y", amount: 4 },
  ];
  const make = (enableSubRowSelection?: boolean) =>
    createTable({
      features: full,
      data: tree,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
      ...(enableSubRowSelection === undefined ? {} : { enableSubRowSelection }),
    });

  it("[TBL-R7-4] deselecting every child deselects the parent, and the aggregates follow", () => {
    const table = make();
    table.toggleAllRowsSelected(true);
    expect(table.getIsAllRowsSelected()).toBe(true);
    table.getRow("a1")?.toggleSelected(false);
    expect(table.getRow("a")?.getIsSelected()).toBe(false);
    expect(table.getIsAllRowsSelected()).toBe(false);
    expect(table.getIsSomeRowsSelected()).toBe(true);
    table.getRow("a2")?.toggleSelected(false);
    table.getRow("b")?.toggleSelected(false);
    expect(table.getState().rowSelection).toEqual({});
    expect(table.getIsSomeRowsSelected()).toBe(false);
    expect(table.getIsAllRowsSelected()).toBe(false);
  });

  it("[TBL-R7-4] selecting only a child is some selected; selecting every child selects the parent", () => {
    const table = make();
    table.getRow("a1")?.toggleSelected(true);
    expect(table.getIsSomeRowsSelected()).toBe(true);
    expect(table.getIsAllRowsSelected()).toBe(false);
    expect(table.getRow("a")?.getIsSelected()).toBe(false);
    expect(table.getRow("a")?.getIsSomeSelected()).toBe(true);
    table.getRow("a2")?.toggleSelected(true);
    expect(table.getRow("a")?.getIsSelected()).toBe(true);
    table.getRow("b")?.toggleSelected(true);
    expect(table.getIsAllRowsSelected()).toBe(true);
    expect(table.getIsSomeRowsSelected()).toBe(false);
  });

  it("[TBL-R7-4] with enableSubRowSelection false a row is selected alone, parents untouched", () => {
    const table = make(false);
    table.getRow("a1")?.toggleSelected(true);
    table.getRow("a2")?.toggleSelected(true);
    expect(table.getState().rowSelection).toEqual({ a1: true, a2: true });
    table.getRow("a")?.toggleSelected(true);
    table.getRow("a1")?.toggleSelected(false);
    expect(table.getState().rowSelection).toEqual({ a: true, a2: true });
  });

  it("[TBL-R7-4] a deep descendant makes every ancestor some selected", () => {
    const deep: Item[] = [
      {
        id: "r",
        name: "R",
        team: "x",
        amount: 1,
        children: [
          {
            id: "m",
            name: "M",
            team: "x",
            amount: 2,
            children: [
              { id: "l1", name: "L1", team: "x", amount: 3 },
              { id: "l2", name: "L2", team: "x", amount: 4 },
            ],
          },
        ],
      },
    ];
    const table = createTable({
      features: full,
      data: deep,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
    });
    table.getRow("l1")?.toggleSelected(true);
    expect(table.getRow("r")?.getIsSomeSelected()).toBe(true);
    expect(table.getRow("m")?.getIsSomeSelected()).toBe(true);
    expect(table.getIsSomeRowsSelected()).toBe(true);
  });
});

describe("per-row expansion readers", () => {
  it("[TBL-R7-5] a reader of one row does not rerun when another row toggles", () => {
    const tree: Item[] = [
      {
        id: "a",
        name: "A",
        team: "x",
        amount: 1,
        children: [{ id: "a1", name: "A1", team: "x", amount: 2 }],
      },
      {
        id: "b",
        name: "B",
        team: "x",
        amount: 3,
        children: [{ id: "b1", name: "B1", team: "x", amount: 4 }],
      },
    ];
    const table = createTable({
      features: full,
      data: tree,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
    });
    const seen: boolean[] = [];
    createRoot(() => {
      useEffect(() => {
        seen.push(table.getRow("a")?.getIsExpanded() === true);
      });
    });
    flushSync();
    table.getRow("b")?.toggleExpanded(true);
    flushSync();
    expect(seen).toEqual([false]);
    table.getRow("a")?.toggleExpanded(true);
    flushSync();
    expect(seen).toEqual([false, true]);
    // Expanding every row is a change every reader hears of.
    table.toggleAllRowsExpanded(true);
    flushSync();
    expect(seen).toEqual([false, true, true]);
    table.getRow("a")?.toggleExpanded(false);
    flushSync();
    expect(seen).toEqual([false, true, true, false]);
  });
});

describe("inNumberRange", () => {
  it("[TBL-R7-6] NaN is outside every range, even an open one", () => {
    expect(inNumberRange(Number.NaN, [1, 5])).toBe(false);
    expect(inNumberRange(Number.NaN, [undefined, undefined])).toBe(false);
    expect(inNumberRange(Number.NaN, [undefined, 5])).toBe(false);
    expect(inNumberRange(3, [undefined, undefined])).toBe(true);
    expect(inNumberRange(5, [5, 5])).toBe(true);
  });
});

describe("faceting memo", () => {
  it("[TBL-R7-7] reading the facets again does not run the filters again", () => {
    let calls = 0;
    const counting: FilterFn<Item> = (row, columnId, value) => {
      calls += 1;
      return row.getValue(columnId) === value;
    };
    const cols = [
      helper.accessor("name", { header: "Name" }),
      helper.accessor("team", { header: "Team", filterFn: counting }),
    ];
    const [filters, setFilters] = useSignal<ColumnFiltersState>([{ id: "team", value: "a" }]);
    const table = createTable({
      features: full,
      data: items(100),
      columns: cols,
      getRowId: (row) => row.id,
      state: { columnFilters: filters },
    });
    const name = table.getColumn("name");
    expect(name?.getFacetedRowModel().length).toBe(50);
    const afterFirst = calls;
    expect(afterFirst).toBe(100);
    const unique = name?.getFacetedUniqueValues();
    name?.getFacetedMinMaxValues();
    name?.getFacetedRowModel();
    expect(name?.getFacetedUniqueValues()).toBe(unique);
    expect(calls).toBe(afterFirst);
    setFilters([{ id: "team", value: "b" }]);
    expect(name?.getFacetedRowModel().length).toBe(50);
    expect(calls).toBe(afterFirst + 100);
    // The column's own filter is left out of its facets, so the other column sees both teams.
    expect(table.getColumn("team")?.getFacetedRowModel().length).toBe(100);
  });
});
