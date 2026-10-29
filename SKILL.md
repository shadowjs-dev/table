---
name: shadowjs-table
description: "Work with @shadow-js/table. A headless data table with sorting, filtering, pagination, selection and grouping. Use when a project imports it, or when asked to add, configure or debug it."
---

# @shadow-js/table

Version 1.0.2. A headless data table with sorting, filtering, pagination, selection and grouping.

## Where to read more

- @shadow-js/table: https://table.shadowjs.net
- Source and issues: https://github.com/shadowjs-dev/table
- The package README is the full reference for options and behavior; read it before changing a configuration.

## Install

```sh
npm install @shadow-js/table @shadow-js/core @shadow-js/web
```

## Peer dependencies

| Package | Range | Required |
| --- | --- | --- |
| `@shadow-js/core` | `^1.0.2` | yes |
| `@shadow-js/web` | `^1.0.2` | yes |

## Import paths

Import only from these paths. Never from `dist` or `src`: files that are not listed here are private and change without notice.

- `@shadow-js/table`
- `@shadow-js/table/grouping`
- `@shadow-js/table/expanding`
- `@shadow-js/table/pinning`
- `@shadow-js/table/sizing`
- `@shadow-js/table/layout`
- `@shadow-js/table/faceting`
- `@shadow-js/table/visibility`
- `@shadow-js/table/ordering`
- `@shadow-js/table/locale`
- `@shadow-js/table/full`

## Quick start

```ts
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

## Working rules

- Run `npm run check` before proposing a change; it lints, builds, type-checks and tests.
- Keep a public change documented: TSDoc on every exported symbol, and a CHANGELOG entry.
- To change this repository rather than use the package, read AGENTS.md: the layout, the commands, the rules and how a pull request is reviewed.
