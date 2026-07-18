const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizeLead(input = {}) {
  const budget = Number(input.budget);
  const timelineDays = Number(input.timelineDays);
  const officeSize = Number(input.officeSize);

  return {
    fullName: cleanText(input.fullName, 120),
    company: cleanText(input.company, 160),
    serviceType: cleanText(input.serviceType, 120),
    email: EMAIL_PATTERN.test(String(input.email ?? "").trim())
      ? String(input.email).trim().toLowerCase()
      : "",
    phone: E164_PATTERN.test(String(input.phone ?? "").trim())
      ? String(input.phone).trim()
      : "",
    budget: Number.isFinite(budget) && budget >= 0 ? budget : 0,
    officeSize:
      Number.isFinite(officeSize) && officeSize >= 0
        ? Math.round(officeSize)
        : null,
    timelineDays:
      Number.isFinite(timelineDays) && timelineDays >= 0
        ? Math.round(timelineDays)
        : null,
    decisionMaker: input.decisionMaker === true,
    consentToContact: input.consentToContact === true,
    notes: cleanText(input.notes, 500),
  };
}

export function qualifyLead(input = {}) {
  const lead = normalizeLead(input);
  let score = 0;
  const reasons = [];

  if (!lead.consentToContact) {
    return {
      lead,
      score: 0,
      tier: "do-not-contact",
      reasons: ["No explicit consent for follow-up"],
      nextAction: "Do not contact; retain no optional personal data",
    };
  }

  if (lead.email || lead.phone) {
    score += 10;
    reasons.push("Valid follow-up channel");
  }
  if (lead.serviceType) {
    score += 10;
    reasons.push("Defined service need");
  }
  if (lead.decisionMaker) {
    score += 15;
    reasons.push("Decision-maker involved");
  }
  if (lead.timelineDays !== null && lead.timelineDays <= 30) {
    score += 20;
    reasons.push("Timeline within 30 days");
  } else if (lead.timelineDays !== null && lead.timelineDays <= 90) {
    score += 15;
    reasons.push("Timeline within 90 days");
  }
  if (lead.budget >= 2500) {
    score += 25;
    reasons.push("Budget supports a full engagement");
  } else if (lead.budget >= 1000) {
    score += 15;
    reasons.push("Budget supports a pilot");
  }

  if (lead.officeSize !== null && lead.officeSize >= 20) {
    score += 20;
    reasons.push("Office size supports the target deployment");
  } else if (lead.officeSize !== null && lead.officeSize >= 5) {
    score += 10;
    reasons.push("Office size supports a pilot");
  }

  const tier = score >= 90 ? "hot" : score >= 50 ? "warm" : "nurture";
  const nextAction =
    tier === "hot"
      ? "Offer the earliest available consultation slot"
      : tier === "warm"
        ? "Send a concise pilot scope and request missing qualification data"
        : "Send one permission-based resource; do not add to a recurring sequence";

  return { lead, score, tier, reasons, nextAction };
}

function cleanText(value, maxLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
