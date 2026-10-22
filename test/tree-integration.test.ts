import { useSignal } from "@shadow-js/core";
import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable, type PaginationState } from "../src/index";

interface Item {
  id: string;
  name: string;
  age: number;
  children?: Item[];
}
const data: Item[] = [
  {
    id: "a",
    name: "A",
    age: 36,
    children: [
      { id: "a1", name: "A1", age: 50 },
      { id: "a2", name: "A2", age: 22 },
    ],
  },
  { id: "b", name: "B", age: 40, children: [{ id: "b1", name: "B1", age: 45 }] },
  { id: "c", name: "C", age: 60 },
];
const helper = createColumnHelper<Item>();
const columns = [helper.accessor("name"), helper.accessor("age"), helper.accessor("id")];
const treeTable = () =>
  createTable({
    data,
    columns,
    features: full,
    getRowId: (item) => item.id,
    getSubRows: (item) => item.children,
  });

describe("tree features and controlled pagination", () => {
  it("[TBL-TREE-01] facets count leaf rows at every depth and ignore only their own filter", () => {
    const table = treeTable();
    const age = table.getColumn("age");
    expect([...(age?.getFacetedUniqueValues() ?? [])]).toEqual([
      [50, 1],
      [22, 1],
      [45, 1],
      [60, 1],
    ]);
    expect(age?.getFacetedMinMaxValues()).toEqual([22, 60]);
    age?.setFilterValue([30, 40]);
    table.getColumn("name")?.setFilterValue("A");
    expect([...(age?.getFacetedUniqueValues() ?? [])]).toEqual([
      [50, 1],
      [22, 1],
    ]);
    expect(age?.getFacetedMinMaxValues()).toEqual([22, 50]);
    expect(age?.getFacetedRowModel().map((row) => row.id)).toEqual(["a"]);
    table.getColumn("name")?.setFilterValue("B");
    expect([...(age?.getFacetedUniqueValues() ?? [])]).toEqual([[45, 1]]);
    expect(age?.getFacetedMinMaxValues()).toEqual([40, 45]);
  });

  it("[TBL-TREE-02] expanded sub-row cells keep column order while exposing pinned sections", () => {
    const table = treeTable();
    table.toggleAllRowsExpanded(true);
    table.getColumn("age")?.pin("right");
    table.getColumn("name")?.pin("left");
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual([
      "a",
      "a1",
      "a2",
      "b",
      "b1",
      "c",
    ]);
    for (const row of table.getRowModel().rows) {
      expect(row.getVisibleCells().map((cell) => cell.column.id)).toEqual(["name", "age", "id"]);
      expect(table.getLeftLeafColumns().map((column) => row.getValue(column.id))).toEqual([
        row.original.name,
      ]);
      expect(table.getRightLeafColumns().map((column) => row.getValue(column.id))).toEqual([
        row.original.age,
      ]);
    }
    table.getColumn("id")?.toggleVisibility(false);
    for (const row of table.getRowModel().rows) {
      expect(row.getVisibleCells().map((cell) => cell.column.id)).toEqual(["name", "age"]);
    }
  });

  it("[TBL-PAGE-01] controlled pagination reports requests and follows accepted external state", () => {
    const [pagination, setPagination] = useSignal<PaginationState>({ pageIndex: 0, pageSize: 1 });
    const changes: unknown[] = [];
    const table = createTable({
      data,
      columns,
      features: full,
      getRowId: (item) => item.id,
      state: { pagination },
      onStateChange: (slice, next) => {
        if (slice === "pagination") changes.push(next);
      },
    });
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["a"]);
    table.nextPage();
    expect(changes).toEqual([{ pageIndex: 1, pageSize: 1 }]);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["a"]);
    setPagination({ pageIndex: 1, pageSize: 1 });
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["b"]);
    table.setPageSize(2);
    expect(changes[1]).toEqual({ pageIndex: 0, pageSize: 2 });
    setPagination({ pageIndex: 0, pageSize: 2 });
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
});
