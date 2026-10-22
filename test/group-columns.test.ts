/**
 * `@shadow-js/table`: group columns (`helper.group`). The child columns of a group are leaf columns
 * of the table: they have cells, sizes and state methods, and the header groups span them.
 */

import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Person {
  id: string;
  first: string;
  last: string;
  age: number;
}

const people: Person[] = [
  { id: "1", first: "Ada", last: "Lovelace", age: 36 },
  { id: "2", first: "Grace", last: "Hopper", age: 85 },
];

const helper = createColumnHelper<Person>();
const columns = [
  helper.group({
    id: "person",
    header: "Person",
    columns: [
      helper.accessor("first", { header: "First" }),
      helper.accessor("last", { header: "Last" }),
    ],
  }),
  helper.accessor("age", { header: "Age" }),
];

describe("group columns", () => {
  it("[TBL-90] the child columns of a group are leaf columns with cells, sizes and state methods", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual(["first", "last", "age"]);
    expect(table.getAllColumns().map((column) => column.id)).toEqual([
      "person",
      "first",
      "last",
      "age",
    ]);
    expect(
      table
        .getRowModel()
        .rows[0]?.getVisibleCells()
        .map((cell) => cell.getValue()),
    ).toEqual(["Ada", "Lovelace", 36]);
    expect(table.getColumn("first")?.getSize()).toBe(150);
    expect(table.getTotalSize()).toBe(450);
    table.getColumn("last")?.toggleSorting(false);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["2", "1"]);
  });

  it("[TBL-91] the header groups follow the nesting: a group header spans its leaf columns", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    const groups = table.getHeaderGroups();
    // `age` is a leaf at depth 0: it spans both rows, and the second row holds its placeholder.
    expect(groups.map((group) => group.headers.map((header) => header.id))).toEqual([
      ["person", "age"],
      ["first", "last", expect.any(String)],
    ]);
    expect(groups[1]?.headers.map((header) => header.isPlaceholder)).toEqual([false, false, true]);
    expect(groups[0]?.headers[0]?.colSpan).toBe(2);
    expect(groups[0]?.headers[0]?.getSize()).toBe(300);
  });
});
