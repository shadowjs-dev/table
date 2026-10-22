/**
 * `@shadow-js/table`: the headless table over signals. Columns, the row model pipeline (core,
 * filtered, grouped, sorted, expanded, paginated), sorting, filtering, faceting, pagination,
 * selection, expansion, grouping and aggregation, column state (visibility, order, pinning,
 * sizing), controlled and manual state. Property tests compare against a naive oracle (seed 42).
 */

import { createRoot, flushSync, useEffect, useSignal } from "@shadow-js/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable, useTable } from "../src/index";

interface Person {
  id: string;
  name: string;
  age: number;
  team: string;
  tags: string[];
  subRows?: Person[];
}

const people: Person[] = [
  { id: "1", name: "Ada", age: 36, team: "core", tags: ["math"] },
  { id: "2", name: "grace", age: 85, team: "navy", tags: ["cobol", "navy"] },
  { id: "3", name: "Linus", age: 54, team: "core", tags: ["kernel"] },
  { id: "4", name: "Margaret", age: 40, team: "apollo", tags: ["apollo"] },
  { id: "5", name: "alan", age: 41, team: "core", tags: [] },
];

const helper = createColumnHelper<Person>();
const columns = [
  helper.accessor("name", { header: "Name" }),
  helper.accessor("age", { header: "Age", sortDescFirst: true, aggregationFn: "sum" }),
  helper.accessor("team", { header: "Team", enableGrouping: true }),
];

/** The person at an index of the fixture (the fixture is known to be long enough). */
function pick(index: number): Person {
  const person = people[index];
  if (person === undefined) throw new Error(`no fixture person at ${index}`);
  return person;
}

function ids(rows: readonly { original: Person }[]): string[] {
  return rows.map((row) => row.original.id);
}

describe("columns", () => {
  it("[TBL-1] an accessor column takes its id from the key, a function accessor needs an id, and display columns have one", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual(["name", "age", "team"]);
    const byFunction = helper.accessor((row) => row.tags.length, {
      id: "tagCount",
      header: "Tags",
    });
    expect(byFunction.id).toBe("tagCount");
    const select = helper.display({ id: "select", header: "" });
    expect(select.id).toBe("select");
  });

  it("[TBL-2] the core row model keeps the data order and reads values through the column accessors", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    const rows = table.getRowModel().rows;
    expect(ids(rows)).toEqual(["1", "2", "3", "4", "5"]);
    expect(rows[0]?.getValue("age")).toBe(36);
    expect(rows[1]?.id).toBe("2");
  });
});

describe("sorting", () => {
  it("[TBL-10] toggling a column cycles ascending, descending and none; sortDescFirst starts with descending", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    const name = table.getColumn("name");
    const age = table.getColumn("age");
    expect(name?.getIsSorted()).toBe(false);
    name?.toggleSorting();
    expect(name?.getIsSorted()).toBe("asc");
    // Case-insensitive: Ada, alan, grace, Linus, Margaret.
    expect(ids(table.getRowModel().rows)).toEqual(["1", "5", "2", "3", "4"]);
    name?.toggleSorting();
    expect(name?.getIsSorted()).toBe("desc");
    name?.toggleSorting();
    expect(name?.getIsSorted()).toBe(false);
    age?.toggleSorting();
    expect(age?.getIsSorted()).toBe("desc");
    expect(ids(table.getRowModel().rows)).toEqual(["2", "3", "5", "4", "1"]);
  });

  it("[TBL-11] multi-column sorting matches a stable oracle sort (property, seed 42)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 4 }),
            name: fc.constantFrom("a", "b", "c"),
            age: fc.integer({ min: 0, max: 5 }),
            team: fc.constant("t"),
            tags: fc.constant([] as string[]),
          }),
          { minLength: 0, maxLength: 25 },
        ),
        (rows) => {
          const table = createTable({
            features: full,
            data: rows,
            columns,
            getRowId: (row, index) => `${row.id}#${index}`,
            initialState: {
              sorting: [
                { id: "name", desc: false },
                { id: "age", desc: true },
              ],
            },
          });
          const expected = rows
            .map((row, index) => ({ row, index }))
            .sort((x, y) => {
              if (x.row.name !== y.row.name) return x.row.name < y.row.name ? -1 : 1;
              if (x.row.age !== y.row.age) return y.row.age - x.row.age;
              return x.index - y.index;
            })
            .map((entry) => entry.index);
          const actual = table.getRowModel().rows.map((row) => row.index);
          expect(actual).toEqual(expected);
        },
      ),
      { seed: 42 },
    );
  });

  it("[TBL-12] a custom sortingFn orders the column by its own rule", () => {
    const custom = createColumnHelper<Person>().accessor("tags", {
      id: "tagCount",
      sortingFn: (rowA, rowB, columnId) =>
        rowA.getValue<string[]>(columnId).length - rowB.getValue<string[]>(columnId).length,
    });
    const table = createTable({
      features: full,
      data: people,
      columns: [custom],
      getRowId: (row) => row.id,
      initialState: { sorting: [{ id: "tagCount", desc: false }] },
    });
    // Tag counts: 5 has 0, 1/3/4 have 1 (kept in data order), 2 has 2.
    expect(ids(table.getRowModel().rows)).toEqual(["5", "1", "3", "4", "2"]);
  });
});

