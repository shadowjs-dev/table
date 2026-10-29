/**
 * Review round: sorting with values that have no order (NaN, invalid dates, mixed types), a page
 * that no longer exists after the data shrank, page numbers that are not numbers, and faceted
 * ranges poisoned by NaN.
 */
import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Item {
  id: string;
  value: unknown;
}

const helper = createColumnHelper<Item>();
const columns = [helper.accessor("value", { header: "Value", id: "value" })];

function items(values: readonly unknown[]): Item[] {
  return values.map((value, index) => ({ id: String(index), value }));
}

function sortedValues(values: readonly unknown[], desc: boolean): unknown[] {
  const table = createTable({
    features: full,
    data: items(values),
    columns,
    getRowId: (row) => row.id,
    initialState: { sorting: [{ id: "value", desc }] },
  });
  return table.getSortedRowModel().rows.map((row) => row.original.value);
}

describe("sorting values with no order", () => {
  it("[TBL-REV-1] NaN sorts last in both directions, whatever the input order", () => {
    const base = [3, Number.NaN, 1, 2, Number.NaN, 5];
    for (const shift of [0, 1, 2, 3, 4, 5]) {
      const data = [...base.slice(shift), ...base.slice(0, shift)];
      expect(sortedValues(data, false)).toEqual([1, 2, 3, 5, Number.NaN, Number.NaN]);
      expect(sortedValues(data, true)).toEqual([5, 3, 2, 1, Number.NaN, Number.NaN]);
    }
  });

  it("[TBL-REV-2] an invalid Date sorts last in both directions", () => {
    const early = new Date(1000);
    const late = new Date(5000);
    const invalid = new Date(Number.NaN);
    expect(sortedValues([late, invalid, early], false)).toEqual([early, late, invalid]);
    expect(sortedValues([late, invalid, early], true)).toEqual([late, early, invalid]);
  });

  it("[TBL-REV-3] numbers and text in one column order consistently: numbers by value, then text, whatever the input order", () => {
    const base = [10, "9", 9, "10", 2, "b", "a"];
    const expected = [2, 9, 10, "10", "9", "a", "b"];
    for (let shift = 0; shift < base.length; shift += 1) {
      const data = [...base.slice(shift), ...base.slice(0, shift)];
      expect(sortedValues(data, false)).toEqual(expected);
    }
  });

  it("[TBL-REV-4] bigints order by value, not by their text", () => {
    expect(sortedValues([10n, 9n, 100n, 2n], false)).toEqual([2n, 9n, 10n, 100n]);
  });
});

describe("pagination after the data changed", () => {
  it("[TBL-REV-5] a page index or size that is NaN does not reach the state", () => {
    const table = createTable({
      features: full,
      data: items([1, 2, 3, 4, 5]),
      columns,
      getRowId: (row) => row.id,
      initialState: { pagination: { pageIndex: 1, pageSize: 2 } },
    });
    table.setPageIndex(Number.NaN);
    expect(table.getState().pagination.pageIndex).toBe(0);
    table.setPageSize(Number.NaN);
    expect(Number.isNaN(table.getState().pagination.pageSize)).toBe(false);
    expect(table.getRowModel().rows.length).toBeGreaterThan(0);
  });

  it("[TBL-REV-6] a page size of Infinity shows every row on one page", () => {
    const table = createTable({
      features: full,
      data: items([1, 2, 3, 4, 5]),
      columns,
      getRowId: (row) => row.id,
      initialState: { pagination: { pageIndex: 0, pageSize: Number.POSITIVE_INFINITY } },
    });
    expect(table.getPageCount()).toBe(1);
    expect(table.getRowModel().rows).toHaveLength(5);
  });

  it("[TBL-R6-1] setPageSize after an Infinity page size with an index past its one page goes to the first page", () => {
    const table = createTable({
      features: full,
      data: items([1, 2, 3, 4, 5]),
      columns,
      getRowId: (row) => row.id,
      initialState: { pagination: { pageIndex: 3, pageSize: Number.POSITIVE_INFINITY } },
    });
    table.setPageSize(2);
    expect(table.getState().pagination).toEqual({ pageIndex: 0, pageSize: 2 });
    expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["0", "1"]);
    table.setPagination({ pageIndex: 2, pageSize: Number.POSITIVE_INFINITY });
    table.setPageSize(Number.POSITIVE_INFINITY);
    expect(table.getState().pagination.pageIndex).toBe(0);
  });
});

describe("faceted range", () => {
  it("[TBL-REV-7] NaN values do not poison the faceted minimum and maximum", () => {
    const table = createTable({
      features: full,
      data: items([4, Number.NaN, 9, 1]),
      columns,
      getRowId: (row) => row.id,
    });
    expect(table.getColumn("value")?.getFacetedMinMaxValues()).toEqual([1, 9]);
  });
});
