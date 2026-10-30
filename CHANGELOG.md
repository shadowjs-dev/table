# Changelog

## 1.0.4

### Changed

- Released at 1.0.4 with the other packages, which share one version. No change to this package.

## 1.0.3

### Fixed

- Smaller bundles with the same behavior. Production builds of table, query and virtual throw short codes (`TABLE_DUPLICATE`, `QUERY_LIMIT`, `VIRTUAL_KERNEL`) instead of the development messages; each package's README lists them.
- table: `min`, `max` and `extent` aggregations no longer throw a `RangeError` for a very large group (loops, not spread arguments)
- table: an uncontrolled pager returns to the first page when a controlled column filter, global filter or grouping changes
- table: mutators (`setPageIndex`, `nextPage`, `toggleSelected`, `toggleExpanded`, `toggleSorting`, `setFilterValue`, `pin`, `toggleVisibility` and the rest) and state updaters run untracked, so calling one in an effect no longer makes the effect depend on table state
- table: tree selection keeps parents consistent: deselecting every child deselects the parent, selecting every child selects it, and `getIsSomeRowsSelected` and `Row.getIsSomeSelected` count rows at any depth
- table: `Row.getIsExpanded` reads a per-row flag, so a row's readers no longer rerun when another row toggles
- table: `inNumberRange` leaves `NaN` out of every range
- table: faceting memoizes each column's facets, so reading them again runs no filter

## 1.0.2

### Fixed

- Sorting puts `NaN` and invalid dates last in either direction, like missing values, instead of leaving the order to the engine's sort.
- A column that mixes numbers, dates and text sorts by kind (numbers, dates, text) so the order is consistent, and bigints sort by value.
- A page size of `NaN` reads as 10 and `Infinity` puts every row on one page; `setPageIndex(NaN)` and `setPageSize(NaN)` no longer write `NaN` into the state.
- `getFacetedMinMaxValues` ignores `NaN` values.
- Per-row selection and expansion cells are dropped for rows that left the data (a table whose row ids keep changing no longer grows for its whole life); a row still in the data, or a group row, keeps its cell and its state.
- Building columns and grouping no longer recurse over the nesting depth, so column groups and grouped columns can be nested thousands deep.
- A selection or expansion flag that an effect or memo is reading is no longer dropped when its row leaves the data: an observer of a row that leaves and comes back keeps hearing of its changes. Unwatched flags are swept as before.
- `setPageSize` after an `Infinity` page size with a page index above 0 (written through `setPagination`) goes to the first page instead of storing an `Infinity` or `NaN` page index.

## 1.0.1

### Changed

- Released at 1.0.1 with the other packages, which share one version. No change to this package.

## 1.0.0

### Added

- Typed columns and fine-grained row models for filtering, sorting, grouping, expansion and pagination.
- Optional pinning, sizing, layout, faceting, visibility and column ordering.
- `locale` feature and option: text sorts and text filters follow the language of the data (`Intl.Collator`, numbers inside text by value, locale case folding).
- Controlled state slices and selection or expansion of nested rows.
