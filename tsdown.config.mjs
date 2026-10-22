import { createConfig } from "./build/tsdown-preset.mjs";

// Each feature is its own entry, so a table that lists only some of them bundles only those.
export default createConfig({
  entries: {
    index: "src/index.ts",
    grouping: "src/grouping.ts",
    expanding: "src/expanding.ts",
    pinning: "src/pinning.ts",
    sizing: "src/sizing.ts",
    layout: "src/layout.ts",
    faceting: "src/faceting.ts",
    visibility: "src/visibility.ts",
    ordering: "src/ordering.ts",
    locale: "src/locale.ts",
    full: "src/full.ts",
  },
  packageDir: import.meta.dirname,
});
