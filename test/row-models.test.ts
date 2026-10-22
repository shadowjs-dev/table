/**
 * `@shadow-js/table`: the row models as trees. `flatRows` lists each row once, sub rows follow the
 * filters and the sorting at every depth, and `getRowCount` counts the rows the filters keep.
 */

import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Node {
  id: string;
  name: string;
  age: number;
  children?: Node[];
}

/**
 * Three roots: `a` has two sub rows (`a1` has one more, `a2`), `b` has one, `c` has none.
 * Names: Ada, Alan, Brooke, Bob, Bea, Carl, Cy.
 */
const tree: Node[] = [
  {
    id: "a",
    name: "Ada",
    age: 36,
    children: [
      { id: "a1", name: "Alan", age: 41, children: [{ id: "a1x", name: "Brooke", age: 20 }] },
      { id: "a2", name: "Bob", age: 22 },
    ],
  },
  { id: "b", name: "Bea", age: 30, children: [{ id: "b1", name: "Carl", age: 50 }] },
  { id: "c", name: "Cy", age: 60 },
];

const helper = createColumnHelper<Node>();
const columns = [
  helper.accessor("name", { header: "Name" }),
  helper.accessor("age", { header: "Age", aggregationFn: "sum" }),
];

function makeTable(options: Partial<Parameters<typeof createTable<Node>>[0]> = {}) {
  return createTable<Node>({
    features: full,
    data: tree,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    ...options,
  });
}

function ids(rows: readonly { id: string }[]): string[] {
  return rows.map((row) => row.id);
}

describe("flat rows", () => {
  it("[TBL-100] the core model lists every row once, parents before children", () => {
    const table = makeTable();
    expect(ids(table.getCoreRowModel().flatRows)).toEqual(["a", "a1", "a1x", "a2", "b", "b1", "c"]);
  });

  it("[TBL-101] the expanded model lists each shown row once, and a collapsed row's sub rows are not shown", () => {
    const table = makeTable();
    table.getRow("a")?.toggleExpanded(true);
    expect(ids(table.getRowModel().rows)).toEqual(["a", "a1", "a2", "b", "c"]);
    expect(ids(table.getExpandedRowModel().flatRows)).toEqual(["a", "a1", "a2", "b", "c"]);
    table.toggleAllRowsExpanded(true);
    expect(ids(table.getExpandedRowModel().flatRows)).toEqual([
      "a",
      "a1",
      "a1x",
      "a2",
      "b",
      "b1",
      "c",
    ]);
  });

  it("[TBL-102] the filtered model's flatRows hold the kept rows at every depth, with sub rows filtered", () => {
    const table = makeTable({ initialState: { globalFilter: "bob" } });
    // Only Bob (a2) passes: its parent is kept with it, and the sibling a1 (with a1x) is not.
    expect(ids(table.getFilteredRowModel().rows)).toEqual(["a"]);
    expect(ids(table.getFilteredRowModel().flatRows)).toEqual(["a", "a2"]);
    table.toggleAllRowsExpanded(true);
    expect(ids(table.getRowModel().rows)).toEqual(["a", "a2"]);
  });

  it("[TBL-103] the row count is the number of rows the filters keep, at every depth", () => {
    const table = makeTable();
    expect(table.getRowCount()).toBe(7);
    table.setGlobalFilter("bob");
    expect(table.getRowCount()).toBe(2);
    expect(table.getRowCount()).toBe(table.getFilteredRowModel().flatRows.length);
    table.setGlobalFilter("");
    expect(table.getRowCount()).toBe(7);
  });

  it("[TBL-103b] with manual filtering the row count keeps every row", () => {
    const table = makeTable({ manualFiltering: true, initialState: { globalFilter: "bob" } });
    expect(table.getRowCount()).toBe(7);
    expect(ids(table.getFilteredRowModel().flatRows)).toEqual([
      "a",
      "a1",
      "a1x",
      "a2",
      "b",
      "b1",
      "c",
    ]);
  });

  it("[TBL-104] a parent that passes keeps only the sub rows that pass or lead to a passing row", () => {
    const table = makeTable({ initialState: { globalFilter: "ada" } });
    // Ada passes. Alan, Bob and Brooke do not, so the parent stands alone.
    expect(ids(table.getFilteredRowModel().flatRows)).toEqual(["a"]);
    table.toggleAllRowsExpanded(true);
    expect(ids(table.getRowModel().rows)).toEqual(["a"]);
    expect(table.getRow("a")?.getCanExpand()).toBe(false);
  });

  it("[TBL-105] sorting applies at every depth, and the expanded rows follow it", () => {
    const table = makeTable();
    table.getColumn("name")?.toggleSorting(true);
    table.toggleAllRowsExpanded(true);
    // Roots by name descending: Cy, Bea, Ada; sub rows the same way: Bob before Alan.
    expect(ids(table.getRowModel().rows)).toEqual(["c", "b", "b1", "a", "a2", "a1", "a1x"]);
  });

  it("[TBL-106] the sorted model's flatRows follow the sorted order at every depth", () => {
    const table = makeTable();
    table.getColumn("name")?.toggleSorting(true);
    expect(ids(table.getSortedRowModel().flatRows)).toEqual([
      "c",
      "b",
      "b1",
      "a",
      "a2",
      "a1",
      "a1x",
    ]);
  });

  it("[TBL-107] group rows with equal string forms get distinct ids and separate expansion", () => {
    const mixed: { id: string; value: number | string }[] = [
      { id: "1", value: 1 },
      { id: "2", value: "1" },
      { id: "3", value: 1 },
    ];
    const value = createColumnHelper<{ id: string; value: number | string }>().accessor("value", {
      header: "Value",
      enableGrouping: true,
    });
    const table = createTable({
      features: full,
      data: mixed,
      columns: [value],
      getRowId: (row) => row.id,
      initialState: { grouping: ["value"] },
    });
    const groups = table.getGroupedRowModel().rows;
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((group) => group.id)).size).toBe(2);
    groups[0]?.toggleExpanded(true);
    expect(groups[0]?.getIsExpanded()).toBe(true);
    expect(groups[1]?.getIsExpanded()).toBe(false);
  });

  it("[TBL-108] a row with no kept sub rows cannot expand, and a row with kept sub rows can", () => {
    const table = makeTable({ initialState: { globalFilter: "brooke" } });
    expect(table.getRow("a")?.getCanExpand()).toBe(true);
    expect(table.getRow("a1")?.getCanExpand()).toBe(true);
    expect(table.getRow("a2")?.getCanExpand()).toBe(false);
  });
});
