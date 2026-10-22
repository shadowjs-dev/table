/**
 * `@shadow-js/table`: the row models against a naive reference model (property tests, seed 42). The
 * oracle is a plain recursive walk of the data: it keeps a row when it or a row under it passes the
 * filter, orders the children by the sort (stable), shows a row's children only when its id is in
 * the expansion mask, and slices the visible rows into pages. Any tree, filter, sort, mask and page.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";

/** One generated node: its text and number, and its parent (0 for a root, else the node `parent - 1`). */
interface Spec {
  readonly name: string;
  readonly age: number;
  readonly parent: number;
}

interface Item {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly kids: Item[];
}

/** A tree from specs: node `i` hangs under `parent % (i + 1)`, so every parent comes before its children. */
function buildTree(specs: readonly Spec[]): { roots: Item[]; all: Item[] } {
  const all: Item[] = specs.map((spec, index) => ({
    id: `n${index}`,
    name: spec.name,
    age: spec.age,
    kids: [],
  }));
  const roots: Item[] = [];
  specs.forEach((spec, index) => {
    const node = all[index];
    if (node === undefined) return;
    const parent = spec.parent % (index + 1);
    if (parent === 0) roots.push(node);
    else all[parent - 1]?.kids.push(node);
  });
  return { roots, all };
}

interface Query {
  readonly needle: string;
  readonly direction: "none" | "asc" | "desc";
  /** Which nodes are expanded, by node index (a node without sub rows ignores it). */
  readonly mask: readonly boolean[];
  readonly pageSize: number;
  readonly pageIndex: number;
}

/** The naive model: every list the table must show, computed the slow and plain way. */
function model(roots: readonly Item[], query: Query, indexOf: Map<Item, number>) {
  const kept = new Set<string>();
  const passes = (item: Item): boolean => query.needle === "" || item.name.includes(query.needle);
  const keep = (item: Item): boolean => {
    let anyKid = false;
    for (const kid of item.kids) if (keep(kid)) anyKid = true;
    const ok = anyKid || passes(item);
    if (ok) kept.add(item.id);
    return ok;
  };
  for (const root of roots) keep(root);

  const compare = (a: Item, b: Item): number => {
    if (query.direction === "none") return 0;
    return query.direction === "asc" ? a.age - b.age : b.age - a.age;
  };
  const shownOf = (list: readonly Item[]): Item[] =>
    list.filter((item) => kept.has(item.id)).sort(compare);

  /** Parents before children, sorted at every depth. */
  const preorder = (list: readonly Item[], sorted: boolean, expandedOnly: boolean): string[] => {
    const out: string[] = [];
    const visit = (items: readonly Item[]): void => {
      for (const item of sorted ? shownOf(items) : items.filter((each) => kept.has(each.id))) {
        out.push(item.id);
        const index = indexOf.get(item) ?? -1;
        if (!expandedOnly || query.mask[index] === true) visit(item.kids);
      }
    };
    visit(list);
    return out;
  };

  const everyRow = preorder(roots, true, false);
  const shown = preorder(roots, true, true);
  const pageSize = Math.max(1, query.pageSize);
  const pages = Math.ceil(shown.length / pageSize);
  const pageIndex = Math.min(Math.max(0, query.pageIndex), Math.max(0, pages - 1));
  return {
    keptCount: kept.size,
    filteredOrder: preorder(roots, false, false),
    sortedEveryRow: everyRow,
    visible: shown,
    pages,
    pageIndex,
    page: shown.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
  };
}

const helper = createColumnHelper<Item>();

const specArb: fc.Arbitrary<Spec> = fc.record({
  name: fc.constantFrom("a", "ab", "b", "bc", "c", "cab"),
  age: fc.integer({ min: 0, max: 4 }),
  parent: fc.nat({ max: 1000 }),
});

const queryArb = (nodes: number): fc.Arbitrary<Query> =>
  fc.record({
    needle: fc.constantFrom("", "a", "b", "c"),
    direction: fc.constantFrom("none", "asc", "desc"),
    mask: fc.array(fc.boolean(), { minLength: nodes, maxLength: nodes }),
    pageSize: fc.integer({ min: 1, max: 6 }),
    pageIndex: fc.nat({ max: 5 }),
  });

describe("reference model", () => {
  it("[TBL-180] the row models equal a naive model for any tree, filter, sort, expansion and page (property, seed 42)", () => {
    fc.assert(
      fc.property(
        fc
          .array(specArb, { minLength: 0, maxLength: 16 })
          .chain((specs) => fc.tuple(fc.constant(specs), queryArb(specs.length))),
        ([specs, query]) => {
          const { roots, all } = buildTree(specs);
          const indexOf = new Map(all.map((item, index) => [item, index] as const));
          const expected = model(roots, query, indexOf);
          const expanded: Record<string, boolean> = {};
          all.forEach((item, index) => {
            if (query.mask[index] === true) expanded[item.id] = true;
          });
          const table = createTable({
            features: full,
            data: roots,
            columns: [helper.accessor("name"), helper.accessor("age")],
            getRowId: (row) => row.id,
            getSubRows: (row) => row.kids,
            initialState: { expanded },
          });
          table.setGlobalFilter(query.needle);
          table.setSorting(
            query.direction === "none" ? [] : [{ id: "age", desc: query.direction === "desc" }],
          );
          table.setPageSize(query.pageSize);
          table.setPageIndex(query.pageIndex);

          const ids = (rows: readonly { id: string }[]): string[] => rows.map((row) => row.id);
          expect(table.getRowCount()).toBe(expected.keptCount);
          expect(ids(table.getFilteredRowModel().flatRows)).toEqual(expected.filteredOrder);
          expect(ids(table.getSortedRowModel().flatRows)).toEqual(expected.sortedEveryRow);
          expect(table.getPrePaginationRowModel().rows.length).toBe(expected.visible.length);
          expect(table.getPageCount()).toBe(expected.pages);
          expect(table.getState().pagination.pageIndex).toBe(expected.pageIndex);
          expect(ids(table.getRowModel().rows)).toEqual(expected.page);
        },
      ),
      { seed: 42, numRuns: 300 },
    );
  });
});
