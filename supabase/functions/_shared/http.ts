// utilidades comuns das Edge Functions
export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_ORIGEM') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sessao',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-restantes, x-limite, content-disposition',
};
export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
// erro do Postgres: message = código (LIMITE, SESSAO_INVALIDA...), hint = texto pro usuário
export const erroRpc = (e: { message?: string; hint?: string }, status = 403) =>
  json({ erro: e.message || 'ERRO', mensagem: e.hint || e.message || 'Erro.' }, status);
