/**
 * The error of a member that needs a feature the table was created without. Each feature is also a
 * subpath of `@shadow-js/table`, so the message names where to import it from.
 * @packageDocumentation
 */
import type { TableFeatureName } from "../types";

/**
 * The error a feature-owned member raises when its feature is not installed. It names the member,
 * the feature, the import and the preset that has every feature.
 * @internal
 */
export function featureMissing(feature: TableFeatureName, what: string): TypeError {
  // The sentence and the import hint are development text: a production build keeps the code, the
  // feature and the member.
  return new TypeError(
    __DEV__
      ? `[shadow-table] ${what} needs the ${feature} feature: import { ${feature} } from "@shadow-js/table/${feature}" and pass createTable({ features: [${feature}] }), or use the full list from "@shadow-js/table/full".`
      : `TABLE_FEATURE ${feature} ${what}`,
  );
}

/**
 * A member that throws the feature error when called. Feature members start as these, and a feature
 * replaces the ones it owns when it is installed.
 * @internal
 */
export function absent(feature: TableFeatureName, what: string): () => never {
  return () => {
    throw featureMissing(feature, what);
  };
}
