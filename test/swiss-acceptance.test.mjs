import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildSwissQuote } from "../src/swissQuote.mjs";

test("Swiss quote engine satisfies the ten published acceptance cases", async () => {
  const cases = JSON.parse(
    await readFile(
      new URL("../examples/swiss-hvac-acceptance-cases.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(cases.length, 10);

  for (const fixture of cases) {
    const quote = buildSwissQuote(fixture.input);
    const actual = {
      status: quote.status,
      matchedCount: quote.matched.length,
      exceptionCount: quote.exceptions.length,
      materialsWithMarginChf: quote.pricing.materialsWithMarginChf,
      laborChf: quote.pricing.laborChf,
      travelChf: quote.pricing.travelChf,
      vatChf: quote.pricing.vatChf,
      totalChf: quote.pricing.totalChf,
    };
    assert.deepEqual(actual, fixture.expected, fixture.name);
  }
});
