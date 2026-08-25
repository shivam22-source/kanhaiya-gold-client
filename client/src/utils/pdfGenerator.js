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

function drawWrapped(doc, text, x, y, width, lineHeight = 4.2, size = 9.7) {
  setFont(doc, 'normal', size);
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawRichWrapped(doc, segments, x, y, width, lineHeight = 4.4, size = 10) {
  let cursorX = x;
  let cursorY = y;
  const maxX = x + width;

  segments.forEach(({ text, bold = false }) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    words.forEach((word) => {
      setFont(doc, bold ? 'bold' : 'normal', size);
      const prefix = cursorX === x ? '' : ' ';
      const token = `${prefix}${word}`;
      const tokenWidth = doc.getTextWidth(token);

      if (cursorX !== x && cursorX + tokenWidth > maxX) {
        cursorY += lineHeight;
        cursorX = x;
        setFont(doc, bold ? 'bold' : 'normal', size);
        doc.text(word, cursorX, cursorY);
        cursorX += doc.getTextWidth(word);
      } else {
        doc.text(token, cursorX, cursorY);
        cursorX += tokenWidth;
      }
    });
  });

  return cursorY + lineHeight;
}

function drawCenteredCellText(doc, text, x, y, width, height, style = 'normal', size = 8.6) {
  setFont(doc, style, size);
  const lines = doc.splitTextToSize(String(text), width - 4);
  const startY = y + height / 2 - ((lines.length - 1) * 3.0) / 2 + 1.0;
  doc.text(lines, x + width / 2, startY, { align: 'center' });
}

function drawLeftCellText(doc, text, x, y, height, style = 'normal', size = 8.6) {
  setFont(doc, style, size);
  doc.text(String(text), x + 2, y + height / 2 + 1.0);
}

/**
 * Summary block now wraps purity columns onto extra rows instead of
 * squeezing everything into one row. A minimum column width keeps
 * "22 Ct" / "150.03 gm" from overlapping or wrapping into the row above/below.
 */
