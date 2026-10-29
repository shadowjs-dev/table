/**
 * The `pinning` feature: columns pinned to the left or the right edge, and the sections they render
 * in. Subpath: `@shadow-js/table/pinning`. Without it every column is in the center section and the
 * pinning members throw a `TypeError` that names the feature.
 * @packageDocumentation
 */
import type { TableHost } from "./internal/host";
import type { TableFeature } from "./types";

/**
 * The `pinning` feature: pinned columns stay at an edge while the rest scroll. Install it in
 * `createTable({ features: [pinning] })`. A pinned section lists its columns in the order they were
 * pinned; the center lists the rest in display order.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { pinning } from "@shadow-js/table/pinning";
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
 *   features: [pinning],
 * });
 * table.getColumn("name")?.pin("left");
 * console.log(table.getLeftLeafColumns().map((column) => column.id)); // ["name"]
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const pinning: TableFeature<"pinning"> = {
  name: "pinning",
  install<TData>(host: TableHost<TData>): void {
    const { table, hooks } = host;
    const pinningSlice = host.slice("columnPinning", {});
    const pinnedIds = (side: "left" | "right"): readonly string[] =>
      pinningSlice.current()[side] ?? [];

    hooks.side = (leaf) => {
      if (pinnedIds("left").includes(leaf.id)) return "left";
      if (pinnedIds("right").includes(leaf.id)) return "right";
      return "center";
    };
    hooks.sections = (side) => {
      const visible = hooks.ordered().filter((column) => hooks.visible(column));
      if (side === "center") {
        const pinned = new Set([...pinnedIds("left"), ...pinnedIds("right")]);
        return visible.filter((column) => !pinned.has(column.id));
      }
      return pinnedIds(side).flatMap((id) => visible.filter((column) => column.id === id));
    };

    Object.assign(table, {
      columnPinning: pinningSlice.current,
      setColumnPinning: pinningSlice.set,
      getLeftLeafColumns: () => hooks.sections("left"),
      getCenterLeafColumns: () => hooks.sections("center"),
      getRightLeafColumns: () => hooks.sections("right"),
    });

    for (const column of host.columns) {
      Object.assign(column, {
        getIsPinned: (): false | "left" | "right" => {
          const sides = host.targetsOf(column).map((leaf) => hooks.side(leaf));
          const first = sides[0];
          if (first === undefined || first === "center") return false;
          return sides.every((side) => side === first) ? first : false;
        },
        getCanPin: (): boolean => column.columnDef.enablePinning !== false,
        pin: (position: "left" | "right" | false): void => {
          const current = pinningSlice.current();
          const moved = host.targetsOf(column).map((leaf) => leaf.id);
          // The moved leaves leave both sides, and join the end of the side they are pinned to.
          const without = (side: "left" | "right"): string[] => {
            const rest = (current[side] ?? []).filter((id) => !moved.includes(id));
            return position === side ? [...rest, ...moved] : rest;
          };
          pinningSlice.set({ left: without("left"), right: without("right") });
        },
      });
    }
  },
};
