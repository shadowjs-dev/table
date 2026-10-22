/**
 * `@shadow-js/table`: the feature set, one behavior per test. Sorting edge cases, filter functions,
 * grouping and every built-in aggregation, pagination, selection, expansion, sizing and resets.
 */

import { useSignal } from "@shadow-js/core";
import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Person {
  id: string;
  name: string;
  age: number;
  team: string;
  tags: string[];
  when?: Date;
  note?: string | null | undefined;
  children?: Person[];
}

const people: Person[] = [
  { id: "1", name: "Ada", age: 36, team: "core", tags: ["math"] },
  { id: "2", name: "grace", age: 85, team: "navy", tags: ["cobol", "navy"] },
  { id: "3", name: "Linus", age: 54, team: "core", tags: ["kernel"] },
  { id: "4", name: "Margaret", age: 40, team: "apollo", tags: ["apollo"] },
  { id: "5", name: "alan", age: 41, team: "core", tags: [] },
];

/** The fixture person at an index (the fixture is known to be long enough). */
function pick(index: number): Person {
  const person = people[index];
  if (person === undefined) throw new Error(`no fixture person at ${index}`);
  return person;
}

const helper = createColumnHelper<Person>();

function ids(rows: readonly { id: string }[]): string[] {
  return rows.map((row) => row.id);
}

describe("sorting", () => {
  it("[TBL-140] a column with enableSorting false is not sorted by its sorting state", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name", { enableSorting: false })],
      getRowId: (row) => row.id,
      initialState: { sorting: [{ id: "name", desc: false }] },
    });
    expect(table.getColumn("name")?.getCanSort()).toBe(false);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("[TBL-141] with enableMultiSort false, a multi-column toggle replaces the other sorts", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name"), helper.accessor("team", { enableMultiSort: false })],
      getRowId: (row) => row.id,
    });
    table.getColumn("name")?.toggleSorting(false, true);
    table.getColumn("team")?.toggleSorting(false, true);
    expect(table.getState().sorting.map((entry) => entry.id)).toEqual(["team"]);
  });

  it("[TBL-142] missing values sort last in both directions", () => {
    const first = pick(0);
    const data: Person[] = [
      { ...first, id: "a", note: "b" },
      { ...first, id: "m1", note: undefined },
      { ...first, id: "c", note: "a" },
      { ...first, id: "m2", note: null },
    ];
    const table = createTable({
      features: full,
      data,
      columns: [helper.accessor("note")],
      getRowId: (row) => row.id,
    });
    table.getColumn("note")?.toggleSorting(false);
    expect(ids(table.getRowModel().rows)).toEqual(["c", "a", "m1", "m2"]);
    table.getColumn("note")?.toggleSorting(true);
    expect(ids(table.getRowModel().rows)).toEqual(["a", "c", "m1", "m2"]);
  });

  it("[TBL-143] the basic sorting function compares text by character code, the default ignores case", () => {
    const first = pick(0);
    const data: Person[] = ["b", "B", "a"].map((name, index) => ({
      ...first,
      id: String(index),
      name,
    }));
    const basic = createTable({
      features: full,
      data,
      columns: [helper.accessor("name", { sortingFn: "basic" })],
      getRowId: (row) => row.id,
      initialState: { sorting: [{ id: "name", desc: false }] },
    });
    expect(basic.getRowModel().rows.map((row) => row.original.name)).toEqual(["B", "a", "b"]);
    const defaults = createTable({
      features: full,
      data,
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
      initialState: { sorting: [{ id: "name", desc: false }] },
    });
    // Ignoring case, "b" and "B" are equal, so they keep their data order.
    expect(defaults.getRowModel().rows.map((row) => row.original.name)).toEqual(["a", "b", "B"]);
  });

  it("[TBL-144] the datetime sorting function orders dates by their time", () => {
    const first = pick(0);
    const data: Person[] = [
      { ...first, id: "late", when: new Date("2026-03-05T00:00:00Z") },
      { ...first, id: "early", when: new Date("2025-12-01T00:00:00Z") },
    ];
    const table = createTable({
      features: full,
      data,
      columns: [helper.accessor("when", { sortingFn: "datetime" })],
      getRowId: (row) => row.id,
      initialState: { sorting: [{ id: "when", desc: false }] },
    });
    expect(ids(table.getRowModel().rows)).toEqual(["early", "late"]);
  });

  it("[TBL-145] sorting by a group's aggregated value orders the groups by that value", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("team", { enableGrouping: true }),
        helper.accessor("age", { aggregationFn: "sum" }),
      ],
      getRowId: (row) => row.id,
      initialState: { grouping: ["team"], sorting: [{ id: "age", desc: false }] },
    });
    expect(table.getSortedRowModel().rows.map((row) => row.getGroupingValue("team"))).toEqual([
      "apollo",
      "navy",
      "core",
    ]);
  });
});