function drawSummaryBlock(doc, y, summaries, totals) {
  const x = margin;
  const w = contentWidth;
  const rowH = { amount: 9, label: 6, purity: 7, value: 7 };

  const summaryCount = Math.max(summaries.length, 1);
  const minColWidth = 26; // mm — safe minimum so text never overlaps/wraps oddly
  const maxColsPerRow = Math.max(1, Math.min(summaryCount, Math.floor(w / minColWidth)));
  const numChunkRows = Math.ceil(summaryCount / maxColsPerRow);
  const colWidth = w / maxColsPerRow;
  const cellFontSize = maxColsPerRow >= 6 ? 7.4 : maxColsPerRow >= 4 ? 8.6 : 9.0;

  const sectionHeight = rowH.label + numChunkRows * (rowH.purity + rowH.value);
  const totalHeight = rowH.amount + sectionHeight * 2;

  const amountLabelW = 42;
  const roundLabelW = 28;
  const amountValueW = 29;
  const wordsW = w - amountLabelW - roundLabelW - amountValueW;

  doc.setDrawColor(20);
  doc.setLineWidth(0.18);
  doc.rect(x, y, w, totalHeight);

  doc.line(x + amountLabelW, y, x + amountLabelW, y + rowH.amount);
  doc.line(x + amountLabelW + wordsW, y, x + amountLabelW + wordsW, y + rowH.amount);
  doc.line(x + amountLabelW + wordsW + roundLabelW, y, x + amountLabelW + wordsW + roundLabelW, y + rowH.amount);

  drawLeftCellText(doc, 'Amount (In Words)', x, y, rowH.amount, 'bold', 8.5);
  drawCenteredCellText(doc, numberToWordsIndian(totals.marketValue), x + amountLabelW, y, wordsW, rowH.amount, 'normal', 8.5);
  drawCenteredCellText(doc, 'Round Up', x + amountLabelW + wordsW, y, roundLabelW, rowH.amount, 'bold', 8.5);
  drawCenteredCellText(doc, formatMoney(totals.marketValue), x + amountLabelW + wordsW + roundLabelW, y, amountValueW, rowH.amount, 'bold', 8.5);

  doc.line(x, y + rowH.amount, x + w, y + rowH.amount);

  function drawSection(label, sectionY, valueGetter) {
    drawLeftCellText(doc, label, x, sectionY, rowH.label, 'bold', 8.8);
    doc.line(x, sectionY + rowH.label, x + w, sectionY + rowH.label);

    let rowY = sectionY + rowH.label;
    for (let r = 0; r < numChunkRows; r += 1) {
      const purityY = rowY;
      const valueY = rowY + rowH.purity;
      const startIdx = r * maxColsPerRow;
      const endIdx = Math.min(startIdx + maxColsPerRow, summaryCount);
      const colsInRow = endIdx - startIdx;

      for (let i = startIdx; i < endIdx; i += 1) {
        const col = i - startIdx;
        const cellX = x + colWidth * col;
        const summary = summaries[i];
        if (!summary) continue;
        drawCenteredCellText(doc, `${purityText(summary.purity)} Ct`, cellX, purityY, colWidth, rowH.purity, 'normal', cellFontSize);
        drawCenteredCellText(doc, valueGetter(summary), cellX, valueY, colWidth, rowH.value, 'normal', cellFontSize);
      }

      for (let c = 1; c < colsInRow; c += 1) {
        const lineX = x + colWidth * c;
        doc.line(lineX, purityY, lineX, valueY + rowH.value);
      }

      doc.line(x, valueY, x + w, valueY);
      rowY += rowH.purity + rowH.value;
      if (r < numChunkRows - 1) doc.line(x, rowY, x + w, rowY);
    }
    return rowY;
  }

  let sectionY = y + rowH.amount;
  sectionY = drawSection('Gross Weight Carat Summary:', sectionY, (s) => `${formatWeight(s.grossWeight)} gm`);
  doc.line(x, sectionY, x + w, sectionY);
  drawSection('Net weight summary :', sectionY, (s) => `${formatWeight(s.netWeight)} gm`);

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
  ctx.fillText(safeText(shop.nameHindi) || 'कन्हैया ज्वेलर्स', canvas.width / 2, 72);
  ctx.font = '900 50px "Noto Sans Devanagari", Mangal, Arial, sans-serif';
  ctx.fillText(safeText(shop.addressHindi) || 'टेकटार बाजार', canvas.width / 2, 145);
  ctx.font = '900 25px "Noto Sans Devanagari", Mangal, Arial, sans-serif';
  ctx.fillText(safeText(shop.registrationNo) || 'उद्यम रजि० नं०--BR-10-0038338', canvas.width / 2, 205);

ctx.font = '28px Times New Roman';
ctx.fillText('Appraiser A/c No.:', 350, 232);

ctx.font = 'bold 28px Times New Roman';
ctx.fillText(safeText(shop.appraiserAccount), 540, 232);

  ctx.font = 'bold 22px Times New Roman, Arial, sans-serif';

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

  setFont(doc, 'normal', 9.8);
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

  let y = 59;
  setFont(doc, 'normal', 10);
  doc.text('The Branch Manager', margin, y);
  y += 4.5;

  doc.text('State Bank Of India', margin, y);
setFont(doc, 'normal', 9.2);

const accountLabel = 'A/c No.:';
const accountValue = safeText(form.bankAccount);

const accountLabelWidth = doc.getTextWidth(accountLabel);
const accountValueWidth = doc.getTextWidth(accountValue);
const totalWidth = accountLabelWidth + 1 + accountValueWidth;
const startX = pageWidth - margin - totalWidth;

doc.text(accountLabel, startX, y);

setFont(doc, 'bold', 9.2);
doc.text(accountValue, startX + accountLabelWidth + 1, y);

setFont(doc, 'bold', 10);

y += 4.5;

const branchName = safeText(form.branchName);
doc.text(branchName, margin, y);

const branchNameWidth = doc.getTextWidth(branchName);

setFont(doc, 'normal', 9.2);
doc.text(' branch', margin + branchNameWidth + 1, y);

y += 6;

doc.text('Dear Sir,', margin, y);

y += 5.5;

  y = drawRichWrapped(doc, [
    { text: 'I hereby certify that Sri/Smt.' },
    { text: ` ${safeText(form.borrowerName)}`, bold: true },
    { text: ' S/W/D of' },
    { text: ` ${safeText(form.fatherName)}`, bold: true },
    { text: ' Resident of' },
    { text: ` ${safeText(form.borrowerAddress)}`, bold: true },
    { text: ' who has sought gold loan from the bank is not my relative and the gold against which the loan is sought is not purchased from me. The ornaments/coins have been weighted and appraised by me on' },
    { text: ` ${dateText(form.appraisalDate)}`, bold: true },
    { text: ' in the presence of Sri/Smt.' },
    { text: ` ${safeText(form.cashInCharge)}`, bold: true },
    { text: ' (Cash in charge) and the exact weight, purity and market value are indicated below:' },
  ], margin, y, contentWidth, 4.5, 10.4)+2;

  const dataRowCount = rows.length;
  const bodyMinHeight = dataRowCount <= 2 ? 11 : dataRowCount <= 4 ? 8.5 : dataRowCount <= 7 ? 7 : 6.2;
  const preTableGap = dataRowCount <= 2 ? 6 : dataRowCount <= 4 ? 3.5 : 1.5;
  const postTableGap = dataRowCount <= 2 ? 7 : dataRowCount <= 4 ? 5 : 3;
  const postSummaryGap = dataRowCount <= 2 ? 8 : dataRowCount <= 4 ? 6 : 4;

  y += preTableGap;

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

  const tableRows = rows.slice(0, 8);

  const body = tableRows.map((row, index) => [
    index + 1,
    row.description,
    row.units,
    formatWeight(row.stoneWeight),
    formatWeight(row.grossWeight),
    formatWeight(row.netWeight),
   `${purityText(row.purity)} Ct`,
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
      fontSize: 9.5,
      textColor: 20,
      lineColor: 25,
      lineWidth: 0.12,
      cellPadding: { top: 1.2, right: 1.2, bottom: 1.2, left: 1.2 },
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 20,
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 15,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      minCellHeight: bodyMinHeight,
    },
    columnStyles,
    didParseCell: (hookData) => {
      if (hookData.row.index === body.length - 1) hookData.cell.styles.fontStyle = 'bold';
    },
  });

  y = drawSummaryBlock(doc, doc.lastAutoTable.finalY + postTableGap, summaries, totals) + postSummaryGap;

  y = drawRichWrapped(doc, [
    { text: 'Method used for purity testing: ', bold: true },
    { text: 'I solemnly declare that weight, purity of the gold ornaments/precious stones indicated above are correct and I undertake to indemnify the Bank against any loss it may sustain on account of any inaccuracy in the above appraisal.' },
  ], margin, y, contentWidth, 4.5, 10.0) + 2;

