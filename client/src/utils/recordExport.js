function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function csvEscape(value) {
  const cell = text(value).replace(/"/g, '""');
  return /[",\n\r]/.test(cell) ? `"${cell}"` : cell;
}

function recordRows(records) {
  return records.map((record, index) => {
    const payload = record.payload || {};
    const shop = payload.shop || {};
    const form = payload.form || {};
    const summaries = payload.summaries || [];
    return {
      'S.No.': index + 1,
      'Date': record.date || form.date || '',
      'Ref No.': record.refNo || form.refNo || '',
      'Borrower Name': record.borrowerName || form.borrowerName || '',
      'Father / Husband Name': form.fatherName || '',
      'Resident': form.borrowerAddress || '',
      'Shop Name': shop.nameHindi || '',
      'Shop Address': shop.addressHindi || '',
      'Registration No.': shop.registrationNo || '',
      'Bank A/c No.': form.bankAccount || '',
      'Appraiser A/c No.': shop.appraiserAccount || '',
      'Branch Name': form.branchName || '',
      'Appraisal Charge (Rs.)': form.appraisalCharge ?? '',
      'Total Market Value (Rs.)': record.totalMarketValue ?? payload.totals?.marketValue ?? '',
      'Purity': summaries.map((summary) => summary.purity).filter(Boolean).join(', '),
      'Appraisal Date': form.appraisalDate || '',
      'Cash-in-charge': form.cashInCharge || '',
      'Testing Method': form.testingMethod || '',
      'Place': form.place || '',
      'Signature Date': form.signatureDate || '',
    };
  });
}

function downloadFile(content, fileName, mimeType) {
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

export function exportRecordsCsv(records) {
  const rows = recordRows(records);
  const headers = Object.keys(rows[0] || {
    'S.No.': '',
    'Date': '',
    'Ref No.': '',
    'Borrower Name': '',
  });
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(csvEscape).join(','))
    .join('\r\n');
  downloadFile(`\uFEFF${csv}`, `kanhaiya-gold-records-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
}

function xmlEscape(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportRecordsExcel(records) {
  const rows = recordRows(records);
  const headers = Object.keys(rows[0] || {
    'S.No.': '',
    'Date': '',
    'Ref No.': '',
    'Borrower Name': '',
  });
  const xmlRows = [
    `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join('')}</Row>`,
    ...rows.map((row) => `<Row>${headers.map((header) => {
      const value = row[header];
      const numeric = value !== '' && value !== null && value !== undefined && /^-?\d+(\.\d+)?$/.test(String(value));
      return `<Cell><Data ss:Type="${numeric ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`;
    }).join('')}</Row>`),
  ].join('');

  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="Records"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
  downloadFile(workbook, `kanhaiya-gold-records-${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel;charset=utf-8');
}
