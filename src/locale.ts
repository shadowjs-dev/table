/**
 * The `locale` feature: text sorts and text filters that follow the language of the data. Subpath:
 * `@shadow-js/table/locale`. Without it, text is folded with `toLowerCase` and ordered by character code, which puts
 * `ä` after `z`, the hamza forms of alef before plain alef, and `item 10` before `item 2`.
 * @packageDocumentation
 */
import type { TableHost } from "./internal/host";
import type { TableFeature } from "./types";

/**
 * The `locale` feature. Install it with the `locale` option: `createTable({ features: [locale], locale: "de" })`. The
 * built-in sorts `alphanumeric` and `text` (and the default for text columns) order text with an `Intl.Collator` of the
 * language, numbers inside text by value and accents significant, case ignored; `basic` orders with the same language but
 * keeps case significant. The built-in text filters (`includesString`, `auto` for text, and the global filter) fold case
 * by the language's rules. Custom sorting and filter functions are not touched. The collators are made when the table is
 * created, so a malformed tag fails there.
 *
 * @example
 * ```ts
 * import { createColumnHelper, createTable } from "@shadow-js/table";
 * import { locale } from "@shadow-js/table/locale";
 *
 * const helper = createColumnHelper<{ id: string; name: string }>();
 * const table = createTable({
 *   data: [
 *     { id: "1", name: "item 10" },
 *     { id: "2", name: "item 2" },
 *   ],
 *   columns: [helper.accessor("name")],
 *   getRowId: (row) => row.id,
 *   features: [locale],
 *   locale: "en",
 *   initialState: { sorting: [{ id: "name", desc: false }] },
 * });
 * console.log(table.getRowModel().rows.map((row) => row.original.name)); // ["item 2", "item 10"]
 * ```
 * @see {@link TableFeature}
 * @since 1.0.0
 */
export const locale: TableFeature<"locale"> = {
  name: "locale",
  install<TData>(host: TableHost<TData>): void {
    const tag = host.options.locale;
    if (tag === undefined) {
      throw new TypeError(
        __DEV__
          ? '[shadow-table] the locale feature needs the locale option: createTable({ features: [locale], locale: "de" }).'
          : "TABLE_LOCALE",
      );
    }
    const languages = typeof tag === "string" ? tag : [...tag];
    const text = new Intl.Collator(languages, { numeric: true, sensitivity: "accent" });
    const exact = new Intl.Collator(languages, { sensitivity: "variant" });
    host.hooks.collate = (basic) => (basic ? exact.compare : text.compare);
    host.hooks.fold = (value) => value.toLocaleLowerCase(languages);
  },
};
