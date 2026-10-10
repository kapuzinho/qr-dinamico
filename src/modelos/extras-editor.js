import * as THREE from 'three';
// Recursos comuns a todos os modelos: salvar/abrir projeto, orçamento automático e foto pra anúncio.
const PROPS_ARTE = ['arte', 'frente', 'verso', 'logo', 'svg', 'artes', 'arteVerso', 'foto'];

// ---------- projeto: todos os campos do painel + artes ----------
export function exportarProjeto(aba, cfg) {
  const campos = [...aba.painel.querySelectorAll('input, select, textarea')]
    .filter(i => i.type !== 'file' && !i.closest('.extras-modelo'))
    .map(i => (i.type === 'checkbox' ? i.checked : i.value));
  const artes = {};
  for (const n of PROPS_ARTE) if (n in aba) {
    const v = aba[n];
    if (v === null || v === undefined) artes[n] = null;
    else if (v instanceof ImageData || (v?.data && v.width && v.height && !v.exemplo)) artes[n] = { imagem: true, w: v.width, h: v.height, dados: Array.from(v.data) };
    else if (Array.isArray(v)) artes[n] = v.map(x => (x?.dado instanceof ImageData ? { tipo: x.tipo, imagem: { w: x.dado.width, h: x.dado.height, dados: Array.from(x.dado.data) } } : x));
    else if (v?.dado instanceof ImageData) artes[n] = { tipo: v.tipo, imagem: { w: v.dado.width, h: v.dado.height, dados: Array.from(v.dado.data) } };
    else artes[n] = v;
  }
  return { app: 'kapuzinho3d', modelo: cfg.id, versao: 1, salvoEm: new Date().toISOString(), campos, artes, cores: { ...aba.cores } };
}

const paraImageData = o => new ImageData(new Uint8ClampedArray(o.dados), o.w, o.h);
export function importarProjeto(aba, cfg, dados) {
  if (dados?.app !== 'kapuzinho3d') throw new Error('Esse arquivo não é um projeto do Kapuzinho 3D.');
  if (dados.modelo !== cfg.id) throw new Error(`Esse projeto é de outro modelo (${dados.modelo}). Abra ele no modelo certo.`);
  const ins = [...aba.painel.querySelectorAll('input, select, textarea')].filter(i => i.type !== 'file' && !i.closest('.extras-modelo'));
  ins.forEach((i, k) => {
    if (k >= dados.campos.length) return;
    if (i.type === 'checkbox') i.checked = !!dados.campos[k]; else i.value = dados.campos[k];
    i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  for (const [n, v] of Object.entries(dados.artes || {})) {
    if (!(n in aba)) continue;
    if (v?.imagem === true) aba[n] = paraImageData(v);
    else if (Array.isArray(v)) aba[n] = v.map(x => (x?.imagem ? { tipo: x.tipo, dado: paraImageData(x.imagem) } : x));
    else if (v?.imagem) aba[n] = { tipo: v.tipo, dado: paraImageData(v.imagem) };
    else aba[n] = v;
  }
  if (dados.cores) Object.assign(aba.cores, dados.cores);
  // mostra miniatura/remover das artes carregadas
  const temArte = PROPS_ARTE.some(n => aba[n] && (!Array.isArray(aba[n]) || aba[n].some(Boolean)));
  if (temArte) {
    aba.painel.querySelectorAll('button.btn-mini').forEach(b => { if (/^Remover/.test(b.textContent)) b.hidden = false; });
  }
}

// ---------- orçamento a partir do volume das peças ----------
const CHAVE_ORC = 'kap3d_orcamento';
export const orcamentoPadrao = () => ({ precoKg: 120, densidade: 1.27, fator: 0.75, mm3s: 9, ...JSON.parse(localStorage.getItem(CHAVE_ORC) || '{}') });
export const salvarOrcamento = o => localStorage.setItem(CHAVE_ORC, JSON.stringify(o));
export function orcar(manifolds, volumeFixo = null) {
  const o = orcamentoPadrao();
  const vol = volumeFixo ?? manifolds.reduce((s, m) => s + Math.abs(m.volume?.() || 0), 0);            // mm³
  const gramas = vol / 1000 * o.densidade * o.fator;
  const custo = gramas / 1000 * o.precoKg;
  const minutos = vol * o.fator / o.mm3s / 60 + 6;                                        // + aquecimento/preparo
  const fmt = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tempo = minutos < 60 ? `${Math.round(minutos)} min` : `${Math.floor(minutos / 60)} h ${Math.round(minutos % 60)} min`;
  return { gramas, custo, minutos, texto: `<br><b>Orçamento (estimativa):</b> ≈ ${fmt(gramas)} g de filamento · ≈ R$ ${fmt(custo)} · ≈ ${tempo} de impressão.` };
}

// ---------- foto pra anúncio (PNG 1080×1080 com fundo e nome) ----------
export async function fotoAnuncio(viewer, titulo, subtitulo = '') {
  const r = viewer.renderer, cv = r.domElement;
  const cor = r.getClearColor(new THREE.Color()).getHex(), alfa = r.getClearAlpha();
  const escondidos = [];
  viewer.cena.traverse(o => { if ((o.isGridHelper || o.userData?.mesa || o.type === 'GridHelper') && o.visible) { o.visible = false; escondidos.push(o); } });
  r.setClearColor(0x000000, 0);
  r.render(viewer.cena, viewer.camera);
  const quadro = document.createElement('canvas');
  const N = 1080; quadro.width = quadro.height = N;
  const g = quadro.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, N); grad.addColorStop(0, '#f6f3ee'); grad.addColorStop(1, '#ddd6cb');
  g.fillStyle = grad; g.fillRect(0, 0, N, N);
  // sombra suave embaixo do modelo
  const rad = g.createRadialGradient(N / 2, N * 0.74, 10, N / 2, N * 0.74, N * 0.36);
  rad.addColorStop(0, 'rgba(0,0,0,.18)'); rad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rad; g.fillRect(0, N * 0.55, N, N * 0.4);
  const s = Math.min((N * 0.86) / cv.width, (N * 0.7) / cv.height);
  g.drawImage(cv, (N - cv.width * s) / 2, N * 0.08 + (N * 0.7 - cv.height * s) / 2, cv.width * s, cv.height * s);
  r.setClearColor(cor, alfa); escondidos.forEach(o => { o.visible = true; }); r.render(viewer.cena, viewer.camera);
  g.fillStyle = '#1d2b33'; g.textAlign = 'center';
  g.font = '700 54px "Barlow Semi Condensed", "Barlow", sans-serif'; g.fillText(titulo, N / 2, N * 0.89, N * 0.9);
  if (subtitulo) { g.font = '500 30px "Barlow", sans-serif'; g.fillStyle = '#5b6b73'; g.fillText(subtitulo, N / 2, N * 0.94, N * 0.9); }
  return new Promise(res => quadro.toBlob(res, 'image/png'));
}
export function baixarLocal(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}
