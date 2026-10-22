/**
 * Compile-time checks for `createColumnHelper`. Vitest does not run this file; `tsc -p
 * packages/table/tsconfig.json` does, so a wrong overload fails the typecheck.
 */
import { describe, expectTypeOf, it } from "vitest";
import { createColumnHelper } from "../src/column-helper";
import type {
  AccessorFnColumnDef,
  AccessorKeyColumnDef,
  ColumnDef,
  DisplayColumnDef,
} from "../src/types";

interface Row {
  name: string;
  age: number;
}

describe("column helper overloads", () => {
  const helper = createColumnHelper<Row>();

  it("[CHT-01] a key column is typed by the value of that key", () => {
    const column = helper.accessor("age", { header: "Age" });
    expectTypeOf(column).toEqualTypeOf<AccessorKeyColumnDef<Row, number>>();
    // @ts-expect-error "missing" is not a key of the row
    helper.accessor("missing");
  });

  it("[CHT-02] a function column needs an id and takes its value type from the function", () => {
    const column = helper.accessor((row) => row.age * 12, { id: "months" });
    expectTypeOf(column).toEqualTypeOf<AccessorFnColumnDef<Row, number>>();
    // @ts-expect-error a function column without an id is a type error
    helper.accessor((row) => row.name, {});
  });

  it("[CHT-03] a display column needs an id and a group takes its child columns", () => {
    const display = helper.display({ id: "select" });
    expectTypeOf(display).toEqualTypeOf<DisplayColumnDef<Row>>();
    // @ts-expect-error a display column without an id is a type error
    helper.display({});
    const group = helper.group({ header: "Person", columns: [helper.accessor("name")] });
    expectTypeOf(group.columns).toEqualTypeOf<readonly ColumnDef<Row>[]>();
  });
});
