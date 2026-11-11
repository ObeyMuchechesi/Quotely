import mongoose from 'mongoose';
import type { Quote, QuoteLineItem } from './types.js';

type QuoteRecordFields = Quote & {
  customerName: string;
  customerEmail: string;
  status: 'sending' | 'sent' | 'failed';
  lineItems: QuoteLineItem[];
};

const quoteSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, maxlength: 120 },
    customerEmail: { type: String, required: true, maxlength: 254 },
    jobDescription: { type: String, required: true, maxlength: 4000 },
    currency: { type: String, required: true, length: 3 },
    lineItems: {
      type: [{
        description: { type: String, required: true, maxlength: 240 },
        quantity: { type: Number, required: true, min: 0.01 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      }],
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, maxlength: 1000, default: '' },
    status: { type: String, enum: ['sending', 'sent', 'failed'], default: 'sending' },
  },
  { timestamps: true },
);

const QuoteRecord: mongoose.Model<QuoteRecordFields> = mongoose.models.Quote
  ? mongoose.models.Quote as mongoose.Model<QuoteRecordFields>
  : mongoose.model<QuoteRecordFields>('Quote', quoteSchema);

let connection: Promise<typeof mongoose> | null = null;

export async function connectToDatabase(uri: string) {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connection) {
    connection = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    connection.catch(() => {
      connection = null;
    });
  }
  return connection;
}

export function saveQuote(values: {
  customerName: string;
  customerEmail: string;
  quote: Quote;
}) {
  return QuoteRecord.create({
    ...values.quote,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    status: 'sending',
  });
}
