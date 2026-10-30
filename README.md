<p align="center"><img src="https://raw.githubusercontent.com/shadowjs-dev/table/main/.github/banner.png" alt="ShadowJS" width="100%"></p>

# @shadow-js/table

[![npm](https://img.shields.io/npm/v/@shadow-js/table.svg)](https://www.npmjs.com/package/@shadow-js/table)
[![CI](https://github.com/shadowjs-dev/table/actions/workflows/ci.yml/badge.svg)](https://github.com/shadowjs-dev/table/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/shadowjs-dev/table/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)](https://www.typescriptlang.org/)

Headless data table for ShadowJS 1.0.0, built on signals. The core has columns, sorting (multi and custom),
column and global filtering, pagination, row selection, controlled state and manual (server-side) modes.
Grouping with aggregation, sub rows, pinning, sizing, header rows, faceting, visibility and column order are
opt-in features, each a subpath, so a table ships only what it uses. It renders no markup: render the rows
with your own components, or copy the `data-table` item of `@shadow-js/ui`.

## Install

```sh
npm install @shadow-js/table
```

## Quick start

```ts title="table.test.ts" test
import { createColumnHelper, createTable } from "@shadow-js/table";
import { expect, it } from "vitest";

interface Person {
  id: string;
  name: string;
  age: number;
}

const helper = createColumnHelper<Person>();
const people: Person[] = [
  { id: "1", name: "Ada", age: 36 },
  { id: "2", name: "Grace", age: 85 },
];

it("sorts and reads rows", () => {
  const table = createTable({
    data: people,
    columns: [helper.accessor("name", { header: "Name" }), helper.accessor("age", { header: "Age" })],
    getRowId: (row) => row.id,
  });
  table.getColumn("age")?.toggleSorting(true);
  expect(table.getRowModel().rows.map((row) => row.getValue("name"))).toEqual(["Grace", "Ada"]);
});
```

## API

- `createTable(options)`: the table. Its slice accessors (`sorting()`, `rowSelection()`, ...) and actions (`setSorting`, `nextPage`, ...). Pass the features it uses in `features`.
- Features: `grouping` (`@shadow-js/table/grouping`), `expanding`, `pinning`, `sizing`, `layout` (header rows, `getStart`), `faceting`, `visibility` and `ordering`; `full` (`@shadow-js/table/full`) lists all of them. `locale` (`@shadow-js/table/locale`) is separate because it needs the `locale` option: text sorts and filters follow the language of the data (`Intl.Collator`, numbers inside text by value, Turkish case rules). A member of a feature the table lacks throws a `TypeError` that names the feature and its import.
- `createColumnHelper<TData>()`: typed `accessor`, `display` and `group` column definitions.
- The row models: `getRowModel()`, `getCoreRowModel()`, `getFilteredRowModel()`, `getGroupedRowModel()`, `getSortedRowModel()`, `getExpandedRowModel()`, `getSelectedRowModel()`.
- Types: `ColumnDef`, `Column`, `Row`, `Cell`, `Header`, `TableState`, `TableOptions`.

## Links

- Reference: `/reference/table/` on the documentation site.

## Production error codes

A production build keeps a short code instead of the development explanation, so message text never reaches user bundles. Search this table for the code. In the explanation, `…` stands for a value the development message names. A code followed by a word names the option, feature or member at fault.

| Code | Development explanation |
| --- | --- |
| `TABLE_FEATURE` | … needs the … feature: import { … } from "@shadow-js/table/…" and pass createTable({ features: […] }), or use the full list from "@shadow-js/table/full". |
| `TABLE_DUPLICATE` | two different "…" features were passed. |
| `TABLE_LOCALE` | the locale feature needs the locale option: createTable({ features: [locale], locale: "de" }). |

## Dependencies

- Runtime: none.
- Peers: `@shadow-js/core` and `@shadow-js/web` `^1.0.3`: reactive table state and the renderer for table components.

## Types

- Names from the root: `ColumnDef`, `TableState`, `TableOptions`, `Column`, `Row`, `Cell`, `Header`.
- Type tests in `test-types/` are compile-time checks; `npm run typecheck:types` runs them.

## Support

- Node.js `>=22.12.0`. ESM only: use `import`; `require` is not supported.
- Browsers: not applicable; the package does not touch the DOM.
- Versioning: every `@shadow-js/*` package releases together at one version. Upgrade them as one set.
- Documentation: [ShadowJS documentation](https://shadowjs.net).

## Using, changing and contributing

- **Use the package** (a person or a coding agent that builds with it): this README, and [SKILL.md](SKILL.md), the short page an agent reads first.
- **Change the package** (fix a bug, add a feature): [AGENTS.md](AGENTS.md) says how the repository is laid out, how to implement and test a change, and how a pull request is reviewed. It is written for people and coding agents alike.
- **Take part**: [CONTRIBUTING.md](CONTRIBUTING.md) is the short guide; [SECURITY.md](SECURITY.md) is for vulnerabilities.
