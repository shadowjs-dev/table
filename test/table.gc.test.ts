/**
 * `@shadow-js/table`: nothing a table keeps outlives it. A dropped table and its row models are
 * collected, and repeated create, read and drop cycles do not grow the heap. Runs with `--expose-gc`.
 */

import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Row {
  id: string;
  name: string;
  age: number;
}

const helper = createColumnHelper<Row>();

/** The garbage collector, exposed by the `gc` project (`--expose-gc`). */
function collectGarbage(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (gc === undefined) throw new Error("run with --expose-gc (the gc project does)");
  gc();
}

/** A table over `size` rows, with every model read: sorting, filtering, grouping and a page. */
function exercise(size: number) {
  const data: Row[] = Array.from({ length: size }, (_, index) => ({
    id: `r${index}`,
    name: `person ${index}`,
    age: index % 50,
  }));
  const table = createTable({
    features: full,
    data,
    columns: [
      helper.accessor("name", { enableGrouping: true }),
      helper.accessor("age", { aggregationFn: "sum" }),
    ],
    getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
  });
  table.getColumn("age")?.toggleSorting(true);
  table.setGlobalFilter("person 1");
  table.setGrouping(["age"]);
  table.getRowModel();
  table.getGroupedRowModel();
  table.getSelectedRowModel();
  return table;
}

/** Makes a table and registers it, in its own frame, so no local of the caller keeps it alive. */
function makeRegistered(registry: FinalizationRegistry<number>, index: number): void {
  registry.register(exercise(2_000), index);
}

/** Lets the finalization callbacks run: a collection, then a turn of the event loop, a few times. */
async function settle(done: () => boolean): Promise<void> {
  for (let round = 0; round < 50 && !done(); round += 1) {
    collectGarbage();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe("table garbage collection", () => {
  it("[TBL-196] dropped tables and their row models are collected", async () => {
    let collected = 0;
    const registry = new FinalizationRegistry<number>(() => {
      collected += 1;
    });
    for (let index = 0; index < 40; index += 1) makeRegistered(registry, index);
    await settle(() => collected >= 40);
    expect(collected).toBe(40);
  });

  it("[TBL-197] repeated create, read and drop cycles do not grow the heap", async () => {
    for (let warm = 0; warm < 3; warm += 1) exercise(2_000);
    collectGarbage();
    const before = process.memoryUsage().heapUsed;
    for (let cycle = 0; cycle < 60; cycle += 1) exercise(2_000);
    collectGarbage();
    await new Promise<void>((resolve) => setImmediate(resolve));
    collectGarbage();
    const grown = process.memoryUsage().heapUsed - before;
    // A table of 2000 rows is well under a megabyte; a leak of one table per cycle would be tens of MB.
    expect(grown, "heap growth in bytes").toBeLessThan(8 * 1024 * 1024);
  });
});
