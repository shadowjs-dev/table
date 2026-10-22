/**
 * `@shadow-js/table`: performance at 100k rows. Each budget times a change together with the read
 * that pays for it (the row models are computed on read). The budgets are generous on purpose: a
 * loaded CI machine is several times slower than a quiet laptop, and a budget that is too tight
 * flakes. They catch an accidental quadratic step, not a few percent of drift.
 */

import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Row {
  id: string;
  name: string;
  age: number;
  team: string;
}

const ROWS = 100_000;
const TEAMS = [
  "core",
  "navy",
  "apollo",
  "gemini",
  "mercury",
  "vostok",
  "luna",
  "soyuz",
  "atlas",
  "titan",
];

/** A deterministic data set: the same rows on every run, no `Math.random`. */
const data: Row[] = Array.from({ length: ROWS }, (_, index) => ({
  id: `r${index}`,
  name: `person ${(index * 7919) % ROWS}`,
  age: (index * 104729) % 90,
  team: TEAMS[index % TEAMS.length] ?? "core",
}));

const helper = createColumnHelper<Row>();
const columns = [
  helper.accessor("name", { header: "Name" }),
  helper.accessor("age", { header: "Age", aggregationFn: "sum" }),
  helper.accessor("team", { header: "Team", enableGrouping: true }),
];

/** Milliseconds one call takes. */
function time(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe("performance at 100k rows", () => {
  it("[TBL-190] building the core model and reading the first page stay within budget", () => {
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    const elapsed = time(() => {
      table.getCoreRowModel();
      table.getRowModel();
    });
    expect(table.getRowModel().rows).toHaveLength(10);
    expect(table.getRowCount()).toBe(ROWS);
    expect(elapsed, "core model and first page").toBeLessThan(1_500);
  });

  it("[TBL-191] sorting by a column and reading the sorted page takes one pass and a sort", () => {
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    table.getCoreRowModel();
    const elapsed = time(() => {
      table.getColumn("age")?.toggleSorting(true);
      table.getRowModel();
    });
    expect(table.getRowModel().rows[0]?.original.age).toBe(89);
    expect(elapsed, "sort and page").toBeLessThan(1_500);
  });

  it("[TBL-192] a global filter over every row takes one pass", () => {
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    table.getCoreRowModel();
    const elapsed = time(() => {
      table.setGlobalFilter("person 9");
      table.getRowCount();
    });
    expect(table.getRowCount()).toBeGreaterThan(0);
    expect(elapsed, "global filter").toBeLessThan(1_500);
  });

  it("[TBL-193] grouping by a column with ten values makes ten groups in one pass", () => {
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    table.getCoreRowModel();
    const elapsed = time(() => {
      table.setGrouping(["team"]);
      table.getGroupedRowModel();
    });
    expect(table.getGroupedRowModel().rows).toHaveLength(TEAMS.length);
    expect(elapsed, "grouping").toBeLessThan(1_500);
  });

  it("[TBL-194] a read of a memoized model with no change costs next to nothing", () => {
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    table.getRowModel();
    const elapsed = time(() => {
      for (let index = 0; index < 1_000; index += 1) table.getRowModel();
    });
    expect(elapsed, "1000 reads").toBeLessThan(100);
  });

  it("[TBL-195] selecting one row of 100k is one flag change, not a pass over the rows", () => {
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    table.getCoreRowModel();
    const elapsed = time(() => {
      table.getRow("r500")?.toggleSelected(true);
    });
    expect(table.getRow("r500")?.getIsSelected()).toBe(true);
    expect(elapsed, "toggle one row").toBeLessThan(300);
  });
});
