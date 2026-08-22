const belowTwenty = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underHundred(num) {
  if (num < 20) return belowTwenty[num];
  const unit = belowTwenty[num % 10];
  return unit ? `${tens[Math.floor(num / 10)]}-${unit.toLowerCase()}` : tens[Math.floor(num / 10)];
}

function underThousand(num) {
  const hundred = Math.floor(num / 100);
  const rest = num % 100;
  return [hundred ? `${belowTwenty[hundred]} Hundred` : '', rest ? underHundred(rest) : '']
    .filter(Boolean)
    .join(' ');
}

export function numberToWordsIndian(value) {
  const whole = Math.floor(Number(value) || 0);
  if (whole === 0) return 'Zero Only';

  const groups = [
    { label: 'Crore', value: Math.floor(whole / 10000000) },
    { label: 'Lakh', value: Math.floor((whole % 10000000) / 100000) },
    { label: 'Thousand', value: Math.floor((whole % 100000) / 1000) },
    { label: '', value: whole % 1000 },
  ];

  const words = groups
    .filter((group) => group.value > 0)
    .map((group) => [underThousand(group.value), group.label].filter(Boolean).join(' '))
    .join(' ');

  return `${words} Only`;
}
