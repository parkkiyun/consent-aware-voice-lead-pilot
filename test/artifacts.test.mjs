import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const readJson = async (relativePath) =>
  JSON.parse(
    await readFile(new URL(relativePath, import.meta.url), "utf8"),
  );

const runCodeNode = (code, payload) =>
  runInNewContext(`(() => {${code}})()`, { $json: payload });

test("n8n reference flow preserves the consent gate and sanitized handoff", async () => {
  const workflow = await readJson("../examples/n8n-vapi-lead-pilot.json");
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));

  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.length, 8);
  assert.equal(byName["Vapi Webhook"].parameters.responseMode, "responseNode");
  assert.equal(
    byName["Sanitized CRM Handoff"].parameters.body,
    "={{ JSON.stringify($json.crmRecord) }}",
  );

  const gateBranches = workflow.connections["Consent to Follow Up?"].main;
  assert.equal(gateBranches[0][0].node, "Sanitized CRM Handoff");
  assert.equal(gateBranches[1][0].node, "Respond Directly");

  const calendarBranches = workflow.connections["Calendar Request Ready?"].main;
  assert.equal(
    calendarBranches[0][0].node,
    "Return Calendar Request (No Live Call)",
  );
  assert.equal(calendarBranches[1][0].node, "Consent to Follow Up?");

  const code = byName["Score and Sanitize"].parameters.jsCode;
  assert.match(code, /consentToContact === true/);
  assert.match(code, /explicitSchedulingConsent !== true/);
  assert.match(code, /no live calendar API is called/i);
  assert.doesNotMatch(code, /message\.transcript|recordingUrl|recording_url/);

  const calendarInput = {
    body: {
      message: {
        type: "tool-calls",
        toolCallList: [
          {
            id: "calendar-tool-1",
            name: "buildCalendarRequest",
            parameters: {
              explicitSchedulingConsent: true,
              attendeeEmail: " Buyer@Example.com ",
              startsAt: "2026-07-20T10:00:00+09:00",
              durationMinutes: 30,
              timeZone: "Asia/Seoul",
              title: " Pilot handoff ",
              notes: " Synthetic proof only. ",
            },
          },
        ],
      },
    },
  };
  const calendarResult = runCodeNode(code, calendarInput)[0].json;
  const calendarToolResult = JSON.parse(
    calendarResult.responseBody.results[0].result,
  );
  assert.equal(calendarResult.calendarRequestReady, true);
  assert.equal(calendarResult.forwardToCrm, false);
  assert.equal(calendarResult.calendarRequest.attendeeEmail, "buyer@example.com");
  assert.equal(calendarResult.calendarRequest.idempotencyKey, "vapi-calendar:calendar-tool-1");
  assert.equal(calendarToolResult.created, false);
  assert.equal(calendarToolResult.ready, true);

  const blockedInput = structuredClone(calendarInput);
  blockedInput.body.message.toolCallList[0].parameters.explicitSchedulingConsent =
    false;
  const blockedResult = runCodeNode(code, blockedInput)[0].json;
  assert.equal(blockedResult.calendarRequestReady, false);
  assert.equal(
    JSON.parse(blockedResult.responseBody.results[0].result).reason,
    "No explicit consent to create a calendar request",
  );
});

test("assistant template discloses AI identity and requires follow-up consent", async () => {
  const assistant = await readJson("../examples/assistant-template.json");
  const systemMessage = assistant.model.messages.find(
    (message) => message.role === "system",
  )?.content;
  const qualifyLead = assistant.model.functions.find(
    (fn) => fn.name === "qualifyLead",
  );
  const buildCalendarRequest = assistant.model.functions.find(
    (fn) => fn.name === "buildCalendarRequest",
  );

  assert.deepEqual(assistant.serverMessages, ["tool-calls", "end-of-call-report"]);
  assert.match(systemMessage, /Identify yourself as AI/);
  assert.match(systemMessage, /If consent is withdrawn/);
  assert.ok(qualifyLead.parameters.required.includes("consentToContact"));
  assert.match(systemMessage, /explicitly asks to schedule/);
  assert.ok(
    buildCalendarRequest.parameters.required.includes("explicitSchedulingConsent"),
  );

  const demo = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(demo, /import \{ qualifyLead \} from "\.\/src\/qualify\.mjs"/);
  assert.match(demo, /runs entirely in your browser and sends nothing anywhere/);
  assert.match(demo, /CRM handoff blocked: no explicit consent/);
  assert.match(demo, /No payload produced\./);
  assert.doesNotMatch(demo, /fetch\s*\(/);
});
