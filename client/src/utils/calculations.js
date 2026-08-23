export const PURITIES = ['9 Ct', '14 Ct', '18 Ct', '20 Ct', '22 Ct', '23 Ct', '24 Ct'];

export const PURITY_PERCENTAGES = {
  '9 Ct': 0.37,
  '14 Ct': 0.585,
  '18 Ct': 0.75,
  '20 Ct': 0.833,
  '22 Ct': 0.916,
  '23 Ct': 0.9583,
  '24 Ct': 1,
};

export const DEFAULT_BASE_RATE_24CT = 14200;

export function roundMoney(value) {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
}

export function deriveRatesFromBaseRate(baseRate24ct) {
  const base = Number(baseRate24ct) || 0;
  return Object.fromEntries(
    Object.entries(PURITY_PERCENTAGES).map(([purity, percentage]) => [purity, roundMoney(base * percentage)]),
  );
}

export const DEFAULT_RATES = deriveRatesFromBaseRate(DEFAULT_BASE_RATE_24CT);

export function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatWeight(value) {
  return (Number(value) || 0).toFixed(2);
}

export function calculateNetWeight(row) {
  const net = (Number(row.grossWeight) || 0) - (Number(row.stoneWeight) || 0);
  return roundMoney(Math.max(0, net));
}

export function calculateMarketValue(row, rates) {
  return roundMoney((Number(row.netWeight) || 0) * (Number(rates[row.purity]) || 0));
}

export function calculateRows(rows, rates) {
  return rows.map((row) => {
    const netWeight = calculateNetWeight(row);
    return {
      ...row,
      netWeight,
      marketValue: row.marketManual ? Number(row.marketValue) || 0 : calculateMarketValue({ ...row, netWeight }, rates),
    };
  });
}

export function calculateTotals(rows) {
  return rows.reduce(
    (totals, row) => ({
      units: totals.units + (Number(row.units) || 0),
      stoneWeight: totals.stoneWeight + (Number(row.stoneWeight) || 0),
      grossWeight: totals.grossWeight + (Number(row.grossWeight) || 0),
      netWeight: totals.netWeight + (Number(row.netWeight) || 0),
      marketValue: totals.marketValue + (Number(row.marketValue) || 0),
    }),
    { units: 0, stoneWeight: 0, grossWeight: 0, netWeight: 0, marketValue: 0 },
  );
}

export function groupPuritySummaries(rows) {
  const summary = new Map();

  rows.forEach((row) => {
    if (!row.purity) return;
    const current = summary.get(row.purity) || { purity: row.purity, grossWeight: 0, netWeight: 0 };
    current.grossWeight += Number(row.grossWeight) || 0;
    current.netWeight += Number(row.netWeight) || 0;
    summary.set(row.purity, current);
  });

  return Array.from(summary.values());
}
