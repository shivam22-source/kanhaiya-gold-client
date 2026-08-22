const OFFICIAL_SOURCE = 'https://www.ibjarates.com/';

function normalizeRates(payload) {
  const source = payload?.rates || payload?.data || payload;
  const pick = (keys) => {
    for (const key of keys) {
      if (source && source[key] != null) return Number(source[key]);
    }
    return null;
  };

  // Supports common API response shapes while keeping the app's purity names stable.
  const rates = {
    '24 Ct': pick(['24Ct', '24K', '999', 'gold999', 'gold_999']),
    '22 Ct': pick(['22Ct', '22K', '916', 'gold916', 'gold_916']),
    '20 Ct': pick(['20Ct', '20K', '833']),
    '18 Ct': pick(['18Ct', '18K', '750', 'gold750', 'gold_750']),
    '14 Ct': pick(['14Ct', '14K', '585', 'gold585', 'gold_585']),
  };

  // IBJA rates are commonly quoted per 10g on its benchmark site.
  const unit = String(payload?.unit || payload?.rateUnit || '').toLowerCase();
  if (unit.includes('10')) {
    Object.keys(rates).forEach((key) => {
      if (rates[key] != null) rates[key] = Number((rates[key] / 10).toFixed(2));
    });
  }

  if (rates['24 Ct'] == null && rates['22 Ct'] == null && rates['20 Ct'] == null && rates['18 Ct'] == null && rates['14 Ct'] == null) {
    throw new Error('IBJA API response could not be mapped to the app purities');
  }

  return rates;
}

export async function getMarketRates(_req, res) {
  const apiUrl = process.env.IBJA_RATES_API_URL;
  const apiKey = process.env.IBJA_RATES_API_KEY;

  if (!apiUrl || !apiKey) {
    return res.status(503).json({
      message: 'IBJA live sync is not configured yet.',
      source: 'IBJA',
      sourceUrl: OFFICIAL_SOURCE,
      configuration: 'Add IBJA_RATES_API_URL and IBJA_RATES_API_KEY to the backend environment.',
    });
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`IBJA API returned HTTP ${response.status}`);

    const payload = await response.json();
    const rates = normalizeRates(payload);

    res.json({
      source: 'IBJA',
      sourceUrl: OFFICIAL_SOURCE,
      market: 'India benchmark',
      rateType: payload?.rateType || payload?.session || 'Latest',
      unit: 'INR/gm',
      fetchedAt: new Date().toISOString(),
      rates,
    });
  } catch (error) {
    console.error('IBJA market-rate sync failed:', error);
    res.status(502).json({
      message: 'Could not sync the latest IBJA rate.',
      source: 'IBJA',
      sourceUrl: OFFICIAL_SOURCE,
      detail: error.message,
    });
  }
}
