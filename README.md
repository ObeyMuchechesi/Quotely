# Quotely — Voice-to-Quote for Contractors

Record a job on your phone. Quotely transcribes it, turns it into a structured quote, creates a PDF, stores the quote in MongoDB, and emails it to your customer.

**Tagline:** *Speak the job. Send the quote.*

## Requirements

- Node.js 20+
- MongoDB connection string
- OpenAI API key
- Resend API key and a verified sender address
- Vercel CLI for local development and deployment

## Configure

Copy `.env.example` to `.env` and set `MONGODB_URI`, `OPENAI_API_KEY`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`. Resend offers a free tier (up to 3,000 emails/month, limited to 100/day); add and verify a sender domain in Resend before sending customer emails. Each quote form lets the contractor edit their business name and enter a reply-to email so customer responses go directly to them. `CONTRACTOR_NAME` is the fallback business name.

Never commit `.env` or paste secret values into source files.

## Run locally

```sh
npm install
npm run dev
```

`npm run dev` starts the Vercel development server, including the `/api/quotes` serverless function. The browser requests microphone access; use localhost or HTTPS.

## Deploy to Vercel

Import the GitHub repository into Vercel or run `vercel link`, then add the required environment variables in the Vercel project settings for Production and Preview. Configure a Resend API key and a Resend-verified `RESEND_FROM_EMAIL`; contractors enter their own reply-to email when creating each quote. `CONTRACTOR_NAME` is an optional fallback; the business name is editable on the quote form. Deploy with:

```sh
vercel --prod
```

The API uses a Vercel Node.js function and accepts audio uploads up to 4 MB. It runs transcription, structured quote generation, PDF creation, MongoDB persistence, and email delivery in one request. A persistent Redis/BullMQ worker is intentionally not used because Vercel functions are short-lived.

AI-generated prices are estimates. Review the quote with the customer before accepting the scope or starting work. MongoDB Atlas must allow connections from the Vercel deployment.

## Checks

```sh
npm test
npm run build
```
