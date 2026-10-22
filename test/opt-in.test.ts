import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { grouping } from "../src/grouping";
import {
  createColumnHelper,
  createTable,
  type Table,
  type TableFeature,
  type TableFeatureName,
} from "../src/index";

interface Person {
  id: string;
  name: string;
  age: number;
  children?: Person[];
}

const helper = createColumnHelper<Person>();
const people: Person[] = [
  { id: "1", name: "Ada", age: 36, children: [{ id: "4", name: "Byron", age: 10 }] },
  { id: "2", name: "Grace", age: 85 },
  { id: "3", name: "Linus", age: 54 },
];
const columns = [
  helper.accessor("name", { header: "Name" }),
  helper.accessor("age", { header: "Age" }),
];

/** A table created without any feature. */
const plain = (): Table<Person> =>
  createTable({
    data: people,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
  });

describe("the default table without features", () => {
  // Each call uses one member a feature owns. The table without that feature throws the named error.
  const calls: [string, (table: Table<Person>) => unknown, TableFeatureName][] = [
    ["table.setGrouping", (table) => table.setGrouping(["name"]), "grouping"],
    ["table.getGroupedRowModel", (table) => table.getGroupedRowModel(), "grouping"],
    ["column.toggleGrouping", (table) => table.getColumn("name")?.toggleGrouping(), "grouping"],
    ["row.getCanExpand", (table) => table.getRow("1")?.getCanExpand(), "expanding"],
    ["row.toggleExpanded", (table) => table.getRow("1")?.toggleExpanded(true), "expanding"],
    ["table.toggleAllRowsExpanded", (table) => table.toggleAllRowsExpanded(true), "expanding"],
    ["table.setColumnPinning", (table) => table.setColumnPinning({ left: ["name"] }), "pinning"],
    ["table.getLeftLeafColumns", (table) => table.getLeftLeafColumns(), "pinning"],
    ["column.pin", (table) => table.getColumn("name")?.pin("left"), "pinning"],
    ["table.setColumnSizing", (table) => table.setColumnSizing({ name: 100 }), "sizing"],
    ["column.getCanResize", (table) => table.getColumn("name")?.getCanResize(), "sizing"],
    ["table.getHeaderGroups", (table) => table.getHeaderGroups(), "layout"],
    ["table.getTotalSize", (table) => table.getTotalSize(), "layout"],
    ["column.getStart", (table) => table.getColumn("name")?.getStart(), "layout"],
    [
      "column.getFacetedRowModel",
      (table) => table.getColumn("name")?.getFacetedRowModel(),
      "faceting",
    ],
    [
      "table.setColumnVisibility",
      (table) => table.setColumnVisibility({ age: false }),
      "visibility",
    ],
    [
      "column.toggleVisibility",
      (table) => table.getColumn("age")?.toggleVisibility(false),
      "visibility",
    ],
    ["table.setColumnOrder", (table) => table.setColumnOrder(["age", "name"]), "ordering"],
  ];

  it.each(calls)(
    "[TBL-200] %s throws a TypeError that names its feature and import",
    (_name, call, feature) => {
      const error = (() => {
        try {
          call(plain());
          return undefined;
        } catch (caught) {
          return caught;
        }
      })();
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toContain(`the ${feature} feature`);
      expect((error as Error).message).toContain(`"@shadow-js/table/${feature}"`);
      expect((error as Error).message).toContain("@shadow-js/table/full");
    },
  );

  it("[TBL-201] sorts, filters, selects and pages, and shows only the root rows", () => {
    const table = plain();
    table.getColumn("age")?.toggleSorting(true);
    expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual([
      "Grace",
      "Linus",
      "Ada",
    ]);
    table.setGlobalFilter("a");
    expect(table.getRowCount()).toBe(2);
    table.setGlobalFilter("Gr");
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["2"]);
    table.setGlobalFilter("");
    table.setPagination({ pageIndex: 0, pageSize: 2 });
    expect(table.getPageCount()).toBe(2);
    table.getRow("3")?.toggleSelected(true);
    expect(table.getSelectedRowModel().rows.map((row) => row.id)).toEqual(["3"]);
    // Sub rows exist in the data, but without the expanding feature they are not in the row model.
    expect(table.getRow("4")?.depth).toBe(1);
    expect(table.getCoreRowModel().flatRows.length).toBe(4);
    expect(table.getRowModel().flatRows.some((row) => row.id === "4")).toBe(false);
  });

  it("[TBL-202] a state slice of a feature the table lacks throws, and works with that feature", () => {
    expect(() =>
      createTable({ data: people, columns, initialState: { grouping: ["name"] } }),
    ).toThrow(/initialState\.grouping needs the grouping feature/);
    expect(() =>
      createTable({ data: people, columns, state: { columnPinning: () => ({}) } }),
    ).toThrow(/the pinning feature/);
    const table = createTable({
      data: people,
      columns,
      features: [grouping],
      initialState: { grouping: ["name"] },
    });
    expect(table.getState().grouping).toEqual(["name"]);
    // A table without the feature reports its state as empty.
    expect(plain().getState().grouping).toEqual([]);
    expect(plain().getState().expanded).toEqual({});
  });

  it("[TBL-203] a feature listed twice counts once, and two different features of one name throw", () => {
    const table = createTable({ data: people, columns, features: [grouping, grouping] });
    expect(table.getState().grouping).toEqual([]);
    const impostor: TableFeature<"grouping"> = { name: "grouping", install: () => undefined };
    expect(() => createTable({ data: people, columns, features: [grouping, impostor] })).toThrow(
      /two different "grouping" features/,
    );
  });
});

describe("the full preset", () => {
  it("[TBL-204] lists every feature once, in order, and frozen", () => {
    expect(full.map((feature) => feature.name)).toEqual([
      "grouping",
      "expanding",
      "pinning",
      "sizing",
      "layout",
      "faceting",
      "visibility",
      "ordering",
    ]);
    expect(Object.isFrozen(full)).toBe(true);
  });

  it("[TBL-205] a table created with the full preset has every feature's members", () => {
    const table = createTable({
      data: people,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
      features: full,
    });
    table.setGrouping(["age"]);
    expect(table.getGroupedRowModel().rows.length).toBe(3);
    table.setGrouping([]);
    table.getRow("1")?.toggleExpanded(true);
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["1", "4", "2", "3"]);
    table.setColumnPinning({ left: ["name"] });
    expect(table.getLeftLeafColumns().map((column) => column.id)).toEqual(["name"]);
    table.setColumnSizing({ name: 120 });
    expect(table.getTotalSize()).toBe(120 + 150);
    expect(table.getHeaderGroups()[0]?.headers.length).toBe(2);
    // The sub row (age 10) is one of the rows the faceted values come from.
    expect(table.getColumn("age")?.getFacetedMinMaxValues()).toEqual([10, 85]);
    table.setColumnVisibility({ age: false });
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual(["name"]);
    table.setColumnOrder(["age", "name"]);
    expect(table.getColumn("name")?.getStart()).toBe(0);
  });
});
