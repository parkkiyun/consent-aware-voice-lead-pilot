import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendarRequest } from "../src/calendar.mjs";

test("builds a sanitized deterministic calendar request after explicit consent", () => {
  const input = {
    fullName: "  Sam\u0000 Buyer ",
    email: "SAM@EXAMPLE.COM",
    purpose: "Voice pilot review",
    startAt: "2026-07-20T09:00:00+09:00",
    durationMinutes: 30,
    timeZone: "Asia/Seoul",
    explicitSchedulingConsent: true,
    notes: "This optional field must not be copied",
  };

  const first = buildCalendarRequest(input);
  const second = buildCalendarRequest(input);

  assert.equal(first.allowed, true);
  assert.equal(first.request.attendee.fullName, "Sam Buyer");
  assert.equal(first.request.attendee.email, "sam@example.com");
  assert.equal(first.request.startAt, "2026-07-20T00:00:00.000Z");
  assert.equal(first.request.endAt, "2026-07-20T00:30:00.000Z");
  assert.equal(first.request.idempotencyKey, second.request.idempotencyKey);
  assert.equal("notes" in first.request, false);
});

test("blocks calendar requests without explicit scheduling consent", () => {
  const result = buildCalendarRequest({
    email: "sam@example.com",
    startAt: "2026-07-20T09:00:00+09:00",
    durationMinutes: 30,
    timeZone: "Asia/Seoul",
    explicitSchedulingConsent: false,
  });

  assert.deepEqual(result, {
    allowed: false,
    reason: "No explicit consent to create a calendar request",
    request: null,
  });
});
