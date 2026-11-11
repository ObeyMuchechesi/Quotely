export type QuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Quote = {
  jobDescription: string;
  currency: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
};

export type QuoteDraft = {
  jobDescription: string;
  lineItems: Array<Pick<QuoteLineItem, 'description' | 'quantity' | 'unitPrice'>>;
  notes: string;
};
