const VAT_RATE = 0.081;
const MATERIAL_MARGIN_RATE = 0.15;
const LABOR_RATE_CHF = 95;
const TRAVEL_FEE_CHF = 45;

export const SYNTHETIC_CATALOG = Object.freeze([
  {
    supplier: "Getaz Miauton (synthetic)",
    sku: "GETAZ-SYN-001",
    description: "Flexible alimentation DN15",
    aliases: ["flexible alimentation dn15", "flexible dn15"],
    unitPriceChf: 42.5,
  },
  {
    supplier: "Sanitas Troesch (synthetic)",
    sku: "SANITAS-SYN-101",
    description: "Mitigeur lavabo chrome",
    aliases: ["mitigeur lavabo chrome"],
    unitPriceChf: 175,
  },
  {
    supplier: "Nussbaum (synthetic)",
    sku: "NUSSBAUM-SYN-201",
    description: "Vanne a bille 1/2",
    aliases: ["vanne a bille 1/2", "vanne bille 1/2"],
    unitPriceChf: 65,
  },
]);

export function normalizeCatalogKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/.-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildSwissQuote({ request = "", laborHours = 0, includeTravel = true } = {}, catalog = SYNTHETIC_CATALOG) {
  const validatedCatalog = catalog.map(validateCatalogItem);
  const exactIndex = new Map();
  for (const item of validatedCatalog) {
    for (const key of [item.sku, item.description, ...item.aliases]) {
      const normalized = normalizeCatalogKey(key);
      const existing = exactIndex.get(normalized);
      if (existing && existing.sku !== item.sku) {
        throw new Error(`Duplicate exact catalog key: ${normalized}`);
      }
      exactIndex.set(normalized, item);
    }
  }

  const requestedLines = String(request)
    .split(/[;\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseRequestedLine);

  const matched = [];
  const exceptions = [];
  for (const line of requestedLines) {
    const item = exactIndex.get(normalizeCatalogKey(line.description));
    if (!item) {
      exceptions.push({
        requested: line.original,
        quantity: line.quantity,
        reason: "NO_EXACT_CATALOG_MATCH",
        priced: false,
      });
      continue;
    }
    matched.push({
      requested: line.original,
      supplier: item.supplier,
      sku: item.sku,
      catalogDescription: item.description,
      quantity: line.quantity,
      unitPriceChf: item.unitPriceChf,
      materialBaseChf: money(line.quantity * item.unitPriceChf),
      exactMatch: true,
    });
  }

  const safeLaborHours = finiteNonNegative(laborHours, "laborHours");
  const materialBaseChf = money(matched.reduce((sum, row) => sum + row.materialBaseChf, 0));
  const materialMarginChf = money(materialBaseChf * MATERIAL_MARGIN_RATE);
  const materialsWithMarginChf = money(materialBaseChf + materialMarginChf);
  const laborChf = money(safeLaborHours * LABOR_RATE_CHF);
  const travelChf = includeTravel === false ? 0 : TRAVEL_FEE_CHF;
  const subtotalChf = money(materialsWithMarginChf + laborChf + travelChf);
  const vatChf = money(subtotalChf * VAT_RATE);

  return {
    status: exceptions.length ? "REVIEW_REQUIRED" : "READY",
    currency: "CHF",
    catalogMode: "SYNTHETIC_EXACT_MATCH_ONLY",
    matched,
    exceptions,
    pricing: {
      materialBaseChf,
      materialMarginRate: MATERIAL_MARGIN_RATE,
      materialMarginChf,
      materialsWithMarginChf,
      laborHours: safeLaborHours,
      laborRateChf: LABOR_RATE_CHF,
      laborChf,
      travelChf,
      subtotalChf,
      vatRate: VAT_RATE,
      vatChf,
      totalChf: money(subtotalChf + vatChf),
    },
  };
}

function parseRequestedLine(original) {
  const match = String(original).match(/^\s*(?:(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*)?(.+?)\s*$/i);
  const quantity = Number(String(match?.[1] ?? "1").replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
    throw new Error(`Invalid quantity in request line: ${original}`);
  }
  return { original: String(original).trim(), quantity, description: match[2] };
}

function validateCatalogItem(item) {
  const unitPriceChf = finiteNonNegative(item?.unitPriceChf, "catalog unitPriceChf");
  if (!item?.supplier || !item?.sku || !item?.description || !Array.isArray(item?.aliases)) {
    throw new Error("Catalog items require supplier, sku, description, and aliases");
  }
  return { ...item, unitPriceChf };
}

function finiteNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a finite non-negative number`);
  return number;
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
