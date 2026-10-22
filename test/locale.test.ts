/**
 * `locale` option of `@shadow-js/table`: text sorts and text filters follow the language of the data. Without the option
 * the table keeps its locale-independent behavior (case-folded, character-code order); with it, `Intl.Collator` orders the
 * text and the filter folds case with the locale's rules.
 */

import { describe, expect, it } from "vitest";
import { full } from "../src/full";
import { createColumnHelper, createTable } from "../src/index";
import { locale } from "../src/locale";

interface Row {
  id: string;
  name: string;
}

const helper = createColumnHelper<Row>();

const rows = (names: readonly string[]): Row[] =>
  names.map((name, index) => ({ id: String(index), name }));

function sorted(
  names: readonly string[],
  options: { locale?: string; sortingFn?: "basic" | "alphanumeric" | "text"; desc?: boolean },
): string[] {
  const table = createTable({
    features: options.locale === undefined ? full : [...full, locale],
    data: rows(names),
    columns: [
      helper.accessor(
        "name",
        options.sortingFn === undefined ? {} : { sortingFn: options.sortingFn },
      ),
    ],
    getRowId: (row) => row.id,
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    initialState: { sorting: [{ id: "name", desc: options.desc === true }] },
  });
  return table.getRowModel().rows.map((row) => row.original.name);
}

describe("text sorting with a locale", () => {
  it("[TBL-LOC-01] accented letters sort with their base letter in German and French, not after z", () => {
    const names = ["zebra", "ärger", "apfel", "öl", "ofen"];
    expect(sorted(names, {})).toEqual(["apfel", "ofen", "zebra", "ärger", "öl"]);
    expect(sorted(names, { locale: "de" })).toEqual(["apfel", "ärger", "ofen", "öl", "zebra"]);
    expect(sorted(["zèbre", "été", "ete", "eau"], { locale: "fr" })).toEqual([
      "eau",
      "ete",
      "été",
      "zèbre",
    ]);
  });

  it("[TBL-LOC-02] Arabic names sort by their letters, and the hamza forms of alef sort with alef", () => {
    const names = ["بدر", "أحمد", "ابراهيم", "سمير"];
    // By character code the hamza form (U+0623) comes before plain alef (U+0627), so Ahmad would precede Ibrahim's "ab".
    expect(sorted(names, {})).toEqual(["أحمد", "ابراهيم", "بدر", "سمير"]);
    expect(sorted(names, { locale: "ar" })).toEqual(["ابراهيم", "أحمد", "بدر", "سمير"]);
  });

  it("[TBL-LOC-03] numbers inside text sort by value: item 2 comes before item 10, Arabic-Indic digits too", () => {
    const names = ["item 10", "item 2", "item 1"];
    expect(sorted(names, {})).toEqual(["item 1", "item 10", "item 2"]);
    expect(sorted(names, { locale: "en" })).toEqual(["item 1", "item 2", "item 10"]);
    expect(sorted(["عنصر ١٠", "عنصر ٢", "عنصر ١"], { locale: "ar" })).toEqual([
      "عنصر ١",
      "عنصر ٢",
      "عنصر ١٠",
    ]);
  });

  it("[TBL-LOC-04] case is still ignored by default sorts, so equal text keeps its data order, and descending reverses", () => {
    expect(sorted(["b", "B", "a"], { locale: "en" })).toEqual(["a", "b", "B"]);
    expect(sorted(["a", "c", "b"], { locale: "en", desc: true })).toEqual(["c", "b", "a"]);
  });

  it("[TBL-LOC-05] the basic sort stays case-sensitive but follows the locale's order of letters", () => {
    expect(sorted(["b", "B", "a", "ä"], { sortingFn: "basic" })).toEqual(["B", "a", "b", "ä"]);
    expect(sorted(["b", "B", "a", "ä"], { locale: "de", sortingFn: "basic" })).toEqual([
      "a",
      "ä",
      "b",
      "B",
    ]);
  });

  it("[TBL-LOC-06] a locale list is accepted, and a malformed locale fails when the table is created", () => {
    const table = createTable({
      features: [...full, locale],
      data: rows(["b", "a"]),
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
      locale: ["xx-unknown", "en"],
      initialState: { sorting: [{ id: "name", desc: false }] },
    });
    expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(["a", "b"]);
    expect(() =>
      createTable({
        features: [...full, locale],
        data: rows(["a"]),
        columns: [helper.accessor("name")],
        locale: "not a locale!",
      }),
    ).toThrow(RangeError);
  });
});

describe("the locale feature", () => {
  it("[TBL-LOC-10] the option without the feature, and the feature without the option, are refused with the fix", () => {
    expect(() =>
      createTable({
        features: full,
        data: rows(["a"]),
        columns: [helper.accessor("name")],
        locale: "de",
      }),
    ).toThrow(/locale needs the locale feature.*@shadow-js\/table\/locale/);
    expect(() =>
      createTable({ features: [locale], data: rows(["a"]), columns: [helper.accessor("name")] }),
    ).toThrow(/needs the locale option/);
  });
});

describe("text filtering with a locale", () => {
  function filtered(names: readonly string[], text: string, tag?: string): string[] {
    const table = createTable({
      features: tag === undefined ? full : [...full, locale],
      data: rows(names),
      columns: [helper.accessor("name", { filterFn: "includesString" })],
      getRowId: (row) => row.id,
      ...(tag === undefined ? {} : { locale: tag }),
      initialState: { columnFilters: [{ id: "name", value: text }] },
    });
    return table.getRowModel().rows.map((row) => row.original.name);
  }

  it("[TBL-LOC-07] Turkish folds dotted and dotless i by its own rules", () => {
    const names = ["Işık", "ışık", "Isik", "iPhone"];
    // Without a locale "I" folds to a dotted "i", so only the ASCII spelling matches "isik".
    expect(filtered(names, "isik")).toEqual(["Isik"]);
    // In Turkish "I" folds to the dotless "ı", so both capitalizations of the dotless spelling match.
    expect(filtered(names, "ışık", "tr")).toEqual(["Işık", "ışık"]);
  });

  it("[TBL-LOC-08] the global filter uses the locale too", () => {
    const table = createTable({
      features: [...full, locale],
      data: rows(["Işık", "other"]),
      columns: [helper.accessor("name")],
      getRowId: (row) => row.id,
      locale: "tr",
      initialState: { globalFilter: "ışık" },
    });
    expect(table.getRowModel().rows.map((row) => row.original.name)).toEqual(["Işık"]);
  });

  it("[TBL-LOC-09] without a locale a filter behaves as before", () => {
    expect(filtered(["Ada", "grace"], "AD")).toEqual(["Ada"]);
  });
});
