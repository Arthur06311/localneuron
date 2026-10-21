import { createBillingFromEnv, handleBillingWeb } from '../../../src/billing-service.ts';

let starting: Promise<Awaited<ReturnType<typeof createBillingFromEnv>>> | undefined;

Deno.serve(async (request) => {
  try {
    starting ??= createBillingFromEnv(Deno.env.toObject()).catch((err) => {
      starting = undefined;
      throw err;
    });
    const app = await starting;
    return await handleBillingWeb(app, request);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Não foi possível concluir a operação de assinatura.' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }
});
