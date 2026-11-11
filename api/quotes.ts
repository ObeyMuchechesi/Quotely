import Busboy from 'busboy';
import { z } from 'zod';
import { connectToDatabase, saveQuote } from '../server/db.js';
import { sendQuoteEmail } from '../server/email.js';
import { getEnv } from '../server/env.js';
import { generateQuotePdf } from '../server/pdf.js';
import { calculateQuote, createQuoteDraft, transcribeAudio } from '../server/quote.js';
import type { VercelRequest, VercelResponse } from '../server/vercel.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const formSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email().max(254),
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'ZAR']),
  taxRate: z.coerce.number().min(0).max(25),
});

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const allowedTypes = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
]);

type ParsedForm = {
  fields: Record<string, string>;
  audio?: { buffer: Buffer; mimeType: string; extension: string };
};

function parseForm(req: VercelRequest): Promise<ParsedForm> {
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5, parts: 6 },
      });
    } catch {
      reject(new Error('Send the quote details as a multipart form with an audio file.'));
      return;
    }

    const fields: Record<string, string> = {};
    let audio: ParsedForm['audio'];
    let failure: Error | null = null;
    let settled = false;
    const fail = (error: Error) => {
      if (!failure) failure = error;
    };

    parser.on('field', (name, value) => {
      if (name.length > 40 || value.length > 5000) {
        fail(new Error('A form field exceeds the allowed size.'));
        return;
      }
      fields[name] = value;
    });

    parser.on('file', (name, file, info) => {
      const mimeType = info.mimeType.split(';', 1)[0].trim().toLowerCase();
      if (name !== 'audio' || audio || !allowedTypes.has(mimeType)) {
        fail(new Error('Choose a supported audio recording and try again.'));
        file.resume();
        return;
      }

      const chunks: Buffer[] = [];
      file.on('data', (chunk: Buffer) => chunks.push(chunk));
      file.on('limit', () => fail(new Error('Audio files must be smaller than 4 MB.')));
      file.on('end', () => {
        if (file.truncated) {
          fail(new Error('Audio files must be smaller than 4 MB.'));
          return;
        }
        const extensionByType: Record<string, string> = {
          'audio/webm': 'webm',
          'audio/ogg': 'ogg',
          'audio/mp4': 'mp4',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/wav': 'wav',
          'audio/x-wav': 'wav',
          'audio/m4a': 'm4a',
          'audio/x-m4a': 'm4a',
        };
        audio = {
          buffer: Buffer.concat(chunks),
          mimeType,
          extension: extensionByType[mimeType],
        };
      });
    });

    parser.on('filesLimit', () => fail(new Error('Upload one audio recording at a time.')));
    parser.on('fieldsLimit', () => fail(new Error('The form contains too many fields.')));
    parser.on('partsLimit', () => fail(new Error('The form contains too many parts.')));
    parser.on('error', (error) => {
      fail(error instanceof Error ? error : new Error('Invalid multipart audio form.'));
    });
    parser.on('close', () => {
      if (settled) return;
      settled = true;
      if (failure) reject(failure);
      else resolve({ fields, audio });
    });
    req.pipe(parser);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  let savedQuote: Awaited<ReturnType<typeof saveQuote>> | null = null;
  try {
    const form = await parseForm(req);
    const fields = formSchema.safeParse(form.fields);
    if (!fields.success) {
      return res.status(400).json({ error: 'Enter a customer name, valid email, currency, and tax rate from 0 to 25%.' });
    }
    if (!form.audio) return res.status(400).json({ error: 'Record or upload an audio clip to continue.' });

    const env = getEnv();
    await connectToDatabase(env.MONGODB_URI);
    const transcript = await transcribeAudio(
      env.OPENAI_API_KEY,
      form.audio.buffer,
      `job-recording.${form.audio.extension}`,
      form.audio.mimeType,
    );
    const draft = await createQuoteDraft(env.OPENAI_API_KEY, transcript, fields.data.currency);
    const quote = calculateQuote(draft, fields.data.currency, fields.data.taxRate);
    const created = await saveQuote({
      customerName: fields.data.customerName,
      customerEmail: fields.data.customerEmail,
      quote,
    });
    savedQuote = created;
    const quoteId = String(created._id);
    const pdf = await generateQuotePdf(quote, quoteId, env.CONTRACTOR_NAME);

    await sendQuoteEmail({
      apiKey: env.SENDGRID_API_KEY,
      from: env.SENDGRID_FROM_EMAIL,
      contractorName: env.CONTRACTOR_NAME,
      customerName: fields.data.customerName,
      customerEmail: fields.data.customerEmail,
      quote,
      quoteId,
      pdf,
    });

    await created.updateOne({ status: 'sent' });
    return res.status(201).json({
      quote: { ...quote, id: quoteId },
    });
  } catch (error) {
    if (savedQuote) {
      try {
        await savedQuote.updateOne({ status: 'failed' });
      } catch (statusError) {
        console.error('Quote status update failed:', statusError instanceof Error ? statusError.name : 'Unknown error');
      }
    }
    if (error instanceof Error && error.message.startsWith('Server configuration is incomplete:')) {
      return res.status(503).json({ error: 'Quotely is not fully configured yet. Please try again later.' });
    }
    if (error instanceof Error && (
      error.message.startsWith('Send the quote details')
      || error.message.startsWith('Choose a supported audio')
      || error.message.startsWith('Audio files')
      || error.message.startsWith('A form field')
      || error.message.startsWith('No speech')
      || error.message.startsWith('The quote could not')
      || error.message.startsWith('The generated quote')
    )) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Quote generation failed:', error instanceof Error ? error.name : 'Unknown error');
    return res.status(502).json({ error: 'We could not prepare or send the quote. Please try again.' });
  }
}
