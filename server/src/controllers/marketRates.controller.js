const OFFICIAL_SOURCE = 'https://www.ibjarates.com/';

function extractPmRates(html) {
  const normalize = (value) => Number(String(value).replace(/[^0-9.]/g, ''));
  const rates = {};
  const tablePattern = /Gold\s+(999|916|750|585)\s*\|?\s*([0-9,.]+)\s*\|\s*([0-9,.]+)/gi;
  let match;

  while ((match = tablePattern.exec(html))) {
    const purity = match[1];
    const pmPer10g = normalize(match[3]);
    if (Number.isFinite(pmPer10g)) rates[purity] = pmPer10g / 10;
  }

  if (!Object.keys(rates).length) {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ');
    const textPattern = /Gold\s+(999|916|750|585)\s+([0-9,.]+)\s+([0-9,.]+)/gi;
    while ((match = textPattern.exec(text))) {
      const purity = match[1];
      const pmPer10g = normalize(match[3]);
      if (Number.isFinite(pmPer10g)) rates[purity] = pmPer10g / 10;
    }
  }

  if (!rates['999'] && !rates['916'] && !rates['750'] && !rates['585']) {
    throw new Error('Could not read the current IBJA benchmark table');
  }

  // IBJA publicly publishes 999, 916, 750 and 585. 20 Ct is derived from
  // the 999 benchmark using 833/999 fineness and is explicitly labelled derived.
  if (rates['999'] && !rates['20']) {
    rates['20'] = Number((rates['999'] * (833 / 999)).toFixed(2));
  }

  return rates;
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

    if (!response.ok) throw new Error(`IBJA public page returned HTTP ${response.status}`);

    const html = await response.text();
    const raw = extractPmRates(html);

    res.json({
      source: 'IBJA',
      sourceUrl: OFFICIAL_SOURCE,
      market: 'India benchmark',
      rateType: 'PM',
      unit: 'INR/gm',
      fetchedAt: new Date().toISOString(),
      derived: ['20 Ct'],
      rates: {
        '24 Ct': raw['999'] ?? null,
        '22 Ct': raw['916'] ?? null,
        '20 Ct': raw['20'] ?? null,
        '18 Ct': raw['750'] ?? null,
        '14 Ct': raw['585'] ?? null,
      },
      note: 'IBJA publishes rates per 10gm; the app converts them to INR/gm. Rates exclude GST and making charges.',
    });
  } catch (error) {
    console.error('IBJA market-rate sync failed:', error);
    res.status(502).json({
      message: 'Could not sync the latest IBJA benchmark rate.',
      source: 'IBJA',
      sourceUrl: OFFICIAL_SOURCE,
      detail: error.message,
    });
  }
}
