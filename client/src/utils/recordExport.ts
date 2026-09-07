export interface CertificateRecord {
  id?: string;
  date?: string;
  refNo?: string;
  borrowerName?: string;
  totalMarketValue?: number | string;
  payload?: {
    shop?: {
      nameHindi?: string;
      addressHindi?: string;
      registrationNo?: string;
      appraiserAccount?: string;
    };
    form?: {
      date?: string;
      refNo?: string;
      borrowerName?: string;
      fatherName?: string;
      borrowerAddress?: string;
      bankAccount?: string;
      appraisalCharge?: number | string;
      branchName?: string;
      appraisalDate?: string;
      cashInCharge?: string;
      testingMethod?: string;
      place?: string;
      signatureDate?: string;
    };
    summaries?: Array<{ purity?: string }>;
    totals?: { marketValue?: number | string };
  };
}

type ExportRow = Record<string, string | number>;

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function csvEscape(value: unknown): string {
  const cell = text(value).replace(/"/g, '""');
  return /[",\n\r]/.test(cell) ? `"${cell}"` : cell;
}

function recordRows(records: CertificateRecord[]): ExportRow[] {
  return records.map((record, index) => {
    const payload = record.payload || {};
    const shop = payload.shop || {};
    const form = payload.form || {};
    const summaries = payload.summaries || [];
    return {
      'S.No.': index + 1,
      Date: record.date || form.date || '',
      'Ref No.': record.refNo || form.refNo || '',
      'Borrower Name': record.borrowerName || form.borrowerName || '',
      'Father / Husband Name': form.fatherName || '',
      Resident: form.borrowerAddress || '',
      'Shop Name': shop.nameHindi || '',
      'Shop Address': shop.addressHindi || '',
      'Registration No.': shop.registrationNo || '',
      'Bank A/c No.': form.bankAccount || '',
      'Appraiser A/c No.': shop.appraiserAccount || '',
      'Branch Name': form.branchName || '',
      'Appraisal Charge (Rs.)': form.appraisalCharge ?? '',
      'Total Market Value (Rs.)': record.totalMarketValue ?? payload.totals?.marketValue ?? '',
      Purity: summaries.map((summary) => summary.purity).filter(Boolean).join(', '),
      'Appraisal Date': form.appraisalDate || '',
      'Cash-in-charge': form.cashInCharge || '',
      'Testing Method': form.testingMethod || '',
      Place: form.place || '',
      'Signature Date': form.signatureDate || '',
    };
  });
}

function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRecordsCsv(records: CertificateRecord[]): void {
  const rows = recordRows(records);
  const headers = Object.keys(rows[0] || { 'S.No.': '', Date: '', 'Ref No.': '', 'Borrower Name': '' });
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(csvEscape).join(','))
    .join('\r\n');
  downloadFile(`\uFEFF${csv}`, `kanhaiya-gold-records-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
}

function xmlEscape(value: unknown): string {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportRecordsExcel(records: CertificateRecord[]): void {
  const rows = recordRows(records);
  const headers = Object.keys(rows[0] || { 'S.No.': '', Date: '', 'Ref No.': '', 'Borrower Name': '' });
  const xmlRows = [
    `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join('')}</Row>`,
    ...rows.map((row) => `<Row>${headers.map((header) => {
      const value = row[header];
      const numeric = value !== '' && value !== null && value !== undefined && /^-?\d+(\.\d+)?$/.test(String(value));
      return `<Cell><Data ss:Type="${numeric ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`;
    }).join('')}</Row>`),
  ].join('');

  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Worksheet ss:Name="Records"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
  downloadFile(workbook, `kanhaiya-gold-records-${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel;charset=utf-8');
}
