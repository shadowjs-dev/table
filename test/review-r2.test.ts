/**
 * Second review round: the per-row flag cells are pruned when rows leave the data, the column and
 * grouping builders do not recurse over user-controlled depth, and the pager stays coherent when
 * the data shrinks under a page.
 */
import { createRoot, flushSync, useEffect, useSignal } from "@shadow-js/core";
import { describe, expect, it, vi } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";
import type { KeyedFlags } from "../src/internal/keyed";

const made = vi.hoisted(() => [] as unknown[]);
vi.mock("../src/internal/keyed", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/internal/keyed")>();
  return {
    ...original,
    keyedFlags: (...args: Parameters<typeof original.keyedFlags>) => {
      const flags = original.keyedFlags(...args);
      made.push(flags);
      return flags;
    },
  };
});

interface Item {
  id: string;
  name: string;
  group: string;
}
const helper = createColumnHelper<Item>();
const columns = [helper.accessor("name", { header: "Name" })];

function rowsOf(generation: number, count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `g${generation}-${index}`,
    name: `n${index}`,
    group: "a",
  }));
}

describe("flag cells follow the data", () => {
  it("[TBL-R2-8] churning row ids keeps the number of selection and expansion cells bounded", () => {
    const [data, setData] = useSignal<Item[]>(rowsOf(0, 100));
    const before = made.length;
    const table = createTable({
      features: full,
      data,
      columns,
      getRowId: (row) => row.id,
    });
    for (let generation = 1; generation <= 60; generation += 1) {
      setData(rowsOf(generation, 100));
      for (const row of table.getCoreRowModel().rows) {
        row.getIsSelected();
        row.getIsExpanded();
      }
    }
    const flags = made.slice(before) as KeyedFlags[];
    expect(flags.length).toBeGreaterThanOrEqual(2);
    for (const each of flags) expect(each.size).toBeLessThan(1024);
  });

  it("[TBL-R2-8] a row that is still in the data keeps reacting after the sweeps", () => {
    const [data, setData] = useSignal<Item[]>(rowsOf(0, 100));
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    const seen: boolean[] = [];
    const watched = "g0-5";
    createRoot(() => {
      useEffect(() => {
        seen.push(table.getRow(watched)?.getIsSelected() === true);
      });
    });
    flushSync();
    // The watched row stays in the data while many others come and go around it.
    for (let generation = 1; generation <= 40; generation += 1) {
      setData([...rowsOf(0, 100), ...rowsOf(generation, 100)]);
      for (const row of table.getCoreRowModel().rows) row.getIsSelected();
    }
    flushSync();
    seen.length = 0;
    table.getRow(watched)?.toggleSelected(true);
    flushSync();
    expect(seen).toEqual([true]);
    expect(table.getRow(watched)?.getIsSelected()).toBe(true);
  });

  it("[TBL-R2-8] selected state of a row that left the data is not lost when it returns", () => {
    const [data, setData] = useSignal<Item[]>(rowsOf(0, 10));
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    table.getRow("g0-3")?.toggleSelected(true);
    setData(rowsOf(1, 2000));
    for (const row of table.getCoreRowModel().rows) row.getIsSelected();
    setData(rowsOf(0, 10));
    expect(table.getRow("g0-3")?.getIsSelected()).toBe(true);
    expect(table.getRow("g0-4")?.getIsSelected()).toBe(false);
  });
});

describe("flag cells that something watches", () => {
  it("[TBL-R5-6] an observer of a row that left the data and came back still hears of its selection", () => {
    const [data, setData] = useSignal<Item[]>(rowsOf(0, 10));
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    const watchedRow = table.getRow("g0-3");
    if (watchedRow === undefined) throw new Error("the row is missing");
    const seen: boolean[] = [];
    const dispose = createRoot((disposeRoot) => {
      useEffect(() => {
        seen.push(watchedRow.getIsSelected());
      });
      return disposeRoot;
    });
    flushSync();
    expect(seen).toEqual([false]);
    // The row leaves the data while thousands of other ids come and go, so the sweeps run.
    for (let generation = 1; generation <= 3; generation += 1) {
      setData(rowsOf(generation, 2000));
      for (const row of table.getCoreRowModel().rows) row.getIsSelected();
    }
    setData(rowsOf(0, 10));
    flushSync();
    seen.length = 0;
    table.getRow("g0-3")?.toggleSelected(true);
    flushSync();
    expect(seen).toEqual([true]);
    dispose();
  });

  it("[TBL-R5-6] once the observer is disposed the cell is swept again: the cells stay bounded", () => {
    const [data, setData] = useSignal<Item[]>(rowsOf(0, 10));
    const before = made.length;
    const table = createTable({ features: full, data, columns, getRowId: (row) => row.id });
    const watchedRow = table.getRow("g0-3");
    if (watchedRow === undefined) throw new Error("the row is missing");
    const dispose = createRoot((disposeRoot) => {
      useEffect(() => {
        watchedRow.getIsSelected();
      });
      return disposeRoot;
    });
    flushSync();
    dispose();
    for (let generation = 1; generation <= 20; generation += 1) {
      setData(rowsOf(generation, 500));
      for (const row of table.getCoreRowModel().rows) row.getIsSelected();
    }
    const flags = made.slice(before) as KeyedFlags[];
    for (const each of flags) expect(each.size).toBeLessThan(1024);
  });
});

