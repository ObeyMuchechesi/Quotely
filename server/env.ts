import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is not configured'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is not configured'),
  SENDGRID_API_KEY: z.string().min(1, 'SENDGRID_API_KEY is not configured'),
  SENDGRID_FROM_EMAIL: z.string().email('SENDGRID_FROM_EMAIL must be a valid email address'),
  CONTRACTOR_NAME: z.string().trim().min(1).max(120).regex(/^[^\r\n]+$/).default('Your Contractor'),
});

export function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Server configuration is incomplete: ${missing}`);
  }
  return parsed.data;
}
