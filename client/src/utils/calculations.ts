export const PURITIES = ['9 Ct', '14 Ct', '18 Ct', '20 Ct', '22 Ct', '23 Ct', '24 Ct'] as const;

export type Purity = (typeof PURITIES)[number];

export const PURITY_PERCENTAGES: Record<Purity, number> = {
  '9 Ct': 0.37,
  '14 Ct': 0.585,
  '18 Ct': 0.75,
  '20 Ct': 0.833,
  '22 Ct': 0.916,
  '23 Ct': 0.9583,
  '24 Ct': 1,
};

export const DEFAULT_BASE_RATE_24CT = 14200;

export interface AppraisalRow {
  id?: string;
  sl?: number;
  description: string;
  units: number | string;
  stoneWeight: number | string;
  grossWeight: number | string;
  netWeight?: number | string;
  purity: Purity | string;
  marketValue?: number | string;
  marketManual?: boolean;
  customValues?: Record<string, string>;
}

export interface CalculatedRow extends AppraisalRow {
  netWeight: number;
  marketValue: number;
}

export interface Totals {
  units: number;
  stoneWeight: number;
  grossWeight: number;
  netWeight: number;
  marketValue: number;
}

export interface PuritySummary {
  purity: string;
  grossWeight: number;
  netWeight: number;
}

export type Rates = Record<string, number>;

export function roundMoney(value: number | string | null | undefined): number {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
}

export function deriveRatesFromBaseRate(baseRate24ct: number | string): Rates {
  const base = Number(baseRate24ct) || 0;
  return Object.fromEntries(
    Object.entries(PURITY_PERCENTAGES).map(([purity, percentage]) => [purity, roundMoney(base * percentage)]),
  );
}

export const DEFAULT_RATES = deriveRatesFromBaseRate(DEFAULT_BASE_RATE_24CT);

export function formatMoney(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatWeight(value: number | string | null | undefined): string {
  return (Number(value) || 0).toFixed(2);
}

export function calculateNetWeight(row: Pick<AppraisalRow, 'grossWeight' | 'stoneWeight'>): number {
  const net = (Number(row.grossWeight) || 0) - (Number(row.stoneWeight) || 0);
  return roundMoney(Math.max(0, net));
}

export function calculateMarketValue(
  row: Pick<AppraisalRow, 'units' | 'netWeight' | 'purity'>,
  rates: Rates,
): number {
  const units = Number(row.units) || 0;
  const netWeight = Number(row.netWeight) || 0;
  const rate = Number(rates[row.purity]) || 0;

  return roundMoney(units * netWeight * rate);
}

export function calculateRows(rows: AppraisalRow[], rates: Rates): CalculatedRow[] {
  return rows.map((row) => {
    const netWeight = calculateNetWeight(row);
    return {
      ...row,
      netWeight,
      marketValue: row.marketManual ? Number(row.marketValue) || 0 : calculateMarketValue({ ...row, netWeight }, rates),
    };
  });
}

export function calculateTotals(rows: CalculatedRow[]): Totals {
  return rows.reduce<Totals>(
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

export function groupPuritySummaries(rows: AppraisalRow[]): PuritySummary[] {
  const summary = new Map<string, PuritySummary>();

  rows.forEach((row) => {
    if (!row.purity) return;
    const current = summary.get(row.purity) || { purity: row.purity, grossWeight: 0, netWeight: 0 };
    current.grossWeight += Number(row.grossWeight) || 0;
    current.netWeight += Number(row.netWeight) || 0;
    summary.set(row.purity, current);
  });

  return Array.from(summary.values());
}
