import PDFDocument from 'pdfkit';
import type { Quote } from './types.js';

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(value);
}

export function generateQuotePdf(quote: Quote, quoteId: string, contractorName: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 52 });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.font('Helvetica-Bold').fontSize(23).fillColor('#17231f').text(contractorName);
    document.moveDown(0.35);
    document.font('Helvetica').fontSize(11).fillColor('#737a70').text(`Quote #${quoteId}`);
    document.moveDown(1.5);
    document.font('Helvetica-Bold').fontSize(12).fillColor('#17231f').text('Job description');
    document.moveDown(0.35);
    document.font('Helvetica').fontSize(11).fillColor('#3b443b').text(quote.jobDescription, { lineGap: 3 });
    document.moveDown(1.4);
    document.font('Helvetica-Bold').fontSize(9).fillColor('#737a70');
    document.text('DESCRIPTION', 52, document.y, { continued: true, width: 285 });
    document.text('QTY', { continued: true, width: 45, align: 'right' });
    document.text('UNIT PRICE', { continued: true, width: 82, align: 'right' });
    document.text('TOTAL', { width: 80, align: 'right' });
    document.moveDown(0.5);
    document.moveTo(52, document.y).lineTo(543, document.y).strokeColor('#dfe1d7').stroke();
    document.moveDown(0.55);

    for (const item of quote.lineItems) {
      const y = document.y;
      document.font('Helvetica').fontSize(10).fillColor('#17231f').text(item.description, 52, y, { width: 285 });
      document.text(String(item.quantity), 337, y, { width: 45, align: 'right' });
      document.text(money(item.unitPrice, quote.currency), 382, y, { width: 82, align: 'right' });
      document.text(money(item.total, quote.currency), 464, y, { width: 79, align: 'right' });
      document.moveDown(1.2);
      document.moveTo(52, document.y).lineTo(543, document.y).strokeColor('#ededeb').stroke();
      document.moveDown(0.55);
    }

    document.moveDown(0.7);
    const totalX = 375;
    const totalWidth = 168;
    const writeTotal = (label: string, value: string, bold = false) => {
      document.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor('#17231f');
      document.text(label, totalX, document.y, { continued: true, width: totalWidth - 80 });
      document.text(value, { width: 80, align: 'right' });
      document.moveDown(0.65);
    };
    writeTotal('Subtotal', money(quote.subtotal, quote.currency));
    writeTotal('Tax', money(quote.tax, quote.currency));
    writeTotal('Total', money(quote.total, quote.currency), true);

    if (quote.notes) {
      document.moveDown(1);
      document.font('Helvetica-Bold').fontSize(10).fillColor('#17231f').text('Notes');
      document.moveDown(0.35);
      document.font('Helvetica').fontSize(10).fillColor('#525b51').text(quote.notes, { lineGap: 2 });
    }

    document.moveDown(2);
    document.font('Helvetica').fontSize(9).fillColor('#8a9087')
      .text('This quote was generated from a voice description. Pricing may be an estimate; confirm the scope before work begins.');
    document.moveDown(0.5);
    document.font('Helvetica-Bold').fillColor('#17231f').text('Sent via Quotely');
    document.end();
  });
}
