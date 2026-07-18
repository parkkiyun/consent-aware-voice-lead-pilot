import { createHash } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_ZONE_PATTERN = /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/;

export function buildCalendarRequest(input = {}) {
  if (input.explicitSchedulingConsent !== true) {
    return blocked("No explicit consent to create a calendar request");
  }

  const email = String(input.email ?? "").trim().toLowerCase();
  const fullName = cleanText(input.fullName, 120);
  const purpose = cleanText(input.purpose, 120) || "Pilot consultation";
  const timeZone = String(input.timeZone ?? "").trim();
  const startAt = parseIsoTimestamp(input.startAt);
  const durationMinutes = Number(input.durationMinutes);

  if (!EMAIL_PATTERN.test(email)) return blocked("A valid attendee email is required");
  if (!startAt) return blocked("A valid ISO 8601 start time is required");
  if (!TIME_ZONE_PATTERN.test(timeZone)) return blocked("A valid IANA time zone is required");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 120) {
    return blocked("Duration must be a whole number from 15 to 120 minutes");
  }

  const endAt = new Date(Date.parse(startAt) + durationMinutes * 60_000).toISOString();
  const idempotencyKey = createHash("sha256")
    .update(`${email}|${startAt}|${durationMinutes}`)
    .digest("hex")
    .slice(0, 24);

  return {
    allowed: true,
    reason: "Explicit scheduling consent recorded",
    request: {
      idempotencyKey,
      startAt,
      endAt,
      timeZone,
      attendee: { fullName, email },
      title: purpose,
      source: "voice-lead-pilot",
    },
  };
}

function blocked(reason) {
  return { allowed: false, reason, request: null };
}

function parseIsoTimestamp(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    return "";
  }
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function cleanText(value, maxLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
