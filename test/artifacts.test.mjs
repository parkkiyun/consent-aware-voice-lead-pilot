import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) =>
  JSON.parse(
    await readFile(new URL(relativePath, import.meta.url), "utf8"),
  );

test("n8n reference flow preserves the consent gate and sanitized handoff", async () => {
  const workflow = await readJson("../examples/n8n-vapi-lead-pilot.json");
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));

  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.length, 6);
  assert.equal(byName["Vapi Webhook"].parameters.responseMode, "responseNode");
  assert.equal(
    byName["Sanitized CRM Handoff"].parameters.body,
    "={{ JSON.stringify($json.crmRecord) }}",
  );

  const gateBranches = workflow.connections["Consent to Follow Up?"].main;
  assert.equal(gateBranches[0][0].node, "Sanitized CRM Handoff");
  assert.equal(gateBranches[1][0].node, "Respond Directly");

  const code = byName["Score and Sanitize"].parameters.jsCode;
  assert.match(code, /consentToContact === true/);
  assert.doesNotMatch(code, /message\.transcript|recordingUrl|recording_url/);
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
