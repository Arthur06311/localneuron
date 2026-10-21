import { createRequire } from 'node:module';

const { redactSensitive } = createRequire(import.meta.url)('../../desktop/redact.cjs') as {
  redactSensitive: (value: unknown, secrets?: readonly string[]) => string;
};

export { redactSensitive };
