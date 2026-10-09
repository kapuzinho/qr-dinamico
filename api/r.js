// Redirecionamento do QR dinâmico: https://seu-site/CODIGO  →  destino cadastrado no painel.
// Registra o clique (sem guardar IP) e mostra uma página amigável se o link venceu, está
// desativado ou ainda não tem destino.
// Variáveis na Vercel: SUPABASE_URL, SUPABASE_ANON_KEY (obrigatórias), WHATSAPP e MARCA (opcionais).

const ROBO = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|linkedin|embedly|pinterest|vkshare|curl|wget|python|go-http|java\/|headless|lighthouse|monitor/i;

export function lerAparelho(ua = '') {
  const sistema = /iphone|ipad|ipod/i.test(ua) ? 'iPhone/iPad' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows'
    : /mac os x|macintosh/i.test(ua) ? 'Mac' : /linux/i.test(ua) ? 'Linux' : 'Outro';
  const dispositivo = /ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? 'tablet'
    : /mobi|iphone|ipod|android/i.test(ua) ? 'celular' : 'computador';
  const navegador = /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera'
    : /instagram/i.test(ua) ? 'Instagram' : /fban|fbav/i.test(ua) ? 'Facebook' : /crios|chrome/i.test(ua) ? 'Chrome'
    : /fxios|firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Outro';
  return { dispositivo, sistema, navegador };
}

// chave antiga (JWT "eyJ...") vai também no Authorization; a nova ("sb_publishable_...") só no apikey
export const cabecalhos = chave => ({ apikey: chave, 'Content-Type': 'application/json', ...(/^eyJ/.test(chave) ? { Authorization: `Bearer ${chave}` } : {}) });
export const limparUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina({ titulo, texto, icone, whatsapp, marca }) {
  const wpp = whatsapp ? `<a class="b" href="https://wa.me/${esc(whatsapp)}?text=${encodeURIComponent(`Olá! Escaneei um QR Code da ${marca} e apareceu: "${titulo}".`)}">Falar no WhatsApp</a>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(titulo)}</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f3f5f6;color:#1d2b33;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.c{max-width:380px;width:100%;background:#fff;border-radius:18px;padding:32px 26px;text-align:center;box-shadow:0 10px 30px rgba(20,35,43,.1)}
.i{font-size:46px;line-height:1}h1{font-size:21px;margin:14px 0 6px}p{margin:0 0 20px;color:#5b6b73}
.b{display:inline-block;padding:12px 20px;border-radius:12px;background:#25d366;color:#fff;font-weight:600;text-decoration:none}small{display:block;margin-top:22px;color:#9aa7ad}</style></head>
<body><main class="c"><div class="i">${icone}</div><h1>${esc(titulo)}</h1><p>${esc(texto)}</p>${wpp}<small>${esc(marca)}</small></main></body></html>`;
}

const MSG = {
  vencido: ['Este QR Code expirou', 'A validade deste link terminou. Fale com a gente pra renovar.', '⌛', 410],
  inativo: ['Este QR Code está desativado', 'Este link foi pausado pelo responsável.', '⏸', 410],
  sem_destino: ['QR Code ainda não ativado', 'Este QR Code ainda não foi configurado. Volte daqui a pouco.', '🔧', 404],
  nao_encontrado: ['QR Code não encontrado', 'Confira se o código está certo.', '🔍', 404],
  erro: ['Não deu pra abrir agora', 'Tente de novo em alguns segundos.', '⚠️', 503],
};

export default async function handler(req, res) {
  const marca = process.env.MARCA || 'Kapuzinho 3D';
  const whatsapp = process.env.WHATSAPP ?? '5561920069782';
  const responder = (st) => {
    const [titulo, texto, icone, cod] = MSG[st] || MSG.erro;
    res.statusCode = cod;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(pagina({ titulo, texto, icone, whatsapp, marca }));
  };

  const codigo = String((req.query && req.query.c) || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(codigo)) return responder('nao_encontrado');

  const URL_SB = limparUrl(process.env.SUPABASE_URL), CHAVE = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (!URL_SB || !CHAVE) return responder('erro');

  const h = req.headers || {};
  const ua = String(h['user-agent'] || '');
  const contar = req.method === 'GET' && !ROBO.test(ua) && h['purpose'] !== 'prefetch' && h['sec-purpose'] !== 'prefetch';
  const ap = lerAparelho(ua);
  let cidade = h['x-vercel-ip-city'] || null;
  try { if (cidade) cidade = decodeURIComponent(cidade); } catch {}

  let r;
  try {
    const resp = await fetch(`${URL_SB}/rest/v1/rpc/qr_abrir`, {
      method: 'POST',
      headers: cabecalhos(CHAVE),
      body: JSON.stringify({
        p_codigo: codigo, p_contar: contar, p_dispositivo: ap.dispositivo, p_sistema: ap.sistema, p_navegador: ap.navegador,
        p_pais: h['x-vercel-ip-country'] || null, p_regiao: h['x-vercel-ip-country-region'] || null, p_cidade: cidade,
        p_origem: h['referer'] || null,
      }),
    });
    if (!resp.ok) throw new Error('supabase ' + resp.status + ' ' + (await resp.text()).slice(0, 300));
    r = await resp.json();
  } catch (e) {
    console.error(e);
    return responder('erro');
  }

  if (r && r.destino && /^https?:\/\//i.test(r.destino)) {
    res.statusCode = 302;                          // 302 = temporário: o navegador não grava, então dá pra trocar o destino depois
    res.setHeader('Location', r.destino);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.end();
  }
  return responder(r && r.status);
}
