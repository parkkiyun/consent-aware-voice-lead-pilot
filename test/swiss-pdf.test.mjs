import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildSwissQuote } from "../src/swissQuote.mjs";

test("Swiss sample PDF is backed by the tested exact-match quote output", async () => {
  const source = JSON.parse(
    await readFile(
      new URL("../examples/swiss-hvac-sample-quote.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(buildSwissQuote(source.input), source.quote);

  const pdf = await readFile(
    new URL("../examples/swiss-hvac-sample-quote.pdf", import.meta.url),
  );
  assert.ok(pdf.length > 5_000);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.match(pdf.toString("latin1"), /Swiss HVAC synthetic exact-match sample quote/);
});