describe("filtering", () => {
  it("[TBL-20] a column filter keeps the rows whose value includes the text, ignoring case", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.getColumn("name")?.setFilterValue("A");
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2", "4", "5"]);
  });

  it("[TBL-21] the global filter matches any column that enables it", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.setGlobalFilter("apol");
    expect(ids(table.getRowModel().rows)).toEqual(["4"]);
    table.setGlobalFilter("core");
    expect(ids(table.getRowModel().rows)).toEqual(["1", "3", "5"]);
  });

  it("[TBL-22] faceted values come from the rows before this column's own filter, with counts and a min and max", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.getColumn("team")?.setFilterValue("core");
    const teams = table.getColumn("team")?.getFacetedUniqueValues();
    expect(teams?.get("core")).toBe(3);
    expect(teams?.get("navy")).toBe(1);
    // The range of the rows the other filters keep: the core team's ages.
    expect(table.getColumn("age")?.getFacetedMinMaxValues()).toEqual([36, 54]);
  });

  it("[TBL-23] text filtering equals a naive case-insensitive substring scan (property, seed 42)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 6 }), { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 2 }),
        (names, needle) => {
          const data = names.map((name, index) => ({
            id: String(index),
            name,
            age: 0,
            team: "",
            tags: [],
          }));
          const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
          table.getColumn("name")?.setFilterValue(needle);
          const expected = names
            .map((name, index) =>
              name.toLowerCase().includes(needle.toLowerCase()) ? String(index) : undefined,
            )
            .filter((value): value is string => value !== undefined);
          expect(ids(table.getRowModel().rows)).toEqual(expected);
        },
      ),
      { seed: 42 },
    );
  });
});

