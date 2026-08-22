export const PURITIES = ['14 Ct', '18 Ct', '20 Ct', '22 Ct', '24 Ct'];

export const DEFAULT_RATES = {
  '14 Ct': 8283.33,
  '18 Ct': 10650,
  '20 Ct': 11833.33,
  '22 Ct': 13016.67,
  '24 Ct': 14200,
};

export function roundMoney(value) {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatWeight(value) {
  return (Number(value) || 0).toFixed(2);
}

export function calculateMarketValue(row, rates) {
  return roundMoney((Number(row.netWeight) || 0) * (Number(rates[row.purity]) || 0));
}

export function calculateRows(rows, rates) {
  return rows.map((row) => ({
    ...row,
    marketValue: row.marketManual ? Number(row.marketValue) || 0 : calculateMarketValue(row, rates),
  }));
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