describe("filtering", () => {
  it("[TBL-146] a column with enableGlobalFilter false is left out of the global filter", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name"), helper.accessor("team", { enableGlobalFilter: false })],
      getRowId: (row) => row.id,
    });
    table.setGlobalFilter("apollo");
    expect(table.getRowModel().rows).toEqual([]);
    table.setGlobalFilter("ada");
    expect(ids(table.getRowModel().rows)).toEqual(["1"]);
  });

  it("[TBL-147] the built-in filter functions equals, arrIncludes and inNumberRange", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("team", { filterFn: "equals" }),
        helper.accessor("tags", { filterFn: "arrIncludes" }),
        helper.accessor("age", { filterFn: "inNumberRange" }),
      ],
      getRowId: (row) => row.id,
    });
    const team = table.getColumn("team");
    team?.setFilterValue("cor");
    expect(ids(table.getRowModel().rows)).toEqual([]);
    team?.setFilterValue("core");
    expect(ids(table.getRowModel().rows)).toEqual(["1", "3", "5"]);
    team?.setFilterValue(undefined);
    table.getColumn("tags")?.setFilterValue("navy");
    expect(ids(table.getRowModel().rows)).toEqual(["2"]);
    table.getColumn("tags")?.setFilterValue(undefined);
    table.getColumn("age")?.setFilterValue([40, 54]);
    expect(ids(table.getRowModel().rows)).toEqual(["3", "4", "5"]);
  });

  it("[TBL-148] a custom filter function receives the row, the column id and the filter value", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("age", {
          filterFn: (row, columnId, value) => row.getValue<number>(columnId) > Number(value),
        }),
      ],
      getRowId: (row) => row.id,
    });
    table.getColumn("age")?.setFilterValue(40);
    expect(ids(table.getRowModel().rows)).toEqual(["2", "3", "5"]);
  });

  it("[TBL-149] clearing a filter (undefined, empty text or an empty list) removes it from the state", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
    });
    table.getColumn("name")?.setFilterValue("a");
    expect(table.getState().columnFilters).toHaveLength(1);
    table.getColumn("name")?.setFilterValue("");
    expect(table.getState().columnFilters).toEqual([]);
    table.getColumn("name")?.setFilterValue([]);
    expect(table.getState().columnFilters).toEqual([]);
    expect(table.getColumn("name")?.getFilterValue()).toBeUndefined();
  });
});

