const OFFICIAL_BENCHMARK_SOURCE = 'https://www.ibjarates.com/';
const OFFICIAL_RETAIL_SOURCE = 'https://ibja.co/';

function clean(value) {
  return Number(String(value).replace(/[^0-9.]/g, ''));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#8377;|₹/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBenchmarkPage(html) {
  const text = stripHtml(html);
  const rates = {};
  const latestDate = text.match(/Previous Dates Rate[\s\S]{0,300}?(\d{2}\/\d{2}\/\d{4})/i)?.[1] || null;

  // Current/previous benchmark table commonly appears as:
  // Gold 999  | AM | PM ... or as flattened text without separators.
  const rowPattern = /Gold\s+(999|995|916|750|585)\s+([0-9,]+)\s+([0-9,]*)/gi;
  let match;
  while ((match = rowPattern.exec(text))) {
    const purity = match[1];
    const pm = clean(match[3]);
    if (Number.isFinite(pm) && pm > 0) rates[purity] = pm / 10;
  }

  // If today's PM column is blank (e.g. weekend), use the first published
  // row under Previous Dates Rate, which is the latest available business day.
  if (Object.keys(rates).length < 4) {
    const previousIndex = text.search(/Previous Dates Rate/i);
    const previousText = previousIndex >= 0 ? text.slice(previousIndex) : '';
    const previousRowPattern = /(\d{2}\/\d{2}\/\d{4})\s+([0-9,]+)\s+([0-9,]+)\s+([0-9,]+)\s+([0-9,]+)\s+([0-9,]+)/;
    const previous = previousText.match(previousRowPattern);
    if (previous) {
      rates['999'] = clean(previous[2]) / 10;
      rates['995'] = clean(previous[3]) / 10;
      rates['916'] = clean(previous[4]) / 10;
      rates['750'] = clean(previous[5]) / 10;
      rates['585'] = clean(previous[6]) / 10;
    }
  }

  if (rates['999'] && rates['916'] && rates['750'] && rates['585']) {
    return {
      source: 'IBJA',
      sourceUrl: OFFICIAL_BENCHMARK_SOURCE,
      market: 'India benchmark',
      rateType: 'PM / latest published business day',
      rateDate: latestDate,
      unit: 'INR/gm',
      rates: {
        '24 Ct': Number(rates['999'].toFixed(2)),
        '22 Ct': Number(rates['916'].toFixed(2)),
        '20 Ct': Number((rates['999'] * (833 / 999)).toFixed(2)),
        '18 Ct': Number(rates['750'].toFixed(2)),
        '14 Ct': Number(rates['585'].toFixed(2)),
      },
      derived: ['20 Ct'],
      note: 'IBJA benchmark rates are published per 10gm; the app converts them to INR/gm. Rates exclude GST and making charges.',
    };
  }

  return null;
}

function parseRetailPage(html) {
  const text = stripHtml(html);
  const patterns = {
    '24 Ct': /Fine Gold\s*\(999\)\s*:\s*([0-9,]+(?:\.\d+)?)/i,
    '22 Ct': /22\s*KT\s*:\s*([0-9,]+(?:\.\d+)?)/i,
    '20 Ct': /20\s*KT\s*:\s*([0-9,]+(?:\.\d+)?)/i,
    '18 Ct': /18\s*KT\s*:\s*([0-9,]+(?:\.\d+)?)/i,
    '14 Ct': /14\s*KT\s*:\s*([0-9,]+(?:\.\d+)?)/i,
  };

  const rates = {};
  for (const [purity, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match) rates[purity] = clean(match[1]);
  }

  if (Object.keys(rates).length < 5) return null;

  const date = text.match(/Indicative Retail selling Rates for Gold Jewellery\s*\(AM\)\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || null;
  return {
    source: 'IBJA',
    sourceUrl: OFFICIAL_RETAIL_SOURCE,
    market: 'India indicative jewellery rate',
    rateType: 'AM retail indicative',
    rateDate: date,
    unit: 'INR/gm',
    rates,
    derived: [],
    note: 'IBJA indicative jewellery rates are per gram and exclude GST and making charges.',
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Kanhaiya-Gold-Appraiser/1.0',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function getMarketRates(_req, res) {
  try {
    const results = await Promise.allSettled([
      fetchHtml(OFFICIAL_BENCHMARK_SOURCE).then(parseBenchmarkPage),
      fetchHtml(OFFICIAL_RETAIL_SOURCE).then(parseRetailPage),
    ]);

    const benchmark = results[0].status === 'fulfilled' ? results[0].value : null;
    const retail = results[1].status === 'fulfilled' ? results[1].value : null;
    const result = benchmark || retail;

    if (!result) {
      const details = results
        .map((item) => item.status === 'rejected' ? item.reason?.message : 'page structure not matched')
        .join(' | ');
      throw new Error(`Could not read current IBJA rates. ${details}`);
    }

    res.json({ ...result, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('IBJA market-rate sync failed:', error);
    res.status(502).json({
      message: 'Could not sync the latest IBJA benchmark rate.',
      source: 'IBJA',
      sourceUrl: OFFICIAL_BENCHMARK_SOURCE,
      detail: error.message,
    });
  }
}
