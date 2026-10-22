import type { Accessor } from "@shadow-js/core";
import {
  type AccessorFnColumnDef,
  type AccessorKeyColumnDef,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  createColumnHelper,
  createTable,
  type DisplayColumnDef,
  type GroupColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table,
} from "../src/index";
import type { Equal, Expect } from "./support";

interface Person {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly tags: readonly string[];
}

const helper = createColumnHelper<Person>();

// Column helper: the value type follows the key or the accessor's return type.
const byName = helper.accessor("name", { header: "Name" });
const byAge = helper.accessor("age");
const byComputed = helper.accessor((row) => row.age * 12, { id: "ageMonths" });
const byDisplay = helper.display({ id: "select" });
const byGroup = helper.group({ id: "details", header: "Details", columns: [byName] });

type _ByNameDef = Expect<Equal<typeof byName, AccessorKeyColumnDef<Person, string>>>;
type _ByAgeDef = Expect<Equal<typeof byAge, AccessorKeyColumnDef<Person, number>>>;
type _ByComputedDef = Expect<Equal<typeof byComputed, AccessorFnColumnDef<Person, number>>>;
type _ByDisplayDef = Expect<Equal<typeof byDisplay, DisplayColumnDef<Person>>>;
type _ByGroupDef = Expect<Equal<typeof byGroup, GroupColumnDef<Person>>>;

// A definition is a member of the ColumnDef union.
const columns = [
  byName,
  byAge,
  byComputed,
  byDisplay,
  byGroup,
] satisfies readonly ColumnDef<Person>[];
type _Columns = Expect<
  Equal<
    typeof columns,
    (typeof byName | typeof byAge | typeof byComputed | typeof byDisplay | typeof byGroup)[]
  >
>;

// Table construction carries the row type.
const table = createTable({ data: [] as readonly Person[], columns });
type _TableType = Expect<Equal<typeof table, Table<Person>>>;

const rowModel = table.getRowModel();
type RowOf = (typeof rowModel.rows)[number];
type _RowOf = Expect<Equal<RowOf, Row<Person>>>;
type _Original = Expect<Equal<RowOf["original"], Person>>;

// Cell and row values are typed by the generic argument.
declare const firstRow: Row<Person>;
const ageValue = firstRow.getValue<number>("age");
type _AgeValue = Expect<Equal<typeof ageValue, number>>;
const unknownValue = firstRow.getValue("name");
type _UnknownValue = Expect<Equal<typeof unknownValue, unknown>>;

// Column lookup can miss, so the result includes undefined.
const nameColumn = table.getColumn("name");
type _NameColumn = Expect<Equal<typeof nameColumn, Column<Person> | undefined>>;

// Slice accessors read the state type of their slice.
type _Sorting = Expect<Equal<typeof table.sorting, Accessor<SortingState>>>;
type _Filters = Expect<Equal<typeof table.columnFilters, Accessor<ColumnFiltersState>>>;
type _Selection = Expect<Equal<typeof table.rowSelection, Accessor<RowSelectionState>>>;

// Setters take a value or an updater over the previous state.
table.setSorting([{ id: "name", desc: false }]);
table.setSorting((previous) => [...previous, { id: "age", desc: true }]);
table.setPageIndex(1);
table.setPageSize(25);
table.setGlobalFilter("ada");
table.toggleAllRowsSelected(true);

const count = table.getRowCount();
type _Count = Expect<Equal<typeof count, number>>;
const canNext = table.getCanNextPage();
type _CanNext = Expect<Equal<typeof canNext, boolean>>;
const visibleLeaves = table.getVisibleLeafColumns();
type _Visible = Expect<Equal<typeof visibleLeaves, readonly Column<Person>[]>>;

// Row by id returns undefined for an unknown id.
const byId = table.getRow("0");
type _ById = Expect<Equal<typeof byId, Row<Person> | undefined>>;

// Negative cases: unknown keys, wrong value types and missing ids are rejected.
// @ts-expect-error "nickname" is not a key of Person
helper.accessor("nickname");
// @ts-expect-error a computed column needs an id
helper.accessor((row: Person) => row.age);
// @ts-expect-error the page index is a number
table.setPageIndex("1");
// @ts-expect-error the data must match the row type
createTable({ data: [{ id: 1 }], columns: [byName] });
// @ts-expect-error the sorting entry needs a column id
table.setSorting([{ desc: true }]);
// @ts-expect-error the row id lookup takes a string
table.getRow(0);
