/**
 * The full preset of `@shadow-js/table`: `createTable` and every opt-in feature in one import.
 * Subpath: `@shadow-js/table/full`. Use it for a table that needs several of the features; a table
 * that needs only some of them lists those (`features: [grouping, pinning]`), so it carries no code
 * for the others. The root entry `@shadow-js/table` imports none of the features.
 * @packageDocumentation
 */
import { expanding } from "./expanding";
import { faceting } from "./faceting";
import { grouping } from "./grouping";
import { layout } from "./layout";
import { ordering } from "./ordering";
import { pinning } from "./pinning";
import { sizing } from "./sizing";
import type { TableFeature } from "./types";
import { visibility } from "./visibility";

export { createTable, useTable } from "./table";
export type { TableFeature, TableFeatureName } from "./types";

/**
 * Every opt-in feature as one list: `grouping`, `expanding`, `pinning`, `sizing`, `layout`,
 * `faceting`, `visibility` and `ordering`. `createTable({ features: full })` gives the table all of
 * them. The list is frozen at runtime and typed as a readonly tuple of the eight feature objects. The `locale` feature is
 * not in it: it needs the `locale` option, so a table that sorts by a language lists it next to `full`
 * (`features: [...full, locale]`).
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable, full } from "@shadow-js/table/full";
 *
 * interface Row {
 *   id: string;
 *   name: string;
 * }
 * const helper = createColumnHelper<Row>();
 * const table = createTable({
 *   data: [{ id: "1", name: "Ada" }],
 *   columns: [helper.accessor("name", { header: "Name" })],
 *   getRowId: (row) => row.id,
 *   features: full,
 * });
 * console.log(table.getRowModel().rows.length); // 1
 * ```
 * @since 1.0.0
 */
export const full: readonly [
  TableFeature<"grouping">,
  TableFeature<"expanding">,
  TableFeature<"pinning">,
  TableFeature<"sizing">,
  TableFeature<"layout">,
  TableFeature<"faceting">,
  TableFeature<"visibility">,
  TableFeature<"ordering">,
] = Object.freeze([grouping, expanding, pinning, sizing, layout, faceting, visibility, ordering]);
