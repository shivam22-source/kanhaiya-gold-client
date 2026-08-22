import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney, formatWeight } from './calculations';
import { numberToWordsIndian } from './numberToWordsIndian';

const pageWidth = 210;
const pageHeight = 297;
const margin = 12;
const contentWidth = pageWidth - margin * 2;

function safeText(value) {
  return String(value || '').trim();
}

function dateText(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function purityText(value) {
  return safeText(value).replace(/\s*Ct$/i, '');
}

function setFont(doc, style = 'normal', size = 9.2) {
  doc.setFont('times', style);
  doc.setFontSize(size);
}

function drawWrapped(doc, text, x, y, width, lineHeight = 4.2) {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawCenteredCellText(doc, text, x, y, width, height, style = 'normal', size = 8.4) {
  setFont(doc, style, size);
  const lines = doc.splitTextToSize(String(text), width - 4);
  const startY = y + height / 2 - ((lines.length - 1) * 3.2) / 2 + 1.1;
  doc.text(lines, x + width / 2, startY, { align: 'center' });
}

function drawLeftCellText(doc, text, x, y, height, style = 'normal', size = 8.4) {
  setFont(doc, style, size);
  doc.text(String(text), x + 2, y + height / 2 + 1.1);
}

function drawSummaryBlock(doc, y, summaries, totals) {
  const x = margin;
  const w = contentWidth;
  const rows = { amount: 10, label: 7, purity: 8, value: 8 };
  const totalHeight = rows.amount + rows.label + rows.purity + rows.value + rows.label + rows.purity + rows.value;
  const amountLabelW = 42;
  const roundLabelW = 28;
  const amountValueW = 29;
  const wordsW = w - amountLabelW - roundLabelW - amountValueW;
  const summaryCount = Math.max(summaries.length, 1);
  const summaryW = w / summaryCount;
  const lineYs = [
    y,
    y + rows.amount,
    y + rows.amount + rows.label,
    y + rows.amount + rows.label + rows.purity,
    y + rows.amount + rows.label + rows.purity + rows.value,
    y + rows.amount + rows.label + rows.purity + rows.value + rows.label,
    y + rows.amount + rows.label + rows.purity + rows.value + rows.label + rows.purity,
    y + totalHeight,
  ];

  doc.setDrawColor(20);
  doc.setLineWidth(0.18);
  doc.rect(x, y, w, totalHeight);
  lineYs.slice(1, -1).forEach((lineY) => doc.line(x, lineY, x + w, lineY));
  doc.line(x + amountLabelW, y, x + amountLabelW, y + rows.amount);
  doc.line(x + amountLabelW + wordsW, y, x + amountLabelW + wordsW, y + rows.amount);
  doc.line(x + amountLabelW + wordsW + roundLabelW, y, x + amountLabelW + wordsW + roundLabelW, y + rows.amount);

  const grossPurityY = lineYs[2];
  const grossValueY = lineYs[3];
  const netPurityY = lineYs[5];
  const netValueY = lineYs[6];
  for (let index = 1; index < summaryCount; index += 1) {
    const lineX = x + summaryW * index;
    doc.line(lineX, grossPurityY, lineX, grossValueY + rows.value);
    doc.line(lineX, netPurityY, lineX, netValueY + rows.value);
  }

  drawLeftCellText(doc, 'Amount (In Words)', x, y, rows.amount, 'bold', 8.2);
  drawCenteredCellText(doc, numberToWordsIndian(totals.marketValue), x + amountLabelW, y, wordsW, rows.amount, 'normal', 8.2);
  drawCenteredCellText(doc, 'Round Up', x + amountLabelW + wordsW, y, roundLabelW, rows.amount, 'bold', 8.2);
  drawCenteredCellText(doc, formatMoney(totals.marketValue), x + amountLabelW + wordsW + roundLabelW, y, amountValueW, rows.amount, 'bold', 8.2);

  drawLeftCellText(doc, 'Gross Weight Carat Summary:', x, lineYs[1], rows.label, 'bold', 8.2);
  summaries.forEach((summary, index) => {
    const cellX = x + summaryW * index;
    drawCenteredCellText(doc, `${purityText(summary.purity)} Ct`, cellX, grossPurityY, summaryW, rows.purity, 'normal', 8.2);
    drawCenteredCellText(doc, `${formatWeight(summary.grossWeight)} gm`, cellX, grossValueY, summaryW, rows.value, 'normal', 8.2);
  });

  drawLeftCellText(doc, 'Net weight summary :', x, lineYs[4], rows.label, 'bold', 8.2);
  summaries.forEach((summary, index) => {
    const cellX = x + summaryW * index;
    drawCenteredCellText(doc, `${purityText(summary.purity)} Ct`, cellX, netPurityY, summaryW, rows.purity, 'normal', 8.2);
    drawCenteredCellText(doc, `${formatWeight(summary.netWeight)} gm`, cellX, netValueY, summaryW, rows.value, 'normal', 8.2);
  });
  return y + totalHeight;
}

function createShopHeaderImage(shop) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 260;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 92px "Noto Sans Devanagari", Mangal, Arial, sans-serif';
  ctx.fillText(safeText(shop.nameHindi) || 'कन्हैया ज्वेलर्स', canvas.width / 2, 78);
  ctx.font = '900 50px "Noto Sans Devanagari", Mangal, Arial, sans-serif';
  ctx.fillText(safeText(shop.addressHindi) || 'देकदार बाजार', canvas.width / 2, 142);
  ctx.font = '900 25px "Noto Sans Devanagari", Mangal, Arial, sans-serif';
  ctx.fillText(safeText(shop.registrationNo) || 'उद्यम रजि० नं०--BR-10-0038338', canvas.width / 2, 202);
  return canvas.toDataURL('image/png');
}

function imageType(dataUrl) {
  return dataUrl?.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

export async function generateCertificatePdf(data, options = {}) {
  const { save = true } = options;
  const { shop, form, rows, customColumns, totals, summaries } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  doc.setDrawColor(20);
  doc.setLineWidth(0.15);
  doc.rect(4, 3, pageWidth - 8, pageHeight - 6);

  setFont(doc, 'normal', 9);
  doc.text('Annexure: PL-61(i)', margin + 2, 17);
  doc.text(`Ref :- ${safeText(form.refNo) || '-----------------------------'}`, margin + 2, 29);
  doc.text(`Appraised Charge :- ${formatMoney(form.appraisalCharge) || '------------------------'}`, margin + 2, 37);

  const headerImage = createShopHeaderImage(shop);
  doc.addImage(headerImage, 'PNG', 63, 6, 84, 24.3);
  doc.text(`Date :- ${dateText(form.date) || '------------------------'}`, pageWidth - margin - 36, 17);

  const qrX = pageWidth - margin - 20;
  const qrY = 20;
  const qrSize = 24;
  doc.setDrawColor(160);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.rect(qrX, qrY, qrSize, qrSize);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(20);
  if (shop.qrImage) {
    doc.addImage(shop.qrImage, imageType(shop.qrImage), qrX + 1, qrY + 1, qrSize - 2, qrSize - 2);
  } else {
    setFont(doc, 'normal', 7);
    doc.setTextColor(190);
    doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2 + 1, { align: 'center' });
    doc.setTextColor(20);
  }

  setFont(doc, 'bold', 13);
  doc.text('APPRAISER CERTIFICATE', pageWidth / 2, 50, { align: 'center' });
  doc.line(74, 52, 136, 52);

  let y = 60;
  setFont(doc, 'normal', 9.5);
  doc.text('The Branch Manager', margin, y);
  y += 5;
  doc.text('State Bank Of India', margin, y);
  doc.text(`A/c No.: ${safeText(form.bankAccount)}`, pageWidth - margin, y, { align: 'right' });
  y += 5;
  doc.text(safeText(form.branchName), margin, y);
  y += 7;
  doc.text('Dear Sir,', margin, y);
  y += 7;

  const declarationOne = `I hereby certify that Sri/Smt. ${safeText(form.borrowerName)} S/W/D of ${safeText(form.fatherName)} Resident of ${safeText(form.borrowerAddress)} who has sought gold loan from the bank is not my relative and the gold against which the loan is sought is not purchased from me. The ornaments/coins have been weighted and appraised by me on ${dateText(form.appraisalDate)} in the presence of Sri/Smt. ${safeText(form.cashInCharge)} (Cash in charge) and the exact weight, purity and market value are indicated below:`;
  y = drawWrapped(doc, declarationOne, margin, y, contentWidth, 4.2) + 3;

  const head = [[
    'Sl No.',
    'Description of the Article',
    'No. of Article\n(units)',
    'Approximate weight of the precious stones in the ornaments\n(Grams)',
    'Gross Weight\n(Gram)',
    'Net Weight\n(Gram)',
    'Purity\n(Carat)',
    ...customColumns.map((column) => column.label),
    'Market Value\n(Rs.)',
  ]];

  const body = rows.map((row, index) => [
    index + 1,
    row.description,
    row.units,
    formatWeight(row.stoneWeight),
    formatWeight(row.grossWeight),
    formatWeight(row.netWeight),
    purityText(row.purity),
    ...customColumns.map((column) => row.customValues?.[column.id] || ''),
    formatMoney(row.marketValue),
  ]);

  body.push([
    'Total',
    '',
    totals.units,
    formatWeight(totals.stoneWeight),
    formatWeight(totals.grossWeight),
    formatWeight(totals.netWeight),
    '',
    ...customColumns.map(() => ''),
    formatMoney(totals.marketValue),
  ]);

  const hasCustomColumns = customColumns.length > 0;
  const columnStyles = {
    0: { cellWidth: 9, halign: 'center' },
    1: { cellWidth: hasCustomColumns ? 30 : 38 },
    2: { cellWidth: 15, halign: 'right' },
    3: { cellWidth: 31, halign: 'right' },
    4: { cellWidth: 19, halign: 'right' },
    5: { cellWidth: 19, halign: 'right' },
    6: { cellWidth: 16, halign: 'center' },
  };
  customColumns.forEach((_, index) => {
    columnStyles[7 + index] = { cellWidth: 17 };
  });
  columnStyles[7 + customColumns.length] = { cellWidth: hasCustomColumns ? 25 : 39, halign: 'right' };

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      font: 'times',
      fontSize: 7.5,
      textColor: 20,
      lineColor: 25,
      lineWidth: 0.12,
      cellPadding: { top: 1.4, right: 1.2, bottom: 1.4, left: 1.2 },
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 20,
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 16,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      minCellHeight: 5.3,
    },
    columnStyles,
    didParseCell: (hookData) => {
      if (hookData.row.index === body.length - 1) hookData.cell.styles.fontStyle = 'bold';
    },
  });

  y = drawSummaryBlock(doc, doc.lastAutoTable.finalY + 4, summaries, totals) + 6;

  const declarationTwo = 'I solemnly declare that weight, purity of the gold ornaments/precious stones indicated above are correct and I undertake to indemnify the Bank against any loss it may sustain on account of any inaccuracy in the above appraisal.';
  y = drawWrapped(doc, declarationTwo, margin, y, contentWidth, 4.2) + 6;

  const bottomY = Math.max(y + 8, 264);
  setFont(doc, 'normal', 12);
  doc.text(`Place: ${safeText(form.place)}`, margin + 2, bottomY);
  doc.text(`Date: ${dateText(form.signatureDate)}`, margin + 2, bottomY + 7);
  setFont(doc, 'normal', 12);
  doc.text('Yours faithfully', pageWidth - margin - 2, bottomY, { align: 'right' });
  setFont(doc, 'bold', 11.5);
  doc.text('Name & Signature of the Appraiser', pageWidth - margin - 2, bottomY + 15, { align: 'right' });
  doc.text('Name & Signature of the Borrower', margin + 2, bottomY + 25);

  setFont(doc, 'normal', 9.5);
  doc.text(safeText(shop.footerCredit), pageWidth - margin - 2, pageHeight - 11, { align: 'right' });

  const filenameName = safeText(form.borrowerName).replace(/\s+/g, '_') || 'Borrower';
  const filenameDate = safeText(form.date) || new Date().toISOString().slice(0, 10);
  const filename = `AppraiserCertificate_${filenameName}_${filenameDate}.pdf`;
  const blob = doc.output('blob');
  if (save) doc.save(filename);
  return { blob, filename };
}
