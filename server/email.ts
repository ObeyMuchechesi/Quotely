import type { Quote } from './types.js';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(value);
}

export async function sendQuoteEmail(values: {
  apiKey: string;
  from: string;
  contractorName: string;
  contractorEmail: string;
  customerName: string;
  customerEmail: string;
  quote: Quote;
  quoteId: string;
  pdf: Buffer;
}) {
  const contractorName = escapeHtml(values.contractorName);
  const customerName = escapeHtml(values.customerName);
  const items = values.quote.lineItems.map((item) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${escapeHtml(item.description)}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #eee;">${item.quantity}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #eee;">${money(item.total, values.quote.currency)}</td>
    </tr>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#17231f;">
      <h2>Your quote from ${contractorName}</h2>
      <p>Hi ${customerName},</p>
      <p>Thanks for reaching out. Here is your quote (<strong>#${escapeHtml(values.quoteId)}</strong>):</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #17231f;">Item</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #17231f;">Qty</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #17231f;">Total</th>
        </tr></thead>
        <tbody>${items}</tbody>
      </table>
      <p style="text-align:right;font-size:18px;font-weight:bold;">Total: ${money(values.quote.total, values.quote.currency)}</p>
      ${values.quote.notes ? `<p><strong>Notes:</strong> ${escapeHtml(values.quote.notes)}</p>` : ''}
      <p>The full PDF is attached for your records. Reply to this email if you have any questions.</p>
      <p>— ${contractorName}</p>
      <hr style="border:0;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:11px;color:#888;text-align:center;">Sent via <strong>Quotely</strong> — speak the job. Send the quote.</p>
    </div>`;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${values.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: values.customerEmail }] }],
      from: { email: values.from },
      reply_to: { email: values.contractorEmail, name: values.contractorName },
      subject: `Quote #${values.quoteId} from ${values.contractorName}`,
      content: [{ type: 'text/html', value: html }],
      attachments: [{
        content: values.pdf.toString('base64'),
        filename: `quote-${values.quoteId}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      }],
    }),
  });
  if (!response.ok) {
    throw new Error(`SendGrid rejected the quote email (HTTP ${response.status}).`);
  }
}
