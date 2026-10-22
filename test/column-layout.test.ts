/**
 * `@shadow-js/table`: the layout of columns. Column offsets (`getStart`), header groups with their
 * placeholders, and header groups that follow visibility, order and pinning.
 */

import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable, type Header, type HeaderGroup } from "../src/index";

interface Person {
  id: string;
  first: string;
  last: string;
  age: number;
  team: string;
}

const people: Person[] = [{ id: "1", first: "Ada", last: "Lovelace", age: 36, team: "core" }];

const helper = createColumnHelper<Person>();

/** `person` groups `first` and `last`; `age` and `team` are top-level columns. */
function makeColumns() {
  return [
    helper.group({
      id: "person",
      header: "Person",
      columns: [
        helper.accessor("first", { header: "First", size: 100 }),
        helper.accessor("last", { header: "Last", size: 120 }),
      ],
    }),
    helper.accessor("age", { header: "Age", size: 80 }),
    helper.accessor("team", { header: "Team", size: 90 }),
  ];
}

function makeTable(initialState: Parameters<typeof createTable<Person>>[0]["initialState"] = {}) {
  return createTable<Person>({
    features: full,
    data: people,
    columns: makeColumns(),
    getRowId: (row) => row.id,
    initialState,
  });
}

/** One header as `[id, column id, isPlaceholder, colSpan, rowSpan]`, for compact assertions. */
type Shape = readonly [string, string, boolean, number, number];

function shapes(groups: readonly HeaderGroup<Person>[]): Shape[][] {
  return groups.map((group) =>
    group.headers.map(
      (header: Header<Person>): Shape => [
        header.id,
        header.column.id,
        header.isPlaceholder,
        header.colSpan,
        header.rowSpan,
      ],
    ),
  );
}

describe("column offsets", () => {
  it("[TBL-111] getStart is the sum of the sizes of the visible columns before the column, and 0 when hidden", () => {
    const table = makeTable();
    expect(table.getColumn("first")?.getStart()).toBe(0);
    expect(table.getColumn("last")?.getStart()).toBe(100);
    expect(table.getColumn("age")?.getStart()).toBe(220);
    expect(table.getColumn("team")?.getStart()).toBe(300);
    // A group starts where its first visible leaf starts.
    expect(table.getColumn("person")?.getStart()).toBe(0);
    table.getColumn("first")?.toggleVisibility(false);
    expect(table.getColumn("last")?.getStart()).toBe(0);
    expect(table.getColumn("age")?.getStart()).toBe(120);
    table.getColumn("age")?.toggleVisibility(false);
    expect(table.getColumn("age")?.getStart()).toBe(0);
    expect(table.getColumn("team")?.getStart()).toBe(120);
  });

  it("[TBL-112] getStart counts each pinned section from its own left edge", () => {
    const table = makeTable();
    table.getColumn("team")?.pin("left");
    // Left section: team only, so it starts at 0. The center starts after nothing from the left.
    expect(table.getColumn("team")?.getStart()).toBe(0);
    expect(table.getColumn("first")?.getStart()).toBe(0);
    expect(table.getColumn("age")?.getStart()).toBe(220);
    expect(table.getColumn("age")?.getStart("center")).toBe(220);
    expect(table.getColumn("age")?.getStart("left")).toBe(0);
    table.getColumn("age")?.pin("right");
    expect(table.getColumn("age")?.getStart("right")).toBe(0);
    expect(table.getColumn("last")?.getStart()).toBe(100);
  });
});

