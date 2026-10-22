/**
 * `@shadow-js/table`: per-row selection and expansion in a tree deeper than one level. Selecting a
 * row selects every row under it, and collapsing one row after expanding all of them collapses only
 * that row.
 */

import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Node {
  id: string;
  name: string;
  children?: Node[];
}

const tree: Node[] = [
  {
    id: "a",
    name: "A",
    children: [{ id: "a1", name: "A1", children: [{ id: "a1x", name: "A1x" }] }],
  },
  { id: "b", name: "B", children: [{ id: "b1", name: "B1" }] },
];

const columns = [createColumnHelper<Node>().accessor("name", { header: "Name" })];

function makeTable() {
  return createTable({
    features: full,
    data: tree,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
  });
}

describe("sub row state", () => {
  it("[TBL-92] selecting a row selects every row under it, at every depth", () => {
    const table = makeTable();
    table.getRow("a")?.toggleSelected(true);
    expect(table.getState().rowSelection).toEqual({ a: true, a1: true, a1x: true });
    expect(table.getRow("a1")?.getIsSelected()).toBe(true);
    table.getRow("a")?.toggleSelected(false);
    expect(table.getState().rowSelection).toEqual({});
  });

  it("[TBL-93] collapsing one row after expanding all rows keeps the other rows expanded", () => {
    const table = makeTable();
    table.toggleAllRowsExpanded(true);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["a", "a1", "a1x", "b", "b1"]);
    table.getRow("a1")?.toggleExpanded(false);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["a", "a1", "b", "b1"]);
  });
});
