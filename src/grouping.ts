/**
 * The `grouping` feature: rows grouped by one or more columns. Each group is a row whose cells hold
 * the aggregate of its leaves (`aggregationFn` in the column definition). Subpath:
 * `@shadow-js/table/grouping`. Without it a table has no grouping: `setGrouping`,
 * `getGroupedRowModel` and the column grouping methods throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import { aggregate } from "./internal/functions";
import type { TableHost } from "./internal/host";
import { leavesOf, treeModel, type View } from "./internal/tree";
import type { Row, TableFeature } from "./types";

/**
 * The `grouping` feature: rows grouped by the columns in the grouping state, with the aggregate of
 * each group in its cells. Install it in `createTable({ features: [grouping] })`.
 *
 * Grouping by a column needs `enableGrouping: true` in its definition. A group's cell reads the
 * `aggregationFn` of its column, or the first leaf's value when there is none. A grouping change
 * returns the table to its first page.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { grouping } from "@shadow-js/table/grouping";
 *
 * interface Sale {
 *   region: string;
 *   amount: number;
 * }
 * const helper = createColumnHelper<Sale>();
 * const table = createTable({
 *   data: [{ region: "north", amount: 2 }, { region: "north", amount: 3 }],
 *   columns: [
 *     helper.accessor("region", { header: "Region", enableGrouping: true }),
 *     helper.accessor("amount", { header: "Amount", aggregationFn: "sum" }),
 *   ],
 *   features: [grouping],
 * });
 * table.setGrouping(["region"]);
 * console.log(table.getRowModel().rows[0]?.getValue("amount")); // 5
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const grouping: TableFeature<"grouping"> = {
  name: "grouping",
  install<TData>(host: TableHost<TData>): void {
    const { table, options, hooks } = host;
    const slice = host.slice("grouping", [], host.resetPage);
    const groupedModel = host.model(() => treeModel(host.grouped()), "grouped");
    Object.assign(table, {
      grouping: slice.current,
      setGrouping: slice.set,
      getGroupedRowModel: () => groupedModel(),
    });

    hooks.group = (filtered: View<TData>): View<TData> => {
      const columnIds = slice.current();
      if (columnIds.length === 0 || options.manualGrouping === true) return filtered;
      // Group ids must not collide with each other or with a row id, since both key the state.
      const taken = new Set(host.core().rowsById.keys());
      const idFor = (base: string): string => {
        let candidate = base;
        for (let suffix = 2; taken.has(candidate); suffix += 1) candidate = `${base}#${suffix}`;
        taken.add(candidate);
        return candidate;
      };
      const build = (
        members: readonly Row<TData>[],
        level: number,
        prefix: string,
      ): Row<TData>[] => {
        const columnId = columnIds[level];
        if (columnId === undefined) return [...members];
        const buckets = new Map<unknown, Row<TData>[]>();
        for (const member of members) {
          const value = member.getValue(columnId);
          const bucket = buckets.get(value);
          if (bucket === undefined) buckets.set(value, [member]);
          else bucket.push(member);
        }
        const groups: Row<TData>[] = [];
        for (const [value, bucket] of buckets) {
          const first = bucket[0];
          if (first === undefined) continue;
          const id = idFor(`${prefix}${columnId}:${String(value)}`);
          groups.push(
            host.makeRow({
              id,
              index: first.index,
              depth: level,
              original: first.original,
              parent: undefined,
              subRows: build(bucket, level + 1, `${id}>`),
              isGrouped: true,
              groupingColumnId: columnId,
              groupingValue: value,
            }),
          );
        }
        return groups;
      };
      return {
        roots: build(filtered.roots, 0, ""),
        childrenOf: (row) => (row.isGrouped ? row.subRows : filtered.childrenOf(row)),
      };
    };

    hooks.groupValue = (row: Row<TData>, columnId: string): unknown => {
      if (row.groupingColumnId === columnId) return row.groupingValue;
      const leaves = leavesOf(row, host.grouped().childrenOf);
      const aggregation = host.columnOf(columnId)?.columnDef.aggregationFn;
      if (aggregation === undefined) return leaves[0]?.getValue(columnId);
      return aggregate(
        leaves.map((leaf) => leaf.getValue(columnId)),
        aggregation,
      );
    };

    for (const column of host.columns) {
      Object.assign(column, {
        getCanGroup: (): boolean =>
          column.columnDef.enableGrouping === true && column.columns.length === 0,
        getIsGrouped: (): boolean => slice.current().includes(column.id),
        toggleGrouping: (): void => {
          const current = slice.current();
          slice.set(
            current.includes(column.id)
              ? current.filter((id) => id !== column.id)
              : [...current, column.id],
          );
        },
      });
    }
  },
};
