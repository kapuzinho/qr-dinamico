// Diagnóstico: abra https://SEU-SITE/api/saude pra ver se a Vercel está falando com o Supabase.
// Não mostra a chave, só o tipo e o resultado do teste.
import { cabecalhos, limparUrl } from './r.js';

export default async function handler(req, res) {
  const url = limparUrl(process.env.SUPABASE_URL), chave = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const r = {
    SUPABASE_URL: url ? (/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) ? 'ok: ' + url : 'formato estranho: ' + url) : 'FALTANDO',
    SUPABASE_ANON_KEY: !chave ? 'FALTANDO' : /^eyJ/.test(chave) ? 'ok (chave anon antiga, eyJ...)' : /^sb_publishable_/.test(chave) ? 'ok (chave publishable nova)'
      : /^sb_secret_/.test(chave) ? 'ERRADA: isso é a chave SECRETA, troque pela publishable/anon' : 'formato desconhecido',
  };
  if (url && chave) {
    try {
      const resp = await fetch(`${url}/rest/v1/rpc/qr_abrir`, { method: 'POST', headers: cabecalhos(chave), body: JSON.stringify({ p_codigo: 'teste-saude', p_contar: false }) });
      const txt = await resp.text();
      r.teste = resp.ok ? 'OK: conectou e a função qr_abrir respondeu ' + txt : `ERRO ${resp.status}: ${txt.slice(0, 400)}`;
      if (/qr_abrir/.test(txt) && /not find|does not exist|schema cache/i.test(txt)) r.dica = 'A função qr_abrir não existe nesse projeto: rode o supabase/schema.sql no SQL Editor (do MESMO projeto da URL acima).';
      else if (resp.status === 401) r.dica = 'Chave recusada: copie de novo a chave anon/publishable do MESMO projeto da URL e faça Redeploy.';
    } catch (e) { r.teste = 'Não conectou: ' + e.message; r.dica = 'Confira a SUPABASE_URL (Project URL do Supabase).'; }
  } else r.dica = 'Coloque as variáveis em Vercel → Settings → Environment Variables e faça Redeploy.';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(r, null, 2));
}
