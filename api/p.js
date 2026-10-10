// Página pública de pagamento Pix: https://SEU-SITE/p/nome-do-link
// Busca os dados no Supabase (função pix_abrir), monta o Pix copia e cola e o QR Code (SVG) no servidor.
import qrcode from 'qrcode-generator';
import '../pix-lib.js';
import { cabecalhos, limparUrl, lerAparelho } from './r.js';

const P = globalThis.PixLib;
const ROBO = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|linkedin|curl|wget|python|headless/i;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function svgQR(texto) {
  const q = qrcode(0, 'M'); q.addData(texto); q.make();
  const n = q.getModuleCount(), m = 2, t = n + m * 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="QR Code Pix"><rect width="${t}" height="${t}" fill="#fff"/><path fill="#0b2f33" d="${d}"/></svg>`;
}

const CSS = `*{box-sizing:border-box}body{margin:0;background:#eef3f3;color:#16262b;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:440px;margin:0 auto;padding:18px 14px 30px}
.card{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 12px 34px rgba(16,50,55,.12)}
.topo{background:linear-gradient(135deg,#0b6e6f,#14a39a);color:#fff;padding:22px 22px 26px;text-align:center}
.topo .marca{font-size:13px;letter-spacing:.6px;text-transform:uppercase;opacity:.85;font-weight:600}
.topo h1{margin:8px 0 2px;font-size:15px;font-weight:500;opacity:.92}
.topo .nome{font-size:22px;font-weight:800;line-height:1.2;word-break:break-word}
.valor{margin-top:12px;display:inline-block;background:rgba(255,255,255,.18);border-radius:14px;padding:8px 16px;font-size:26px;font-weight:800}
.corpo{padding:20px 20px 22px}
.tit{text-align:center;font-weight:700;margin:0 0 2px}.desc{text-align:center;color:#5b6b70;font-size:14px;margin:0 0 6px}
.qr{width:236px;margin:14px auto 16px;padding:10px;border:3px solid #14a39a;border-radius:18px}
.qr svg{display:block;width:100%;height:auto}
.passos{font-size:13.5px;color:#55666b;text-align:center;margin:0 0 12px}
.codigo{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:#f3f7f7;border:1px dashed #c9dada;border-radius:12px;padding:10px 12px;word-break:break-all;color:#35474c;max-height:92px;overflow:auto}
.btn{display:flex;width:100%;align-items:center;justify-content:center;gap:8px;border:0;border-radius:14px;padding:15px;margin-top:12px;font:700 16px system-ui,sans-serif;cursor:pointer;text-decoration:none}
.copiar{background:#0b6e6f;color:#fff}.copiar.ok{background:#1f7a4d}
.info{margin:18px 0 0;border-top:1px solid #e5eded}.info div{display:flex;justify-content:space-between;gap:12px;padding:11px 2px;border-bottom:1px solid #e5eded;font-size:14px}
.info span{color:#6b7b80}.info b{font-weight:600;text-align:right;word-break:break-all}
.aviso{margin-top:16px;background:#fff6e2;border-left:4px solid #f0a020;border-radius:10px;padding:11px 13px;font-size:13.5px;color:#7a4b00}
.wpp{background:#fff;color:#0b6e6f;border:2px solid #0b6e6f}
.rodape{text-align:center;color:#7c8b90;font-size:12px;margin-top:16px}
.erro{text-align:center;padding:40px 24px}.erro .i{font-size:44px}.erro h2{margin:10px 0 6px}`;

function pagina({ titulo, corpo, og = '' }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(titulo)}</title>${og}<style>${CSS}</style></head><body><main>${corpo}</main></body></html>`;
}

export default async function handler(req, res) {
  const marca = process.env.MARCA || 'Kapuzinho 3D', wpp = process.env.WHATSAPP ?? '5561920069782';
  const enviar = (cod, html) => { res.statusCode = cod; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(html); };
  const erro = (cod, icone, t, txt) => enviar(cod, pagina({ titulo: t, corpo: `<div class="card"><div class="erro"><div class="i">${icone}</div><h2>${esc(t)}</h2><p>${esc(txt)}</p>${wpp ? `<a class="btn wpp" href="https://wa.me/${esc(wpp)}">Falar no WhatsApp</a>` : ''}</div></div><p class="rodape">${esc(marca)}</p>` }));

  const slug = String((req.query && req.query.s) || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return erro(404, '🔍', 'Link Pix não encontrado', 'Confira se o endereço está certo.');
  const URL_SB = limparUrl(process.env.SUPABASE_URL), CHAVE = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (!URL_SB || !CHAVE) return erro(503, '⚠️', 'Não deu pra abrir agora', 'Tente de novo em alguns segundos.');

  const h = req.headers || {}, ua = String(h['user-agent'] || ''), ap = lerAparelho(ua);
  let cidade = h['x-vercel-ip-city'] || null; try { if (cidade) cidade = decodeURIComponent(cidade); } catch {}
  let r;
  try {
    const resp = await fetch(`${URL_SB}/rest/v1/rpc/pix_abrir`, { method: 'POST', headers: cabecalhos(CHAVE),
      body: JSON.stringify({ p_slug: slug, p_contar: req.method === 'GET' && !ROBO.test(ua), p_dispositivo: ap.dispositivo, p_sistema: ap.sistema, p_cidade: cidade, p_regiao: h['x-vercel-ip-country-region'] || null }) });
    if (!resp.ok) throw new Error('supabase ' + resp.status + ' ' + (await resp.text()).slice(0, 200));
    r = await resp.json();
  } catch (e) { console.error(e); return erro(503, '⚠️', 'Não deu pra abrir agora', 'Tente de novo em alguns segundos.'); }

  if (!r || r.status === 'nao_encontrado') return erro(404, '🔍', 'Link Pix não encontrado', 'Confira se o endereço está certo.');
  if (r.status !== 'ok') return erro(410, '⏸', 'Este link Pix está desativado', 'Fale com quem te enviou o link.');

  const codigo = P.payload({ chave: r.chave, nome: r.nome, cidade: r.cidade, valor: r.valor, descricao: r.descricao });
  const nome = esc(r.nome), valor = r.valor ? brl(r.valor) : '';
  const og = `<meta property="og:title" content="${esc(`Pagar com Pix para ${r.nome}${valor ? ' · ' + valor : ''}`)}"><meta property="og:description" content="Escaneie o QR Code ou copie o código Pix."><meta name="theme-color" content="#0b6e6f">`;
  const corpo = `<div class="card">
  <div class="topo"><div class="marca">Pagamento via Pix</div><h1>Você está pagando para</h1><div class="nome">${nome}</div>${valor ? `<div class="valor">${esc(valor)}</div>` : ''}</div>
  <div class="corpo">
    ${r.titulo ? `<p class="tit">${esc(r.titulo)}</p>` : ''}${r.descricao ? `<p class="desc">${esc(r.descricao)}</p>` : ''}
    <div class="qr">${svgQR(codigo)}</div>
    <p class="passos">No app do seu banco, escolha <b>Pix → Pagar com QR Code</b> ou <b>Pix Copia e Cola</b>${valor ? '' : ' e digite o valor'}.</p>
    <div class="codigo" id="codigo">${esc(codigo)}</div>
    <button class="btn copiar" id="copiar" type="button">📋 Copiar código Pix</button>
    <div class="info">
      <div><span>Recebedor</span><b>${nome}</b></div>
      <div><span>Tipo de chave</span><b>${esc(P.TIPOS[r.tipo] || '')}</b></div>
      <div><span>Chave Pix</span><b>${esc(P.mascarar(r.tipo, r.chave))}</b></div>
      ${valor ? `<div><span>Valor</span><b>${esc(valor)}</b></div>` : ''}
    </div>
    <div class="aviso">Antes de confirmar, confira no app do banco se o <b>nome do recebedor</b>${valor ? ' e o <b>valor</b>' : ''} estão certos.</div>
    ${wpp ? `<a class="btn wpp" href="https://wa.me/${esc(wpp)}?text=${encodeURIComponent(`Olá! Vi um link Pix da ${marca} e quero ter o meu.`)}" target="_blank" rel="noopener">Quero meu link Pix</a>` : ''}
  </div></div>
  <p class="rodape">${esc(marca)} não processa pagamentos: o Pix vai direto do seu banco pra conta do recebedor.</p>
  <script>
  document.getElementById('copiar').onclick=async function(){var t=document.getElementById('codigo').textContent,b=this;
    try{await navigator.clipboard.writeText(t)}catch(e){var x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();document.execCommand('copy');x.remove()}
    b.textContent='✓ Código copiado! Cole no app do banco';b.classList.add('ok');setTimeout(function(){b.textContent='📋 Copiar código Pix';b.classList.remove('ok')},4000)};
  </script>`;
  return enviar(200, pagina({ titulo: `Pix para ${r.nome}`, corpo, og }));
}
