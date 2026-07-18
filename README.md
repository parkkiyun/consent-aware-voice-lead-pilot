# Consent-aware AI voice lead pilot

A small, dependency-free Node.js service that demonstrates a real Vapi integration for a 24-hour paid pilot. It receives Vapi Server URL events, scores permission-based leads, and forwards a sanitized outcome to a CRM webhook.

## What is already implemented

- Vapi `tool-calls` request/response handling for `qualifyLead`
- Vapi `tool-calls` handling for a consent-gated, sanitized calendar request
- Deterministic hot/warm/nurture scoring with input validation
- Brief-matched scoring across budget, timeline, office size, decision-maker status, need, and contactability; hot threshold is 90/100
- End-of-call report processing with idempotency
- Optional CRM webhook forwarding
- Timing-safe webhook-secret validation
- 256 KiB request limit and five-second CRM timeout
- Privacy guardrail: raw transcripts and recording URLs are never forwarded
- Consent guardrail: no CRM forwarding without explicit follow-up consent
- Scheduling guardrail: no calendar request without explicit consent, attendee email, exact time, duration, and IANA time zone
- Deterministic calendar idempotency key; no live calendar is called by the proof
- Automated tests using Node's built-in test runner
- Importable n8n reference workflow for the Vapi-event → score → consent gate → CRM path

## Run it

```bash
npm test
VAPI_WEBHOOK_SECRET=replace-me CRM_WEBHOOK_URL=https://example.com/webhook npm start
```

Health check: `GET http://127.0.0.1:3000/health`

Vapi Server URL: `POST https://your-host.example/vapi/events`

The included `examples/assistant-template.json` is a starting configuration. Replace provider/model settings as needed, configure a Vapi Custom Credential for the `X-Vapi-Secret` header, and point the assistant Server URL to this service.

`examples/n8n-vapi-lead-pilot.json` is a reference workflow that can be imported into a current n8n instance and then wired to the buyer's credentials. The dependency-free Node implementation remains the tested source of truth for scoring and sanitization.

## Zero-setup browser demo

Serve the repository directory and open `index.html` to exercise the same deterministic scorer without credentials or outbound network requests. The page begins with synthetic data and visibly blocks the CRM payload when follow-up consent is withdrawn.

Live demo: https://parkkiyun.github.io/consent-aware-voice-lead-pilot/

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`. Do not paste real customer data, credentials, transcripts, or recordings into the demo.

## Paid 24-hour pilot scope

1. Adapt qualification fields and score thresholds to one buyer workflow.
2. Configure one Vapi assistant and one consented test call path.
3. Connect one CRM or webhook destination.
4. Run five scripted test cases, including consent withdrawal and webhook retry.
5. Deliver the source, configuration guide, test evidence, and a 30-minute handoff.

Not included: purchased phone numbers, telephony usage, bulk outbound calling, unconsented outreach, production SLA, or claims about conversion results.

## Compliance note

Outbound calls must only target people who have consented to contact. Recording and disclosure rules vary by jurisdiction; the production deployment must use the buyer's approved script and legal requirements. This pilot does not bypass platform or telecom controls.

## Primary technical references

- Vapi Server events: https://docs.vapi.ai/server-url/events
- Vapi server authentication: https://docs.vapi.ai/server-url/server-authentication
- Vapi outbound calling: https://docs.vapi.ai/calls/outbound-calling
- Vapi recording consent plan: https://docs.vapi.ai/security-and-privacy/recording-consent-plan
