import Stripe from 'npm:stripe@18.0.0';
import {
  applyVerifiedStripeEvent,
  createBillingFromEnv,
  stripeApiVersion,
} from '../../../src/billing-service.ts';

let starting: Promise<Awaited<ReturnType<typeof createBillingFromEnv>>> | undefined;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Webhook inválido.' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') ?? '';
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: stripeApiVersion,
      httpClient: Stripe.createFetchHttpClient(),
    });
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
      300,
      Stripe.createSubtleCryptoProvider(),
    );
    starting ??= createBillingFromEnv(Deno.env.toObject()).catch((err) => {
      starting = undefined;
      throw err;
    });
    const app = await starting;
    const result = await applyVerifiedStripeEvent(app, JSON.parse(JSON.stringify(event)));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Webhook inválido.' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
});
