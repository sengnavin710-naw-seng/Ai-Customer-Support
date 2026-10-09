import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test']),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol)),
  DEV_ADMIN_EMAIL: z.email(),
  DEV_ADMIN_PASSWORD_HASH: z.string().regex(/^[a-f0-9]{32}:[a-f0-9]{128}$/),
});
export type Environment = z.infer<typeof schema>;
export const ENV = Symbol('ENV');
export function loadEnvironment(input: NodeJS.ProcessEnv): Environment {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}. Use .env.example and npm run setup. Milestone 1 authentication is development-only.`,
    );
  return result.data;
}