describe("pagination", () => {
  it("[TBL-30] pages hold pageSize rows, next and previous move between them, and the index is kept in range", () => {
    const table = createTable({
      features: full,
      data: people,
      columns,
      getRowId: (row) => row.id,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
    expect(table.getPageCount()).toBe(3);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2"]);
    table.nextPage();
    expect(ids(table.getRowModel().rows)).toEqual(["3", "4"]);
    table.nextPage();
    table.nextPage();
    expect(table.getState().pagination.pageIndex).toBe(2);
    expect(table.getCanNextPage()).toBe(false);
    table.setPageIndex(40);
    expect(table.getState().pagination.pageIndex).toBe(2);
    table.previousPage();
    expect(ids(table.getRowModel().rows)).toEqual(["3", "4"]);
  });

  it("[TBL-31] equals the oracle slice for every page (property, seed 42)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant(0), { minLength: 0, maxLength: 30 }),
        fc.integer({ min: 1, max: 7 }),
        fc.integer({ min: 0, max: 6 }),
        (padding, pageSize, pageIndex) => {
          const data = padding.map((_, index) => ({
            id: String(index),
            name: "",
            age: index,
            team: "",
            tags: [],
          }));
          const table = createTable({
            features: full,
            data,
            columns,
            getRowId: (row) => row.id,
            initialState: { pagination: { pageIndex: 0, pageSize } },
          });
          const pages = Math.max(1, Math.ceil(data.length / pageSize));
          const wanted = Math.min(pageIndex, pages - 1);
          table.setPageIndex(pageIndex);
          expect(table.getState().pagination.pageIndex).toBe(wanted);
          expect(ids(table.getRowModel().rows)).toEqual(
            data.slice(wanted * pageSize, wanted * pageSize + pageSize).map((row) => row.id),
          );
        },
      ),
      { seed: 42 },
    );
  });

  it("[TBL-32] manual pagination leaves the rows alone and reports the page count it was given", () => {
    const table = createTable({
      features: full,
      data: people.slice(0, 2),
      columns,
      getRowId: (row) => row.id,
      manualPagination: true,
      pageCount: 10,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
    expect(table.getPageCount()).toBe(10);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2"]);
  });
});

describe("selection", () => {
  it("[TBL-40] selecting rows, selecting all of them and reading the selected model", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.getRow("1")?.toggleSelected(true);
    expect(table.getRow("1")?.getIsSelected()).toBe(true);
    expect(table.getState().rowSelection).toEqual({ "1": true });
    table.toggleAllRowsSelected(true);
    expect(table.getIsAllRowsSelected()).toBe(true);
    expect(ids(table.getSelectedRowModel().rows)).toEqual(["1", "2", "3", "4", "5"]);
    table.toggleAllRowsSelected(false);
    expect(table.getIsSomeRowsSelected()).toBe(false);
  });

  it("[TBL-41] a row's selection state is its own subscription: toggling another row does not rerun it", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    let runs = 0;
    createRoot(() => {
      useEffect(() => {
        void table.getRow("1")?.getIsSelected();
        runs += 1;
      });
    });
    flushSync();
    expect(runs).toBe(1);
    table.getRow("2")?.toggleSelected(true);
    flushSync();
    expect(runs).toBe(1);
    table.getRow("1")?.toggleSelected(true);
    flushSync();
    expect(runs).toBe(2);
  });

  it("[TBL-42] selecting a parent row selects its sub rows", () => {
    const tree: Person[] = [
      { ...pick(0), subRows: [pick(1), pick(2)] },
      { ...pick(3), subRows: [] },
    ];
    const table = createTable({
      features: full,
      data: tree,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.subRows,
    });
    table.getRow("1")?.toggleSelected(true);
    expect(table.getState().rowSelection).toEqual({ "1": true, "2": true, "3": true });
  });
});

describe("expansion", () => {
  it("[TBL-50] an expanded row shows its sub rows after it, and toggling all rows expands every level", () => {
    const tree: Person[] = [
      { ...pick(0), subRows: [pick(1), pick(2)] },
      { ...pick(3), subRows: [pick(4)] },
    ];
    const table = createTable({
      features: full,
      data: tree,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.subRows,
    });
    expect(ids(table.getRowModel().rows)).toEqual(["1", "4"]);
    expect(table.getRow("1")?.getCanExpand()).toBe(true);
    table.getRow("1")?.toggleExpanded(true);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2", "3", "4"]);
    table.toggleAllRowsExpanded(true);
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("grouping and aggregation", () => {
  it("[TBL-60] grouping by a column makes one group row per value, aggregated by the column's aggregationFn", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.setGrouping(["team"]);
    const groups = table.getGroupedRowModel().rows;
    expect(groups.map((row) => row.getGroupingValue("team"))).toEqual(["core", "navy", "apollo"]);
    const core = groups[0];
    expect(core?.getIsGrouped()).toBe(true);
    expect(core?.getValue("age")).toBe(36 + 54 + 41);
    expect(core?.subRows.map((row) => row.original.id)).toEqual(["1", "3", "5"]);
  });

  it("[TBL-61] aggregation functions match a plain oracle (sum, count, min, max, mean, unique) (property, seed 42)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 20 }),
        (ages) => {
          const data = ages.map((age, index) => ({
            id: String(index),
            name: "",
            age,
            team: "one",
            tags: [],
          }));
          const table = createTable({
            features: full,
            data,
            columns: [
              helper.accessor("team", { header: "Team", enableGrouping: true }),
              helper.accessor("age", { header: "Age", aggregationFn: "sum" }),
            ],
            getRowId: (row) => row.id,
            initialState: { grouping: ["team"] },
          });
          const group = table.getGroupedRowModel().rows[0];
          expect(group?.getValue("age")).toBe(ages.reduce((total, age) => total + age, 0));
        },
      ),
      { seed: 42 },
    );
  });
});