describe("no recursion over user depth", () => {
  it("[TBL-R2-9] a column group nested 30,000 deep is built", () => {
    const depth = 30_000;
    let nested: Record<string, unknown> = { id: "leaf", accessorKey: "name", header: "Leaf" };
    for (let level = 0; level < depth; level += 1)
      nested = { id: `group${level}`, header: `G${level}`, columns: [nested] };
    const table = createTable<Item>({
      features: full,
      data: rowsOf(0, 1),
      columns: [nested as never],
    });
    expect(table.getAllColumns()).toHaveLength(depth + 1);
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual(["leaf"]);
    expect(table.getColumn("group0")?.depth).toBe(depth - 1);
  });

  it("[TBL-R2-9] grouping by 20,000 columns at once builds the nested groups", () => {
    const levels = 20_000;
    const ids = Array.from({ length: levels }, (_, index) => `c${index}`);
    const defs = ids.map((id) => ({
      id,
      accessorFn: () => "same",
      header: id,
      enableGrouping: true,
    }));
    const table = createTable<Item>({
      features: full,
      data: rowsOf(0, 1),
      columns: defs as never,
      getRowId: (row) => row.id,
      initialState: { grouping: ids },
    });
    const model = table.getGroupedRowModel();
    expect(model.rows).toHaveLength(1);
    expect(model.flatRows.length).toBe(levels + 1);
    expect(model.rows[0]?.id).toBe("c0:same");
  });

  it("[TBL-R2-9] group ids still avoid a row id and each other, in the order the groups are made", () => {
    const table = createTable<Item>({
      features: full,
      data: [
        { id: "group:x", name: "1", group: "x" },
        { id: "b", name: "2", group: "y" },
        { id: "c", name: "3", group: "x" },
      ],
      columns: [helper.accessor("group", { header: "G", enableGrouping: true }), ...columns],
      getRowId: (row) => row.id,
      initialState: { grouping: ["group", "name"] },
    });
    const ids = table.getGroupedRowModel().flatRows.map((row) => row.id);
    expect(ids).toEqual([
      "group:x#2",
      "group:x#2>name:1",
      "group:x",
      "group:x#2>name:3",
      "c",
      "group:y",
      "group:y>name:2",
      "b",
    ]);
  });
});

describe("a page that no longer exists", () => {
  it("[TBL-R2-10] after the data shrinks the pager reports one coherent picture and can go back", () => {
    const [data, setData] = useSignal<Item[]>(rowsOf(0, 100));
    const table = createTable({
      features: full,
      data,
      columns,
      getRowId: (row) => row.id,
      initialState: { pagination: { pageIndex: 7, pageSize: 10 } },
    });
    expect(table.getCanNextPage()).toBe(true);
    setData(rowsOf(1, 25));
    expect(table.getPageCount()).toBe(3);
    expect(table.getRowModel().rows).toHaveLength(0);
    expect(table.getCanNextPage()).toBe(false);
    expect(table.getCanPreviousPage()).toBe(true);
    table.previousPage();
    expect(table.getState().pagination.pageIndex).toBe(2);
    expect(table.getRowModel().rows).toHaveLength(5);
    expect(table.getCanNextPage()).toBe(false);
    setData([]);
    expect(table.getPageCount()).toBe(0);
    expect(table.getCanNextPage()).toBe(false);
    table.lastPage();
    expect(table.getState().pagination.pageIndex).toBe(0);
    expect(table.getCanPreviousPage()).toBe(false);
  });
});
