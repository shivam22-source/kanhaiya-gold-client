const OFFICIAL_SOURCE = 'https://www.ibja.co/';
const SOURCE_RATES_PAGE = 'https://www.ibjarates.com/';

function extractRate(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*:\\s*(?:₹|&#8377;|Rs\\.?\\s*)?([0-9,]+(?:\\.[0-9]+)?)`, 'i');
  const match = html.match(pattern);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export async function getMarketRates(_req, res) {
  try {
    const response = await fetch(OFFICIAL_SOURCE, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Kanhaiya-Gold-Appraiser/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`IBJA public rates page returned HTTP ${response.status}`);
    }

    const html = await response.text();
    const rates = {
      '24 Ct': extractRate(html, 'Fine Gold (999)'),
      '22 Ct': extractRate(html, '22 KT'),
      '20 Ct': extractRate(html, '20 KT'),
      '18 Ct': extractRate(html, '18 KT'),
      '14 Ct': extractRate(html, '14 KT'),
    };

    const missing = Object.entries(rates).filter(([, value]) => value == null).map(([key]) => key);
    if (missing.length) {
      throw new Error(`Could not read IBJA public rates for: ${missing.join(', ')}`);
    }

    res.json({
      source: 'IBJA',
      sourceUrl: OFFICIAL_SOURCE,
      ratesUrl: SOURCE_RATES_PAGE,
      market: 'India benchmark',
      rateType: 'Indicative Retail Selling Rates for Gold Jewellery (AM)',
      unit: 'INR/gm',
      fetchedAt: new Date().toISOString(),
      rates,
      note: 'Rates shown by IBJA are per gram and exclude 3% GST and making charges.',
    });
  } catch (error) {
    console.error('IBJA public market-rate sync failed:', error);
    res.status(502).json({
      message: 'Could not sync the latest IBJA public rate.',
      source: 'IBJA',
      sourceUrl: OFFICIAL_SOURCE,
      ratesUrl: SOURCE_RATES_PAGE,
      detail: error.message,
    });
  }
}
