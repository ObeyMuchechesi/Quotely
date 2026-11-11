# Quotely — Voice-to-Quote for Contractors

Record a job on your phone. Quotely transcribes it, turns it into a structured quote, creates a PDF, stores the quote in MongoDB, and emails it to your customer.

**Tagline:** *Speak the job. Send the quote.*

## Requirements

- Node.js 20+
- MongoDB connection string
- OpenAI API key
- SendGrid API key and a verified sender address
- Vercel CLI for local development and deployment

## Configure

Copy `.env.example` to `.env` and set `MONGODB_URI`, `OPENAI_API_KEY`, `SENDGRID_API_KEY`, and `SENDGRID_FROM_EMAIL`. Set `CONTRACTOR_NAME` to the business name shown on customer emails and PDFs.

Never commit `.env` or paste secret values into source files.

## Run locally

```sh
npm install
npm run dev
```

`npm run dev` starts the Vercel development server, including the `/api/quotes` serverless function. The browser requests microphone access; use localhost or HTTPS.

## Deploy to Vercel

Import the GitHub repository into Vercel or run `vercel link`, then add the required environment variables in the Vercel project settings for Production and Preview. Set `CONTRACTOR_NAME` as desired and deploy with:

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