setFont(doc, 'normal', 9.2);

doc.text('Place:', margin + 2, 260);
const placeWidth = doc.getTextWidth('Place:');

setFont(doc, 'bold', 9.2);
doc.text(safeText(form.place), margin + 2 + placeWidth + 1, 260);

setFont(doc, 'normal', 9.2);

doc.text('Date:', margin + 2, 266);
const dateWidth = doc.getTextWidth('Date:');

setFont(doc, 'bold', 9.2);
doc.text(dateText(form.signatureDate), margin + 2 + dateWidth + 1, 266);

const bottomY = Math.max(y + 8, 235);
const rightX = pageWidth - margin - 2;
setFont(doc, 'bold', 11.2);
doc.text('Yours faithfully', rightX, bottomY + 8, { align: 'right' });

setFont(doc, 'bold', 11.2);
doc.text('Name & Signature of the Appraiser', rightX, bottomY + 16, { align: 'right' });



const footerY = pageHeight - 11;

setFont(doc, 'normal', 9.2);
doc.text(safeText(shop.footerCredit),pageWidth - margin - 2,footerY+2,{ align: 'right' },);

setFont(doc, 'bold', 11.2);
doc.text('Name & Signature of the Borrower', margin + 2, bottomY + 16);

  const filenameName = safeText(form.borrowerName).replace(/\s+/g, '_') || 'Borrower';
  const filenameDate = safeText(form.date) || new Date().toISOString().slice(0, 10);
  const filename = `AppraiserCertificate_${filenameName}_${filenameDate}.pdf`;
  const blob = doc.output('blob');
  if (save) doc.save(filename);
  return { blob, filename };
}