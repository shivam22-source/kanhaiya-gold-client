const STORAGE_KEY = 'sbi-gold-appraiser-shop-settings';
const APPRAISER_ACCOUNT = '43354212640';

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  const shop = saved ? JSON.parse(saved) : {};
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...shop, appraiserAccount: APPRAISER_ACCOUNT }),
  );
} catch {
  // Ignore local storage failures; the PDF helper has its own fallback.
}
