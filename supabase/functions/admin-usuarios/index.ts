// Ações de administrador que precisam da chave de serviço do Supabase (criar/excluir login, trocar senha).
// Só funciona pra quem é admin (conferido no banco com o login de quem chamou).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'METODO' }, 405);
  const auth = req.headers.get('Authorization') || '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const quem = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ehAdmin } = await quem.rpc('eh_admin');
  if (ehAdmin !== true) return json({ erro: 'SEM_PERMISSAO', mensagem: 'Só administradores.' }, 403);

  const servico = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return json({ erro: 'JSON', mensagem: 'Pedido inválido.' }, 400); }
  const acao = String(corpo.acao || '');

  if (acao === 'criar') {
    const email = String(corpo.email || '').trim().toLowerCase();
    const senha = String(corpo.senha || '');
    const nome = String(corpo.nome || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: 'EMAIL', mensagem: 'E-mail inválido.' }, 400);
    if (senha.length < 8) return json({ erro: 'SENHA', mensagem: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
    const { data, error } = await servico.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, criado_pelo_admin: 'sim' } });
    if (error) return json({ erro: 'CRIAR', mensagem: error.message.includes('already') ? 'Já existe uma conta com esse e-mail.' : error.message }, 400);
    // limite / papel / validade escolhidos na hora de criar (o perfil nasce pelo gatilho do banco)
    const extra: Record<string, unknown> = {};
    if (corpo.limite !== undefined && corpo.limite !== null && corpo.limite !== '') extra.limite_downloads = Math.max(0, Number(corpo.limite) | 0);
    if (corpo.papel === 'admin' || corpo.papel === 'usuario') extra.papel = corpo.papel;
    if (corpo.validade) extra.validade = corpo.validade;
    if (nome) extra.nome = nome;
    if (Object.keys(extra).length) await servico.from('perfis').update(extra).eq('id', data.user.id);
    return json({ ok: true, id: data.user.id });
  }
  if (acao === 'senha') {
    const senha = String(corpo.senha || '');
    if (senha.length < 8) return json({ erro: 'SENHA', mensagem: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
    const { error } = await servico.auth.admin.updateUserById(String(corpo.id), { password: senha });
    if (error) return json({ erro: 'SENHA', mensagem: error.message }, 400);
    return json({ ok: true });
  }
  if (acao === 'excluir') {
    const { data: eu } = await quem.auth.getUser();
    if (eu?.user?.id === corpo.id) return json({ erro: 'PROPRIO', mensagem: 'Você não pode excluir a sua própria conta.' }, 400);
    const { error } = await servico.auth.admin.deleteUser(String(corpo.id));
    if (error) return json({ erro: 'EXCLUIR', mensagem: error.message }, 400);
    return json({ ok: true });
  }
  return json({ erro: 'ACAO', mensagem: 'Ação desconhecida.' }, 400);
});
