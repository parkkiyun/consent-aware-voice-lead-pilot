import test from "node:test";
import assert from "node:assert/strict";
import { qualifyLead } from "../src/qualify.mjs";

test("scores a qualified decision-maker as hot", () => {
  const result = qualifyLead({
    fullName: "Sam Buyer",
    company: "Example Solar",
    serviceType: "AI calling for inbound leads",
    email: "sam@example.com",
    budget: 3000,
    officeSize: 25,
    timelineDays: 14,
    decisionMaker: true,
    consentToContact: true,
  });

  assert.equal(result.score, 100);
  assert.equal(result.tier, "hot");
});

test("refuses follow-up when consent is missing", () => {
  const result = qualifyLead({
    fullName: "No Consent",
    email: "person@example.com",
    budget: 10000,
    decisionMaker: true,
    consentToContact: false,
  });

  assert.equal(result.score, 0);
  assert.equal(result.tier, "do-not-contact");
});

test("normalizes unsafe and invalid input", () => {
  const result = qualifyLead({
    fullName: "  A\u0000 B  ",
    email: "not-an-email",
    phone: "12345",
    budget: -20,
    officeSize: "unknown",
    timelineDays: "unknown",
    consentToContact: true,
  });

  assert.equal(result.lead.fullName, "A B");
  assert.equal(result.lead.email, "");
  assert.equal(result.lead.phone, "");
  assert.equal(result.lead.budget, 0);
  assert.equal(result.lead.officeSize, null);
  assert.equal(result.lead.timelineDays, null);
});
