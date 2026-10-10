// Gera o arquivo de download (.3mf / .zip / .stl) NO SERVIDOR, só depois de conferir a sessão e o limite.
// O site manda a malha (pacote binário); quem monta o arquivo final pro Bambu é esta função.
import JSZip from 'npm:jszip@3.10.1';
import { createClient } from 'npm:@supabase/supabase-js@2';
import CONFIG_A1 from '../_shared/bambu-a1-projeto.json' with { type: 'json' };
import PERFIS from '../_shared/bambu-perfis.json' with { type: 'json' };
import { lerPacote, empacotar } from '../_shared/empacotar.js';
import { CORS, json, erroRpc } from '../_shared/http.ts';

const MAX_BYTES = 60 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'METODO' }, 405);
  const auth = req.headers.get('Authorization') || '';
  const sessao = req.headers.get('x-sessao') || '';
  if (!auth.startsWith('Bearer ') || !/^[0-9a-f-]{36}$/i.test(sessao)) return json({ erro: 'SEM_LOGIN', mensagem: 'Entre na sua conta pra baixar.' }, 401);
  const tam = Number(req.headers.get('content-length') || 0);
  if (tam > MAX_BYTES) return json({ erro: 'GRANDE', mensagem: 'Modelo grande demais pra exportar.' }, 413);

  // cliente com o login de quem pediu (as regras do banco valem pra ele)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  let meta, partes;
  try {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return json({ erro: 'GRANDE', mensagem: 'Modelo grande demais pra exportar.' }, 413);
    ({ meta, partes } = lerPacote(bytes));
    if (!['3mf', 'zip', 'stl'].includes(meta.formato)) throw new Error('Formato inválido.');
  } catch (e) {
    return json({ erro: 'PACOTE', mensagem: (e as Error).message }, 400);
  }
  // monta antes de cobrar (se der erro no arquivo, não gasta download)
  let arq;
  try { arq = await empacotar(JSZip, CONFIG_A1, meta, partes, PERFIS); }
  catch (e) { return json({ erro: 'ARQUIVO', mensagem: 'Não consegui montar o arquivo: ' + (e as Error).message }, 400); }

  const { data, error } = await sb.rpc('consumir_download', { p_sessao: sessao, p_formato: meta.formato, p_nome: arq.nome });
  if (error) return erroRpc(error, error.message === 'LIMITE' ? 402 : 403);

  return new Response(arq.bytes, {
    headers: {
      ...CORS,
      'Content-Type': arq.tipo,
      'Content-Disposition': `attachment; filename="${arq.nome}"`,
      'x-restantes': String(data?.restantes ?? ''),
      'x-limite': String(data?.limite ?? ''),
      'Cache-Control': 'no-store',
    },
  });
});
