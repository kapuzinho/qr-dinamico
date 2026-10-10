import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { exportar } from './acesso.js';

export function prepararGeometria(g, tolerancia = 1e-4) {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, tolerancia);
  m.computeBoundingBox();
  return m;
}

export async function lerSTL(arquivo) {
  const buf = await arquivo.arrayBuffer();
  return prepararGeometria(new STLLoader().parse(buf));
}

export function stlBinario(geom) {
  return new STLExporter().parse(new THREE.Mesh(geom), { binary: true });
}

// Downloads passam pelo controle de acesso: o arquivo final (.3mf/.zip/.stl) é montado no servidor,
// que confere o login, a sessão e o limite de downloads. O gerador mora em supabase/functions/_shared/empacotar.js.
export function baixarSTL(geom, nome) {
  return exportar('stl', nome, [{ geom, nome }]);
}

export async function baixarZip(itens, nomeZip) {
  return exportar('zip', nomeZip, itens);
}

// Antes de baixar o .3mf: escolher material e resistência. O arquivo sai como projeto da Bambu Lab A1
// já configurado (filamento oficial PLA/PETG da Bambu + paredes/preenchimento), é só abrir e imprimir.
const CHAVE_OP = 'gp-3mf-opcoes';
const RESIST = [
  ['padrao', 'Padrão', '2 paredes · 15% preenchimento'],
  ['reforcado', 'Reforçada', '3 paredes · 25% giroide (recomendado)'],
  ['maximo', 'Máxima', '4 paredes · 40% giroide (mais forte e mais pesado)'],
];
function lerOp() { try { return { material: 'PETG', resistencia: 'reforcado', ...JSON.parse(localStorage.getItem(CHAVE_OP) || '{}') }; } catch { return { material: 'PETG', resistencia: 'reforcado' }; } }
function perguntar3MF(opcoes) {
  return new Promise(fim => {
    const esc = lerOp();
    const fundo = document.createElement('div'); fundo.className = 'modal-3mf-fundo';
    const caixa = document.createElement('div'); caixa.className = 'modal-3mf'; caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true');
    const camada = (+opcoes.alturaCamada || 0.2).toFixed(2).replace('.', ',');
    caixa.innerHTML = `<h3>Baixar .3mf pronto pra imprimir</h3>
      <p class="sub3">Bambu Lab A1 · bico 0,4 · placa PEI texturizada · camada ${camada} mm. É só abrir no Bambu Studio e imprimir.</p>
      <div class="rot3">Material</div><div class="op3" data-g="material"></div>
      <div class="rot3">Resistência</div><div class="op3 col" data-g="resistencia"></div>
      <div class="acoes3"><button type="button" class="btn" data-a="cancelar">Cancelar</button><button type="button" class="btn primario" data-a="ok">Baixar .3mf</button></div>`;
    const grupo = (g, itens) => {
      const box = caixa.querySelector(`[data-g="${g}"]`);
      for (const [v, t, d] of itens) {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v;
        b.innerHTML = `<b>${t}</b>${d ? `<small>${d}</small>` : ''}`;
        b.classList.toggle('ativo', esc[g] === v);
        b.onclick = () => { esc[g] = v; box.querySelectorAll('button').forEach(x => x.classList.toggle('ativo', x === b)); };
        box.append(b);
      }
    };
    grupo('material', [['PLA', 'PLA', 'Generic PLA · 220 °C · mesa 65 °C'], ['PETG', 'PETG', 'Generic PETG · 255 °C · mesa 80 °C']]);
    grupo('resistencia', RESIST);
    const sair = r => { document.removeEventListener('keydown', tecla); fundo.remove(); fim(r); };
    const tecla = e => { if (e.key === 'Escape') sair(null); if (e.key === 'Enter') { e.preventDefault(); ok(); } };
    const ok = () => { try { localStorage.setItem(CHAVE_OP, JSON.stringify(esc)); } catch {} sair({ material: esc.material, resistencia: esc.resistencia }); };
    caixa.querySelector('[data-a="cancelar"]').onclick = () => sair(null);
    caixa.querySelector('[data-a="ok"]').onclick = ok;
    fundo.onclick = e => { if (e.target === fundo) sair(null); };
    document.addEventListener('keydown', tecla);
    fundo.append(caixa); document.body.append(fundo);
    caixa.querySelector('[data-a="ok"]').focus();
  });
}

export async function baixar3MF(partes, nomeArquivo, opcoes = {}) {
  const esc = await perguntar3MF(opcoes);
  if (!esc) return;
  return exportar('3mf', nomeArquivo, partes, { ...opcoes, ...esc });
}