describe("header groups", () => {
  it("[TBL-113] a shallow column gets a placeholder in each row below it, and a leaf spans down to the last row", () => {
    const table = makeTable();
    expect(shapes(table.getHeaderGroups())).toEqual([
      [
        ["person", "person", false, 2, 1],
        ["age", "age", false, 1, 2],
        ["team", "team", false, 1, 2],
      ],
      [
        ["first", "first", false, 1, 1],
        ["last", "last", false, 1, 1],
        [expect.any(String), "age", true, 1, 1],
        [expect.any(String), "team", true, 1, 1],
      ],
    ]);
  });

  it("[TBL-114] a hidden column leaves its header row and a group's colSpan counts only visible leaves", () => {
    const table = makeTable();
    table.getColumn("first")?.toggleVisibility(false);
    const groups = table.getHeaderGroups();
    expect(groups.map((group) => group.headers.map((header) => header.column.id))).toEqual([
      ["person", "age", "team"],
      ["last", "age", "team"],
    ]);
    expect(groups[0]?.headers[0]?.colSpan).toBe(1);
    expect(groups[0]?.headers[0]?.getSize()).toBe(120);
    expect(groups[1]?.headers[2]?.isPlaceholder).toBe(true);
  });

  it("[TBL-114b] a group whose leaves are all hidden has no header, and the rows shrink to the visible depth", () => {
    const table = makeTable();
    table.getColumn("person")?.toggleVisibility(false);
    expect(table.getColumn("person")?.getIsVisible()).toBe(false);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual(["age", "team"]);
    const groups = table.getHeaderGroups();
    expect(groups).toHaveLength(1);
    expect(shapes(groups)).toEqual([
      [
        ["age", "age", false, 1, 1],
        ["team", "team", false, 1, 1],
      ],
    ]);
  });

  it("[TBL-115] the headers follow the column order: a group's leaves keep their order in the row", () => {
    const table = makeTable();
    table.setColumnOrder(["age", "first", "last"]);
    const groups = table.getHeaderGroups();
    expect(groups[0]?.headers.map((header) => header.column.id)).toEqual(["age", "person", "team"]);
    expect(groups[1]?.headers.map((header) => header.column.id)).toEqual([
      "age",
      "first",
      "last",
      "team",
    ]);
  });

  it("[TBL-116] hiding a group hides its leaves, and showing it shows them again", () => {
    const table = makeTable();
    table.getColumn("person")?.toggleVisibility(false);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual(["age", "team"]);
    table.getColumn("person")?.toggleVisibility();
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      "first",
      "last",
      "age",
      "team",
    ]);
  });

  it("[TBL-117] pinning a group pins its leaves, and the group reports the side they share", () => {
    const table = makeTable();
    table.getColumn("person")?.pin("left");
    expect(table.getColumn("person")?.getIsPinned()).toBe("left");
    expect(table.getLeftLeafColumns().map((column) => column.id)).toEqual(["first", "last"]);
    expect(table.getCenterLeafColumns().map((column) => column.id)).toEqual(["age", "team"]);
    table.getColumn("person")?.pin(false);
    expect(table.getColumn("person")?.getIsPinned()).toBe(false);
    expect(table.getLeftLeafColumns()).toEqual([]);
  });

  it("[TBL-118] for any nesting and visibility, every header row covers each visible leaf once", () => {
    // A fixed case with mixed depths and a hidden leaf: rows are as many as the deepest visible leaf.
    const deep = createColumnHelper<Person>();
    const table = createTable<Person>({
      features: full,
      data: people,
      columns: [
        deep.group({
          id: "outer",
          header: "Outer",
          columns: [
            deep.group({
              id: "inner",
              header: "Inner",
              columns: [deep.accessor("first"), deep.accessor("last")],
            }),
            deep.accessor("age"),
          ],
        }),
        deep.accessor("team"),
      ],
      getRowId: (row) => row.id,
      initialState: { columnVisibility: { last: false } },
    });
    const groups = table.getHeaderGroups();
    const visible = table.getVisibleLeafColumns().length;
    expect(visible).toBe(3);
    expect(groups).toHaveLength(3);
    for (const group of groups) {
      expect(group.headers.reduce((total, header) => total + header.colSpan, 0)).toBe(visible);
    }
  });
});
