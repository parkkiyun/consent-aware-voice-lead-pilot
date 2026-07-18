import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { qualifyLead } from "./qualify.mjs";

const MAX_BODY_BYTES = 256 * 1024;

export function createApp({
  webhookSecret = process.env.VAPI_WEBHOOK_SECRET ?? "",
  crmWebhookUrl = process.env.CRM_WEBHOOK_URL ?? "",
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const processedCallIds = new Set();

  return http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        return sendJson(response, 200, { ok: true, service: "voice-lead-pilot" });
      }

      if (request.method !== "POST" || request.url !== "/vapi/events") {
        return sendJson(response, 404, { error: "not_found" });
      }

      if (!isAuthorized(request.headers["x-vapi-secret"], webhookSecret)) {
        return sendJson(response, 401, { error: "unauthorized" });
      }

      const payload = await readJson(request);
      const message = payload?.message;
      if (!message || typeof message.type !== "string") {
        return sendJson(response, 400, { error: "invalid_vapi_event" });
      }

      if (message.type === "tool-calls") {
        const calls = Array.isArray(message.toolCallList) ? message.toolCallList : [];
        const results = calls.map((call) => {
          if (call.name !== "qualifyLead") {
            return {
              name: call.name ?? "unknown",
              toolCallId: call.id,
              result: JSON.stringify({ error: "unsupported_tool" }),
            };
          }

          return {
            name: call.name,
            toolCallId: call.id,
            result: JSON.stringify(qualifyLead(call.parameters)),
          };
        });
        return sendJson(response, 200, { results });
      }

      if (message.type === "end-of-call-report") {
        const callId = String(message.call?.id ?? "");
        if (callId && processedCallIds.has(callId)) {
          return sendJson(response, 200, { accepted: true, duplicate: true });
        }

        const structured = message.analysis?.structuredData ?? {};
        const qualification = qualifyLead(structured);
        const record = {
          callId,
          occurredAt: message.endedAt ?? new Date().toISOString(),
          endedReason: String(message.endedReason ?? "unknown").slice(0, 80),
          recordingConsentGranted: Boolean(
            message.compliance?.recordingConsent?.grantedAt,
          ),
          qualification,
        };

        // Raw transcripts and recording URLs are intentionally not forwarded.
        if (crmWebhookUrl && qualification.lead.consentToContact) {
          const crmResponse = await fetchImpl(crmWebhookUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(record),
            signal: AbortSignal.timeout(5000),
          });
          if (!crmResponse.ok) {
            throw new Error(`CRM webhook returned ${crmResponse.status}`);
          }
        }

        if (callId) processedCallIds.add(callId);
        logger.info?.("Processed call outcome", {
          callId,
          tier: qualification.tier,
          forwarded: Boolean(crmWebhookUrl && qualification.lead.consentToContact),
        });
        return sendJson(response, 200, { accepted: true });
      }

      return sendJson(response, 200, { accepted: true, ignored: message.type });
    } catch (error) {
      const status = error?.code === "BODY_TOO_LARGE" ? 413 : 400;
      logger.error?.("Webhook error", { message: error?.message });
      return sendJson(response, status, { error: "invalid_request" });
    }
  });
}

function isAuthorized(provided, expected) {
  if (!expected) return true;
  if (typeof provided !== "string") return false;
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, "127.0.0.1", () => {
    console.log(`voice-lead-pilot listening on http://127.0.0.1:${port}`);
  });
}
