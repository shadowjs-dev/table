import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProduction, messageOf } from "./support/production-build";

type MissingModule = typeof import("../src/internal/missing");

describe("production error codes of the table features", () => {
  it("[ERR-CODES-6] a member of a missing feature names TABLE_FEATURE, the feature and the member", async () => {
    const missing = await loadProduction<MissingModule>(
      join(import.meta.dirname, "../src/internal/missing.ts"),
    );
    const message = messageOf(() => missing.absent("grouping", "grouping")());
    expect(message).toBe("TABLE_FEATURE grouping grouping");
  });
});
