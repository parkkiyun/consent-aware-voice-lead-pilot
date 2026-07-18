import test from "node:test";
import assert from "node:assert/strict";
import { buildSwissQuote, normalizeCatalogKey } from "../src/swissQuote.mjs";

test("matches only an exact registered SKU, description, or alias", () => {
  const quote = buildSwissQuote({
    request: "2 x flexible DN15; SANITAS-SYN-101; robinet presque identique",
    laborHours: 2,
  });

  assert.equal(quote.matched.length, 2);
  assert.equal(quote.matched[0].sku, "GETAZ-SYN-001");
  assert.equal(quote.matched[0].quantity, 2);
  assert.equal(quote.matched[1].sku, "SANITAS-SYN-101");
  assert.equal(quote.exceptions.length, 1);
  assert.equal(quote.exceptions[0].priced, false);
  assert.equal(quote.status, "REVIEW_REQUIRED");
});

test("normalizes French accents and case without fuzzy matching", () => {
  assert.equal(normalizeCatalogKey("  MITIGEUR   LAVABO   CHROMÉ "), "mitigeur lavabo chrome");
  const quote = buildSwissQuote({ request: "Mitigeur lavabo chromé", includeTravel: false });
  assert.equal(quote.matched[0].sku, "SANITAS-SYN-101");
  assert.equal(quote.exceptions.length, 0);
});

test("applies the published Swiss pricing rules deterministically", () => {
  const quote = buildSwissQuote({
    request: "2 x flexible alimentation DN15",
    laborHours: 2,
    includeTravel: true,
  });
  assert.deepEqual(quote.pricing, {
    materialBaseChf: 85,
    materialMarginRate: 0.15,
    materialMarginChf: 12.75,
    materialsWithMarginChf: 97.75,
    laborHours: 2,
    laborRateChf: 95,
    laborChf: 190,
    travelChf: 45,
    subtotalChf: 332.75,
    vatRate: 0.081,
    vatChf: 26.95,
    totalChf: 359.7,
  });
});

test("rejects invalid quantities and duplicate exact catalog keys", () => {
  assert.throws(() => buildSwissQuote({ request: "0 x flexible DN15" }), /Invalid quantity/);
  assert.throws(
    () => buildSwissQuote({ request: "one" }, [
      { supplier: "A", sku: "A-1", description: "same", aliases: [], unitPriceChf: 1 },
      { supplier: "B", sku: "B-1", description: "same", aliases: [], unitPriceChf: 2 },
    ]),
    /Duplicate exact catalog key/,
  );
});
