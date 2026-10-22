/**
 * `@shadow-js/table`: a headless data table over signals. Columns, sorting (multi, custom),
 * filtering (column and global, faceted), pagination, row selection, expansion, grouping with
 * aggregation, column visibility, order, pinning and sizing, controlled and manual state.
 * @packageDocumentation
 */
export { type ColumnHelper, createColumnHelper } from "./column-helper";
export { createTable, useTable } from "./table";
export type * from "./types";
