/**
 * The table in a right-to-left page. The table is headless and its pinning sides are physical (`left`, `right`), as in
 * the libraries it follows; the application maps the start of the line to a side by the page's direction. These tests pin
 * that contract with Arabic data: pinning, the order of cells, sorting and the global filter.
 */
import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";
import { locale } from "../src/locale";

interface Person {
  id: string;
  name: string;
  city: string;
}

const helper = createColumnHelper<Person>();
const people: Person[] = [
  { id: "1", name: "سارة", city: "الرياض" },
  { id: "2", name: "أحمد", city: "جدة" },
  { id: "3", name: "ابراهيم", city: "الدمام" },
];

const columns = [
  helper.accessor("id", { header: "#" }),
  helper.accessor("name", { header: "الاسم" }),
  helper.accessor("city", { header: "المدينة" }),
];

/** The sides a layout shows for the start and the end of the line. */
function sides(dir: "ltr" | "rtl"): { start: "left" | "right"; end: "left" | "right" } {
  return dir === "rtl" ? { start: "right", end: "left" } : { start: "left", end: "right" };
}

describe("pinning in a right-to-left page", () => {
  it("[TBL-RTL-01] the pinned sections are physical, so the start column is the right-pinned one when the page is RTL", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    const { start } = sides("rtl");
    table.getColumn("id")?.pin(start);
    expect(table.getRightLeafColumns().map((column) => column.id)).toEqual(["id"]);
    expect(table.getLeftLeafColumns()).toEqual([]);
    expect(table.getCenterLeafColumns().map((column) => column.id)).toEqual(["name", "city"]);
  });

  it("[TBL-RTL-02] the cells of a row are in column order; the page's direction lays them out right to left", () => {
    const table = createTable({ features: full, data: people, columns, getRowId: (row) => row.id });
    const row = table.getRowModel().rows[0];
    expect(row?.getVisibleCells().map((cell) => cell.getValue())).toEqual(["1", "سارة", "الرياض"]);
  });
});

describe("Arabic data", () => {
  it("[TBL-RTL-03] names sort by their letters with the locale feature, hamza forms of alef with alef", () => {
    const table = createTable({
      features: [...full, locale],
      locale: "ar",
      data: people,
      columns,
      getRowId: (row) => row.id,
      initialState: { sorting: [{ id: "name", desc: false }] },
    });
    expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual([
      "ابراهيم",
      "أحمد",
      "سارة",
    ]);
  });

  it("[TBL-RTL-04] the global filter finds Arabic text in any column", () => {
    const table = createTable({
      features: full,
      data: people,
      columns,
      getRowId: (row) => row.id,
      initialState: { globalFilter: "جد" },
    });
    expect(table.getRowModel().rows.map((row) => row.original.id)).toEqual(["2"]);
  });
});
