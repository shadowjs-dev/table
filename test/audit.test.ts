/** Findings of the router-data audit: each test asserts what the code does. */
import { describe, expect, it, vi } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

interface Item {
  readonly id: string;
  readonly name: string;
}
const helper = createColumnHelper<Item>();

describe("row ids", () => {
  it("[TBL-A1] a getRowId that repeats an id is reported once in development", () => {
    const warn = vi.mocked(console.warn);
    const table = createTable<Item>({
      features: full,
      data: [
        { id: "x", name: "apple" },
        { id: "x", name: "banana" },
        { id: "y", name: "cherry" },
      ],
      columns: [helper.accessor("name", {})],
      getRowId: (row) => row.id,
    });
    expect(table.getRowModel().rows).toHaveLength(3);
    expect(table.getRowModel().rows).toHaveLength(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('"x"');
    warn.mockClear();
  });

  it("[TBL-A2] unique ids are not reported", () => {
    const warn = vi.mocked(console.warn);
    const table = createTable<Item>({
      features: full,
      data: [
        { id: "x", name: "apple" },
        { id: "y", name: "banana" },
      ],
      columns: [helper.accessor("name", {})],
      getRowId: (row) => row.id,
    });
    expect(table.getRowModel().rows).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
  });
});
