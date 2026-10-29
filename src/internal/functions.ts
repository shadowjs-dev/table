/**
 * The built-in filter, sort and aggregation functions. Pure: they take values and return
 * values, so they are the same on the server and in the browser and easy to check against a plain
 * oracle.
 * @packageDocumentation
 */
import type { AggregationFn, AggregationFnName, FilterFnName } from "../types";

/**
 * Whether a value is missing (`undefined` or `null`): the built-in sorts put it last in either
 * direction.
 * @param value The value to test.
 * @returns `true` for `undefined` and `null`.
 * @internal
 */
export function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * The `includesString` filter: the value's text contains the filter's text, ignoring case. A value
 * that is not text is compared by its `String` form (`""` for `undefined` and `null`); a filter that
 * is not a string or a number passes every value.
 * @param value The cell value.
 * @param filter The filter value.
 * @param fold How case is folded: `toLowerCase`, or the language's rules (`locale` feature).
 * @returns Whether the value passes.
 * @internal
 */
export function includesString(
  value: unknown,
  filter: unknown,
  fold: (text: string) => string,
): boolean {
  if (typeof filter !== "string" && typeof filter !== "number") return true;
  return fold(String(value ?? "")).includes(fold(String(filter)));
}

/**
 * The `equals` filter: strict equality (`===`).
 * @param value The cell value.
 * @param filter The filter value.
 * @returns Whether the value passes.
 * @internal
 */
export function equalsValue(value: unknown, filter: unknown): boolean {
  return value === filter;
}

/**
 * The `arrIncludes` filter: the value is an array that contains the filter value.
 * @param value The cell value.
 * @param filter The filter value.
 * @returns Whether the value passes; `false` for a value that is not an array.
 * @internal
 */
export function arrayIncludes(value: unknown, filter: unknown): boolean {
  return Array.isArray(value) && value.includes(filter);
}

/**
 * The `inNumberRange` filter: a number within `[min, max]`, both ends included. A bound that is not a
 * number leaves that side open.
 * @param value The cell value.
 * @param filter The `[min, max]` tuple.
 * @returns Whether the value passes; `false` for a value that is not a number (`NaN` included) or a
 *   filter that is not an array.
 * @internal
 */
export function inNumberRange(value: unknown, filter: unknown): boolean {
  if (typeof value !== "number" || Number.isNaN(value) || !Array.isArray(filter)) return false;
  const [min, max] = filter as [unknown, unknown];
  if (typeof min === "number" && value < min) return false;
  if (typeof max === "number" && value > max) return false;
  return true;
}

/**
 * The filter a name stands for: `auto` is `includesString` for a string value and `equals` otherwise.
 * @param name The built-in filter name.
 * @returns The predicate, or `undefined` for an unknown name.
 * @internal
 */
export function filterByName(
  name: FilterFnName,
  fold: (text: string) => string,
): ((value: unknown, filter: unknown) => boolean) | undefined {
  switch (name) {
    case "includesString":
      return (value, filter) => includesString(value, filter, fold);
    case "equals":
      return equalsValue;
    case "arrIncludes":
      return arrayIncludes;
    case "inNumberRange":
      return inNumberRange;
    case "auto":
      return (value, filter) =>
        typeof value === "string"
          ? includesString(value, filter, fold)
          : equalsValue(value, filter);
    default:
      return undefined;
  }
}

/**
 * Orders two texts by character code (or two numbers by value: the same three-way test).
 * @param left The first value.
 * @param right The second value.
 * @returns Negative when `left` comes first, positive when `right` does, 0 when they are equal.
 * @internal
 */
export function compareCodes<T extends string | number | bigint>(left: T, right: T): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Orders two texts by character code after folding them to lower case: the default text sort.
 * @param left The first text.
 * @param right The second text.
 * @returns Negative when `left` comes first, positive when `right` does, 0 when they are equal.
 * @internal
 */
export function compareCaseless(left: string, right: string): number {
  return compareCodes(left.toLowerCase(), right.toLowerCase());
}

/**
 * Whether a value has no place in an order: a missing value, `NaN`, or an invalid `Date`. The
 * built-in sorts put such values last in either direction, since a comparator that returns `NaN`
 * for them would make the order depend on the engine's sort algorithm.
 * @param value The value to test.
 * @returns `true` when the value cannot be compared.
 * @internal
 */
export function isUnordered(value: unknown): boolean {
  const point = value instanceof Date ? value.getTime() : value;
  return isMissing(point) || Number.isNaN(point);
}

/** 0 for numbers and bigints, 1 for dates, 2 for everything else (compared as text). */
function orderClass(value: unknown): number {
  if (typeof value === "number" || typeof value === "bigint") return 0;
  return value instanceof Date ? 1 : 2;
}

/**
 * Compares two values for sorting: two numbers (or bigints) by value, two `Date`s by time, anything
 * else by its `String` form with `compareText`. Values of different kinds are ordered by kind
 * (numbers, then dates, then text), so a column that mixes them still has one consistent order
 * (comparing a number with text by its text would make the order cyclic). Unordered values (see
 * {@link isUnordered}) are handled by the caller.
 * @param a The first value.
 * @param b The second value.
 * @param compareText How text is ordered: `compareCaseless` and `compareCodes` for the built-in sorts, or the
 *   language's collation (`locale` feature).
 * @returns Negative when `a` comes first, positive when `b` does, 0 when they are equal.
 * @internal
 */
export function compareValues(
  a: unknown,
  b: unknown,
  compareText: (left: string, right: string) => number,
): number {
  const kind = orderClass(a);
  const other = orderClass(b);
  if (kind !== other) return kind - other;
  if (kind === 2) return compareText(String(a), String(b));
  return kind === 0
    ? compareCodes(a as number | bigint, b as number | bigint)
    : compareCodes((a as Date).getTime(), (b as Date).getTime());
}

/**
 * The smallest and the largest of a list, found with a loop: `Math.min(...list)` throws a `RangeError` for a very large
 * list (the arguments go on the call stack). `NaN` poisons both, as it does with `Math.min`.
 */
function bounds(numbers: readonly number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of numbers) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

/**
 * The aggregation of a group's leaf values: a custom function's result, or the built-in aggregation
 * of that name (see `AggregationFnName`).
 * @param values The leaf values.
 * @param fn The aggregation name or function.
 * @returns The aggregated value: `undefined` when a numeric aggregation has no numbers, or for an
 *   unknown name.
 * @internal
 */
export function aggregate(values: readonly unknown[], fn: AggregationFn): unknown {
  if (typeof fn === "function") return fn(values);
  const numbers = values.filter((value): value is number => typeof value === "number");
  switch (fn as AggregationFnName) {
    case "sum":
      return numbers.reduce((total, value) => total + value, 0);
    case "min":
      return numbers.length === 0 ? undefined : bounds(numbers)[0];
    case "max":
      return numbers.length === 0 ? undefined : bounds(numbers)[1];
    case "mean":
      return numbers.length === 0
        ? undefined
        : numbers.reduce((total, value) => total + value, 0) / numbers.length;
    case "median": {
      if (numbers.length === 0) return undefined;
      const sorted = [...numbers].sort((a, b) => a - b);
      const middle = sorted.length >> 1;
      return sorted.length % 2 === 0
        ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
        : (sorted[middle] ?? 0);
    }
    case "count":
      return values.length;
    case "unique":
      return [...new Set(values)];
    case "uniqueCount":
      return new Set(values).size;
    case "extent":
      return numbers.length === 0 ? undefined : bounds(numbers);
    default:
      return undefined;
  }
}
