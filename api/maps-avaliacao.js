// Vercel: /api/maps-avaliacao?url=<link do Google Maps>  →  { link, placeId, nome }
// (mesma lógica do GestorPrint; o GestorPrint também usa esta como reserva, por isso libera CORS)
// Abre o link curto (maps.app.goo.gl) do lado do servidor, pega o ID do lugar e monta o link
// que abre direto a tela de avaliação do Google. Só aceita endereços do Google (não vira proxy).


export const BASE_AVALIACAO = 'https://search.google.com/local/writereview?placeid=';

// primeira URL de um texto ("DU GORDIN · Brasília https://maps.app.goo.gl/..." → só o link)
export function extrairUrl(texto) {
  const m = String(texto || '').match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,;]+$/, '') : String(texto || '').trim();
}

function decodificar(u) { try { return decodeURIComponent(u); } catch { return u; } }

// ID interno "0xAAAA:0xBBBB" → Place ID "ChIJ..."
export function idParaPlaceId(a, b) {
  const bytes = [0x0a, 0x12, 0x09];
  const por64 = hex => { let v = BigInt(hex); for (let i = 0; i < 8; i++) { bytes.push(Number(v & 0xffn)); v >>= 8n; } };
  por64(a); bytes.push(0x11); por64(b);
  const b64 = typeof btoa === 'function' ? btoa(String.fromCharCode(...bytes)) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const ehPlaceId = s => /^ChIJ[A-Za-z0-9_-]{20,}$/.test(s);

// tenta achar o Place ID dentro de um texto (URL completa do Maps, HTML da página etc.)
export function acharPlaceId(texto) {
  const t = decodificar(String(texto || ''));
  let m = t.match(/(?:placeid|place_id|query_place_id)[=:]\s*(ChIJ[A-Za-z0-9_-]{20,})/i);
  if (m) return m[1];
  m = t.match(/!1s(0x[0-9a-f]{1,16}):(0x[0-9a-f]{1,16})/i) || t.match(/ftid=(0x[0-9a-f]{1,16}):(0x[0-9a-f]{1,16})/i)
    || t.match(/(0x[0-9a-f]{6,16}):(0x[0-9a-f]{6,16})/i);
  if (m) return idParaPlaceId(m[1], m[2]);
  m = t.match(/\b(ChIJ[A-Za-z0-9_-]{20,})\b/);
  if (m && ehPlaceId(m[1])) return m[1];
  return null;
}

// nome do lugar que vem na URL (/maps/place/DU+GORDIN/@...)
export function nomeDaUrl(url) {
  const m = String(url || '').match(/\/maps\/place\/([^/@?]+)/i);
  return m ? decodificar(m[1].replace(/\+/g, ' ')).trim() : '';
}

export const ehLinkAvaliacao = s => /search\.google\.com\/local\/writereview/i.test(s) || /g\.page\/r\/[^/]+\/review/i.test(s);
export const ehLinkMapsCurto = s => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|share\.google)\//i.test(extrairUrl(s));
export const ehLinkMaps = s => {
  const u = extrairUrl(s);
  return ehLinkMapsCurto(u) || /^https?:\/\/((www|maps)\.)?google\.[a-z.]+\/maps/i.test(u) || /^https?:\/\/maps\.google\.[a-z.]+\//i.test(u)
    || /^https?:\/\/(www\.)?google\.[a-z.]+\/(search|\?).*(ludocid|cid|kgmid)=/i.test(u);
};

// sem rede: só funciona se o link já traz o ID (URL completa do Maps)
export function converterLocal(texto) {
  const u = extrairUrl(texto);
  if (ehLinkAvaliacao(u)) return { link: u, nome: '', jaEra: true };
  const id = acharPlaceId(u);
  return id ? { link: BASE_AVALIACAO + id, placeId: id, nome: nomeDaUrl(u) } : null;
}


const PERMITIDO = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)$/i;
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function resolverMaps(entrada) {
  let atual = extrairUrl(entrada);
  for (let i = 0; i < 6; i++) {
    let u; try { u = new URL(atual); } catch { throw new Error('Link inválido.'); }
    if (!/^https?:$/.test(u.protocol) || !PERMITIDO.test(u.hostname)) throw new Error('Isso não é um link do Google Maps.');
    // a tela de consentimento (Europa) traz o destino no parâmetro "continue"
    if (/^consent\./i.test(u.hostname) && u.searchParams.get('continue')) { atual = u.searchParams.get('continue'); continue; }
    const id = acharPlaceId(atual);
    if (id) return { placeId: id, nome: nomeDaUrl(atual), mapsUrl: atual };
    const r = await fetch(atual, { redirect: 'manual', headers: { 'User-Agent': NAVEGADOR, 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    const prox = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && prox) { atual = new URL(prox, atual).href; continue; }
    // sem redirecionamento: procura o ID dentro da página
    const html = (await r.text()).slice(0, 2_000_000);
    const idPag = acharPlaceId(html);
    if (idPag) {
      const t = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
      return { placeId: idPag, nome: nomeDaUrl(atual) || (t ? t[1].split('·')[0].trim() : ''), mapsUrl: atual };
    }
    break;
  }
  throw new Error('Não achei o lugar nesse link. Confira se é o link de uma loja (não de um endereço ou rota).');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url, 'http://x').searchParams.get('url') || '';
  try {
    const r = await resolverMaps(url);
    res.end(JSON.stringify({ link: BASE_AVALIACAO + r.placeId, ...r }));
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ erro: e.message }));
  }
}