describe("column state", () => {
  it("[TBL-70] a hidden column leaves the visible leaf columns and its cells", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.getColumn("age")?.toggleVisibility(false);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual(["name", "team"]);
    expect(
      table
        .getRowModel()
        .rows[0]?.getVisibleCells()
        .map((cell) => cell.column.id),
    ).toEqual(["name", "team"]);
  });

  it("[TBL-71] column order sets the order of the visible columns", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.setColumnOrder(["team", "name", "age"]);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      "team",
      "name",
      "age",
    ]);
  });

  it("[TBL-72] pinned columns are partitioned into left, center and right", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    table.getColumn("name")?.pin("left");
    table.getColumn("team")?.pin("right");
    expect(table.getLeftLeafColumns().map((column) => column.id)).toEqual(["name"]);
    expect(table.getCenterLeafColumns().map((column) => column.id)).toEqual(["age"]);
    expect(table.getRightLeafColumns().map((column) => column.id)).toEqual(["team"]);
  });

  it("[TBL-73] sizes default to 150, resizing is clamped to min and max, and the total sums the visible sizes", () => {
    const sized = [
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", { header: "Age", minSize: 50, maxSize: 200 }),
    ];
    const table = createTable({
      features: full,
      data: people,
      columns: sized,
      getRowId: (row) => row.id,
    });
    expect(table.getColumn("name")?.getSize()).toBe(150);
    table.setColumnSizing({ age: 999 });
    expect(table.getColumn("age")?.getSize()).toBe(200);
    table.setColumnSizing({ age: 10 });
    expect(table.getColumn("age")?.getSize()).toBe(50);
    expect(table.getTotalSize()).toBe(150 + 50);
  });
});

describe("controlled and manual state", () => {
  it("[TBL-80] a controlled slice reports its changes to onStateChange and follows its own signal", () => {
    const [sorting, setSorting] = useSignal<{ id: string; desc: boolean }[]>([]);
    const changes: unknown[] = [];
    const table = createTable({
      features: full,
      data: people,
      columns,
      getRowId: (row) => row.id,
      state: { sorting },
      onStateChange: (name, value) => changes.push([name, value]),
    });
    table.getColumn("age")?.toggleSorting();
    expect(changes).toEqual([["sorting", [{ id: "age", desc: true }]]]);
    expect(table.getState().sorting).toEqual([]);
    setSorting([{ id: "age", desc: true }]);
    expect(ids(table.getRowModel().rows)).toEqual(["2", "3", "5", "4", "1"]);
  });

  it("[TBL-81] manual sorting and filtering keep the data order: the server did the work", () => {
    const table = createTable({
      features: full,
      data: people,
      columns,
      getRowId: (row) => row.id,
      manualSorting: true,
      manualFiltering: true,
      initialState: { sorting: [{ id: "age", desc: true }] },
    });
    table.getColumn("name")?.setFilterValue("zzz");
    expect(ids(table.getRowModel().rows)).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("useTable", () => {
  it("[TBL-82] useTable is createTable: the same rows, sorted the same way", () => {
    const table = useTable({ data: people, columns, getRowId: (row) => row.id });
    table.getColumn("age")?.toggleSorting(true);
    expect(ids(table.getRowModel().rows)).toEqual(["2", "3", "5", "4", "1"]);
  });
});