describe("grouping and aggregation", () => {
  /** Each built-in aggregation of the core group's ages (36, 54, 41), with its expected value. */
  const aggregations = [
    ["sum", 131],
    ["count", 3],
    ["min", 36],
    ["max", 54],
    ["mean", 131 / 3],
    ["median", 41],
    ["unique", [36, 54, 41]],
    ["uniqueCount", 3],
    ["extent", [36, 54]],
  ] as const;

  it("[TBL-150] each built-in aggregation of a group's values matches its definition", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("team", { enableGrouping: true }),
        ...aggregations.map(([name]) =>
          helper.accessor((row) => row.age, { id: `age-${name}`, aggregationFn: name }),
        ),
      ],
      getRowId: (row) => row.id,
      initialState: { grouping: ["team"] },
    });
    const core = table.getGroupedRowModel().rows[0];
    for (const [name, expected] of aggregations) {
      const actual = core?.getValue(`age-${name}`);
      if (typeof expected === "number" && typeof actual === "number") {
        expect(actual, name).toBeCloseTo(expected, 10);
      } else {
        expect(actual, name).toEqual(expected);
      }
    }
  });

  it("[TBL-151] a custom aggregation function receives the group's values", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("team", { enableGrouping: true }),
        helper.accessor("age", { aggregationFn: (values) => values.length * 10 }),
      ],
      getRowId: (row) => row.id,
      initialState: { grouping: ["team"] },
    });
    expect(table.getGroupedRowModel().rows[0]?.getValue("age")).toBe(30);
  });

  it("[TBL-152] a column with no aggregation shows the value of the group's first row", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("team", { enableGrouping: true }), helper.accessor("name")],
      getRowId: (row) => row.id,
      initialState: { grouping: ["team"] },
    });
    expect(table.getGroupedRowModel().rows[0]?.getValue("name")).toBe("Ada");
  });

  it("[TBL-153] nested grouping makes groups within groups, in the order values first appear", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("team", { enableGrouping: true }),
        helper.accessor((row) => row.age > 40, { id: "older", enableGrouping: true }),
      ],
      getRowId: (row) => row.id,
      initialState: { grouping: ["team", "older"] },
    });
    const core = table.getGroupedRowModel().rows[0];
    expect(core?.getGroupingValue("team")).toBe("core");
    expect(core?.subRows.map((row) => row.getGroupingValue("older"))).toEqual([false, true]);
    expect(core?.subRows[1]?.subRows.map((row) => row.id)).toEqual(["3", "5"]);
  });

  it("[TBL-154] grouping works on the filtered rows only", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("team", { enableGrouping: true }),
        helper.accessor("age", { aggregationFn: "sum" }),
      ],
      getRowId: (row) => row.id,
      initialState: { grouping: ["team"] },
    });
    table.setGlobalFilter("core");
    const groups = table.getGroupedRowModel().rows;
    expect(groups.map((row) => row.getGroupingValue("team"))).toEqual(["core"]);
    expect(groups[0]?.getValue("age")).toBe(131);
  });

  it("[TBL-155] a group row is expanded to show the rows it holds", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("team", { enableGrouping: true }), helper.accessor("name")],
      getRowId: (row) => row.id,
      initialState: { grouping: ["team"] },
    });
    expect(table.getRowModel().rows.map((row) => row.getGroupingValue("team"))).toEqual([
      "core",
      "navy",
      "apollo",
    ]);
    table.getGroupedRowModel().rows[0]?.toggleExpanded(true);
    const rows = table.getRowModel().rows;
    expect(rows.map((row) => row.isGrouped)).toEqual([true, false, false, false, true, true]);
    expect(ids(rows.slice(1, 4))).toEqual(["1", "3", "5"]);
  });
});

