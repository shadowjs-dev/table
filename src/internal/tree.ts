/**
 * Tree helpers over row models: iterative walks (the depth of a tree is not a limit) and the view of
 * a row model, one list of roots with the children of each row.
 * @packageDocumentation
 */
import type { Row, RowModel } from "../types";

/** The children of a row in one row model. */
export type ChildrenOf<TData> = (row: Row<TData>) => readonly Row<TData>[];

/** One row model seen as a tree: its roots, and the children of each row in that model. */
export interface View<TData> {
  readonly roots: readonly Row<TData>[];
  readonly childrenOf: ChildrenOf<TData>;
}

/** The children of a row that has none. Shared, so a leaf allocates nothing. */
export const NO_ROWS: readonly never[] = [];

/** The children of a row in the data: every sub row, whatever the filters and the sorting. */
export function subRowsOf<TData>(row: Row<TData>): readonly Row<TData>[] {
  return row.subRows;
}

/** Pushes a list onto a stack in reverse, so the first item is popped first. */
export function pushReversed<TData>(stack: Row<TData>[], list: readonly Row<TData>[]): void {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const item = list[index];
    if (item !== undefined) stack.push(item);
  }
}

/**
 * Calls `visit` for every row of a tree, parents before children, in the order the children are
 * listed. Iterative, so the depth of the tree is not a limit.
 */
export function walk<TData>(
  roots: readonly Row<TData>[],
  childrenOf: ChildrenOf<TData>,
  visit: (row: Row<TData>) => void,
): void {
  const stack: Row<TData>[] = [];
  pushReversed(stack, roots);
  for (let row = stack.pop(); row !== undefined; row = stack.pop()) {
    visit(row);
    pushReversed(stack, childrenOf(row));
  }
}

/** The leaf rows under a row in a tree (the row itself when it has no children), in order. */
export function leavesOf<TData>(row: Row<TData>, childrenOf: ChildrenOf<TData>): Row<TData>[] {
  const out: Row<TData>[] = [];
  const stack: Row<TData>[] = [row];
  for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
    const children = childrenOf(current);
    if (children.length === 0) out.push(current);
    else pushReversed(stack, children);
  }
  return out;
}

/** A row model over a tree view: its rows are the roots, its flat rows every row of the tree, once. */
export function treeModel<TData>(view: View<TData>): RowModel<TData> {
  const flat: Row<TData>[] = [];
  const rowsById = new Map<string, Row<TData>>();
  walk(view.roots, view.childrenOf, (row) => {
    flat.push(row);
    rowsById.set(row.id, row);
  });
  return { rows: view.roots, flatRows: flat, rowsById };
}
