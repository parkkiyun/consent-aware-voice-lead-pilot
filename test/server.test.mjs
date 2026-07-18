import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.mjs";

async function withServer(options, run) {
  const server = createApp(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("rejects a bad webhook secret", async () => {
  await withServer({ webhookSecret: "correct" }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/vapi/events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vapi-secret": "wrong" },
      body: JSON.stringify({ message: { type: "status-update" } }),
    });
    assert.equal(response.status, 401);
  });
});

test("returns a Vapi tool result for qualification", async () => {
  await withServer({ webhookSecret: "secret" }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/vapi/events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vapi-secret": "secret" },
      body: JSON.stringify({
        message: {
          type: "tool-calls",
          toolCallList: [
            {
              id: "tool-1",
              name: "qualifyLead",
              parameters: {
                serviceType: "Lead follow-up automation",
                email: "buyer@example.com",
                budget: 3000,
                officeSize: 25,
                timelineDays: 10,
                decisionMaker: true,
                consentToContact: true,
              },
            },
          ],
        },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    const result = JSON.parse(body.results[0].result);
    assert.equal(result.tier, "hot");
  });
});

test("returns a consent-gated calendar request without calling an external calendar", async () => {
  await withServer({ webhookSecret: "secret" }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/vapi/events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vapi-secret": "secret" },
      body: JSON.stringify({
        message: {
          type: "tool-calls",
          toolCallList: [
            {
              id: "tool-calendar-1",
              name: "buildCalendarRequest",
              parameters: {
                fullName: "Sam Buyer",
                email: "sam@example.com",
                purpose: "Pilot consultation",
                startAt: "2026-07-20T09:00:00+09:00",
                durationMinutes: 30,
                timeZone: "Asia/Seoul",
                explicitSchedulingConsent: true,
              },
            },
          ],
        },
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    const result = JSON.parse(body.results[0].result);
    assert.equal(result.allowed, true);
    assert.equal(result.request.attendee.email, "sam@example.com");
    assert.equal(result.request.source, "voice-lead-pilot");
  });
});

test("forwards only a sanitized end-of-call record", async () => {
  const forwarded = [];
  const fetchImpl = async (_url, options) => {
    forwarded.push(JSON.parse(options.body));
    return { ok: true, status: 200 };
  };
  const logger = { info() {}, error() {} };

  await withServer(
    { webhookSecret: "secret", crmWebhookUrl: "https://crm.invalid", fetchImpl, logger },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/vapi/events`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-vapi-secret": "secret" },
        body: JSON.stringify({
          message: {
            type: "end-of-call-report",
            call: { id: "call-123" },
            endedAt: "2026-07-19T00:00:00Z",
            endedReason: "assistantEndedCall",
            transcript: "Sensitive raw transcript must not be forwarded",
            recordingUrl: "https://recording.invalid/private",
            compliance: { recordingConsent: { type: "verbal", grantedAt: "2026-07-19T00:00:10Z" } },
            analysis: {
              structuredData: {
                fullName: "Sam Buyer",
                email: "sam@example.com",
                serviceType: "AI calling",
                budget: 3000,
                officeSize: 25,
                timelineDays: 14,
                decisionMaker: true,
                consentToContact: true,
              },
            },
          },
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(forwarded.length, 1);
      assert.equal(forwarded[0].qualification.tier, "hot");
      assert.equal("transcript" in forwarded[0], false);
      assert.equal("recordingUrl" in forwarded[0], false);
    },
  );
});