describe("pagination", () => {
  const base = {
    data: people,
    columns: [helper.accessor("name")],
    getRowId: (row: Person) => row.id,
  };

  it("[TBL-156] changing the page size keeps the first row of the current page on screen", () => {
    const table = createTable({
      features: full,
      ...base,
      initialState: { pagination: { pageIndex: 1, pageSize: 2 } },
    });
    expect(ids(table.getRowModel().rows)).toEqual(["3", "4"]);
    table.setPageSize(4);
    expect(table.getState().pagination).toEqual({ pageIndex: 0, pageSize: 4 });
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2", "3", "4"]);
    table.setPageSize(0);
    expect(table.getState().pagination.pageSize).toBe(1);
  });

  it("[TBL-157] the first and last pages, and the edges of previous and next", () => {
    const table = createTable({
      features: full,
      ...base,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
    expect(table.getCanPreviousPage()).toBe(false);
    table.lastPage();
    expect(ids(table.getRowModel().rows)).toEqual(["5"]);
    expect(table.getCanNextPage()).toBe(false);
    table.firstPage();
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2"]);
    table.previousPage();
    expect(table.getState().pagination.pageIndex).toBe(0);
  });

  it("[TBL-158] manual pagination with an unknown page count has no upper bound on the page", () => {
    const table = createTable({
      features: full,
      ...base,
      manualPagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
    expect(table.getPageCount()).toBe(-1);
    expect(table.getCanNextPage()).toBe(true);
    table.setPageIndex(5);
    expect(table.getState().pagination.pageIndex).toBe(5);
  });

  it("[TBL-159] automatic pagination returns to the first page when the filter or the grouping changes", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name"), helper.accessor("team", { enableGrouping: true })],
      getRowId: (row) => row.id,
      initialState: { pagination: { pageIndex: 2, pageSize: 2 } },
    });
    table.setGlobalFilter("core");
    expect(table.getState().pagination.pageIndex).toBe(0);
    table.setPageIndex(1);
    table.setGrouping(["team"]);
    expect(table.getState().pagination.pageIndex).toBe(0);
  });

  it("[TBL-160] sorting keeps the current page", () => {
    const table = createTable({
      features: full,
      ...base,
      initialState: { pagination: { pageIndex: 1, pageSize: 2 } },
    });
    table.getColumn("name")?.toggleSorting(true);
    expect(table.getState().pagination.pageIndex).toBe(1);
  });
});

describe("selection", () => {
  it("[TBL-161] some-selected is true for part of the rows, and all-selected for every one", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
    });
    expect(table.getIsSomeRowsSelected()).toBe(false);
    table.getRow("1")?.toggleSelected(true);
    expect(table.getIsSomeRowsSelected()).toBe(true);
    expect(table.getIsAllRowsSelected()).toBe(false);
    table.toggleAllRowsSelected();
    expect(table.getIsAllRowsSelected()).toBe(true);
    expect(table.getIsSomeRowsSelected()).toBe(false);
    table.toggleAllRowsSelected();
    expect(table.getState().rowSelection).toEqual({});
  });

  it("[TBL-162] select-all selects every row of the data, not only the rows the filter keeps", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
    });
    table.setGlobalFilter("core");
    table.toggleAllRowsSelected(true);
    expect(table.getSelectedRowModel().rows).toHaveLength(5);
  });

  it("[TBL-163] with enableSubRowSelection false, selecting a row leaves its sub rows alone", () => {
    const tree: Person[] = [{ ...pick(0), children: [{ ...pick(1), children: [] }] }];
    const table = createTable({
      features: full,
      data: tree,
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
      enableSubRowSelection: false,
    });
    table.getRow("1")?.toggleSelected(true);
    expect(table.getState().rowSelection).toEqual({ "1": true });
    expect(table.getRow("2")?.getIsSelected()).toBe(false);
  });
});

describe("expansion", () => {
  const tree: Person[] = [
    { ...pick(0), children: [{ ...pick(1), children: [] }] },
    { ...pick(2), children: [] },
  ];
  const base = {
    data: tree,
    columns: [helper.accessor("name")],
    getRowId: (row: Person) => row.id,
    getSubRows: (row: Person) => row.children,
  };

  it("[TBL-164] expanding every row, and collapsing them again", () => {
    const table = createTable({ features: full, ...base });
    table.toggleAllRowsExpanded(true);
    expect(table.getIsAllRowsExpanded()).toBe(true);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2", "3"]);
    table.toggleAllRowsExpanded(false);
    expect(table.getIsAllRowsExpanded()).toBe(false);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "3"]);
  });

  it("[TBL-165] with enableExpanding false no row reports that it can expand", () => {
    const table = createTable({ features: full, ...base, enableExpanding: false });
    expect(table.getRow("1")?.getCanExpand()).toBe(false);
    expect(table.getCanSomeRowsExpand()).toBe(true);
  });

  it("[TBL-166] the expanded state follows the row id through sorting", () => {
    const table = createTable({ features: full, ...base });
    table.getRow("1")?.toggleExpanded(true);
    table.getColumn("name")?.toggleSorting(true);
    expect(table.getRow("1")?.getIsExpanded()).toBe(true);
    // Descending by name: Linus (3) first, then Ada (1) with her sub row (2).
    expect(ids(table.getRowModel().rows)).toEqual(["3", "1", "2"]);
  });
});

