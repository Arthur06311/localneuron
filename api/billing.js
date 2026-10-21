// Função da Vercel. O corpo chega cru para a assinatura do webhook da Stripe.
import { createBillingFromEnv, dispatchNodeRequest } from '../dist/src/billing-service.js';

export const config = { api: { bodyParser: false } };

let app;
export default async function handler(request, response) {
  app ??= await createBillingFromEnv();
  await dispatchNodeRequest(app, request, response);
}