describe("column sizing", () => {
  it("[TBL-167] the table's default size applies to a column with no size, and a column's size overrides it", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name"), helper.accessor("age", { size: 80 })],
      getRowId: (row) => row.id,
      defaultColumnSize: 200,
    });
    expect(table.getColumn("name")?.getSize()).toBe(200);
    expect(table.getColumn("age")?.getSize()).toBe(80);
    expect(table.getTotalSize()).toBe(280);
  });

  it("[TBL-168] a size below the minimum is raised to it, and the default minimum is 20", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [
        helper.accessor("name", { size: 5 }),
        helper.accessor("age", { minSize: 60, size: 10 }),
      ],
      getRowId: (row) => row.id,
    });
    expect(table.getColumn("name")?.getSize()).toBe(20);
    expect(table.getColumn("age")?.getSize()).toBe(60);
  });

  it("[TBL-169] a column that cannot resize reports it", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name", { enableResizing: false }), helper.accessor("age")],
      getRowId: (row) => row.id,
    });
    expect(table.getColumn("name")?.getCanResize()).toBe(false);
    expect(table.getColumn("age")?.getCanResize()).toBe(true);
  });
});

describe("column state", () => {
  it("[TBL-170] a column order lists the known columns first, and unlisted columns follow in definition order", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name"), helper.accessor("age"), helper.accessor("team")],
      getRowId: (row) => row.id,
    });
    table.setColumnOrder(["team", "unknown", "name"]);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      "team",
      "name",
      "age",
    ]);
  });

  it("[TBL-171] pinning a column twice keeps it once, at the end of its side's list", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name"), helper.accessor("age"), helper.accessor("team")],
      getRowId: (row) => row.id,
    });
    table.getColumn("name")?.pin("left");
    table.getColumn("age")?.pin("left");
    table.getColumn("name")?.pin("left");
    expect(table.getState().columnPinning.left).toEqual(["age", "name"]);
    table.getColumn("age")?.pin(false);
    expect(table.getLeftLeafColumns().map((column) => column.id)).toEqual(["name"]);
  });

  it("[TBL-172] a column that cannot be hidden reports it", () => {
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name", { enableHiding: false }), helper.accessor("age")],
      getRowId: (row) => row.id,
    });
    expect(table.getColumn("name")?.getCanHide()).toBe(false);
    expect(table.getColumn("age")?.getCanHide()).toBe(true);
  });

  it("[TBL-173] the reset methods return each slice to its starting state", () => {
    const initial = {
      sorting: [{ id: "name", desc: true }],
      columnFilters: [{ id: "age", value: 40 }],
      globalFilter: "a",
      rowSelection: { "1": true },
      expanded: { "1": true },
    };
    const table = createTable({
      features: full,
      data: people,
      columns: [helper.accessor("name"), helper.accessor("age")],
      getRowId: (row) => row.id,
      initialState: initial,
    });
    table.setSorting([]);
    table.setColumnFilters([]);
    table.setGlobalFilter("zzz");
    table.setRowSelection({});
    table.setExpanded({});
    table.resetSorting();
    table.resetColumnFilters();
    table.resetGlobalFilter();
    table.resetRowSelection();
    table.resetExpanded();
    expect(table.getState().sorting).toEqual(initial.sorting);
    expect(table.getState().columnFilters).toEqual(initial.columnFilters);
    expect(table.getState().globalFilter).toBe("a");
    expect(table.getState().rowSelection).toEqual(initial.rowSelection);
    expect(table.getState().expanded).toEqual(initial.expanded);
  });
});

describe("reactive data", () => {
  it("[TBL-174] the row models follow the data accessor they are given", () => {
    const [data, setData] = useSignal<Person[]>(people);
    const table = createTable({
      features: full,
      data,
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
    });
    expect(table.getRowCount()).toBe(5);
    expect(table.getRowModel().rows).toHaveLength(5);
    setData(people.slice(0, 2));
    expect(table.getRowCount()).toBe(2);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2"]);
  });
});
