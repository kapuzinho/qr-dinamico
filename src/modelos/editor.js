// Editor visual compartilhado dos modelos paramétricos: painel de sliders, paleta de cores por peça,
// prévia 2D (com arraste), visão 3D e exportação .3mf/.zip.
import * as THREE from 'three';
import { paraGeometria, assentar } from '../core/motor.js';
import { baixar3MF, baixarZip } from '../core/arquivos.js';
import { el, secao, botao, acoes, saida, cor } from '../core/ui.js';

const HEX = n => '#' + n.toString(16).padStart(6, '0');
// arte de exemplo (raposa) pros modelos que precisam de uma arte pra mostrar alguma coisa
let exemploSvg = null;
async function arteExemplo() {
  if (!exemploSvg) exemploSvg = fetch('modelos/exemplo-raposa.svg').then(r => r.text());
  return { tipo: 'svg', dado: await exemploSvg, exemplo: true };
}
const paraNum = h => parseInt(h.slice(1), 16);

export function criarEditorModelo(cfg) {
  return {
    id: cfg.id, grupo: 'Modelos', nome: cfg.nome, descricao: cfg.descricao,
    montar(raiz, ctx) {
      // herda os métodos auxiliares definidos na config (formas, parametros, svgCs…)
      for (const k of Object.keys(cfg)) if (typeof cfg[k] === 'function' && !(k in this)) this[k] = cfg[k];
      this.cores = {};
      for (const pt of cfg.partes) this.cores[pt.id] = pt.cor;
      this.parteSel = null;
      this.modo2d = false;   // abre direto na visão 3D

      // conteúdo específico do modelo (texto, svg, símbolo…)
      cfg.montarConteudo.call(this, secao(raiz, 'Conteúdo'), ctx, () => this.mudou(ctx));
      // parâmetros (sliders)
      cfg.montarParametros.call(this, raiz, ctx, () => this.mudou(ctx));
      // rede de segurança: QUALQUER campo do modelo que mudar atualiza a prévia sozinho
      // (cores têm o próprio repintar; arquivos chamam mudou quando terminam de carregar)
      const auto = e => {
        const t = e.target;
        if (!t || !/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.type === 'color' || t.type === 'file') return;
        this.mudou(ctx);
      };
      raiz.addEventListener('input', auto);
      raiz.addEventListener('change', auto);
      this.mapearCamposArte(raiz);

      // paleta de cores por peça
      const sc = secao(raiz, 'Cores das peças');
      sc.append(el('p', { class: 'nota', text: 'Clique no quadradinho de cor de cada peça pra trocar.' }));
      this.paleta = el('div', { class: 'paleta' });
      this.chips = {};
      for (const pt of cfg.partes) {
        const inp = el('input', { type: 'color', value: HEX(this.cores[pt.id]) });
        inp.addEventListener('input', () => { this.cores[pt.id] = paraNum(inp.value); this.pintar(ctx); });
        const chip = el('div', { class: 'chip-parte', onclick: e => { if (inp.disabled) return; if (e.target !== inp) { this.selecionar(pt.id); inp.click(); } } },
          inp, el('span', { text: pt.nome }));
        this.chips[pt.id] = chip;
        this.paleta.append(chip);
      }
      sc.append(this.paleta);

      const a = acoes(raiz);
      botao(a, 'Gerar / atualizar', () => this.gerar(ctx), { primario: true });
      this.btn3mf = botao(a, 'Baixar .3mf (cores separadas)', () => this.baixar3mf(ctx));
      this.btnZip = botao(a, 'Baixar peças (.zip)', () => ctx.baixarZip(this.arquivos, `${cfg.id}.zip`));
      this.btnAbrir = botao(a, 'Editar na área de trabalho', () => this.abrir(ctx));
      this.btn3mf.disabled = this.btnZip.disabled = this.btnAbrir.disabled = true;
      this.out = saida(raiz);
      this.montarExtras(raiz, ctx);
    },
    // salvar/abrir projeto, foto pra anúncio e preço do filamento (orçamento)
    montarExtras(raiz, ctx) {
      const caixa = el('div', { class: 'extras-modelo' });
      const ex = acoes(caixa);
      botao(ex, '💾 Salvar projeto', async () => {
        const { exportarProjeto, baixarLocal } = await import('./extras-editor.js');
        const dados = exportarProjeto(this, cfg);
        baixarLocal(new Blob([JSON.stringify(dados)], { type: 'application/json' }), `${cfg.id}-${new Date().toISOString().slice(0, 10)}.kap3d.json`);
        this.out.textContent = 'Projeto salvo. Use "Abrir projeto" pra continuar depois (ex.: quando o cliente pedir de novo).';
      });
      const inp = el('input', { type: 'file', accept: '.json,.kap3d.json', hidden: true });
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          const { importarProjeto } = await import('./extras-editor.js');
          importarProjeto(this, cfg, JSON.parse(await f.text()));
          this.pintarChips(); this.mudou(ctx);
          this.out.textContent = `Projeto "${f.name}" aberto.`;
        } catch (e) { this.out.textContent = e.message; }
        inp.value = '';
      });
      botao(ex, '📂 Abrir projeto', () => inp.click());
      botao(ex, '📷 Foto pra anúncio', async () => {
        if (this.modo2d) await this.trocarModo(ctx, false);
        const { fotoAnuncio, baixarLocal } = await import('./extras-editor.js');
        const blob = await fotoAnuncio(ctx.viewer, cfg.nome.replace(/\s*\(.*\)$/, ''), 'Personalizado • Impressão 3D');
        baixarLocal(blob, `${cfg.id}-foto.png`);
      });
      caixa.append(inp);
      // preço do filamento pro orçamento (fica salvo no navegador)
      import('./extras-editor.js').then(({ orcamentoPadrao, salvarOrcamento }) => {
        const o = orcamentoPadrao();
        const linha = el('div', { class: 'orc-linha' });
        const campo = (rot, k, passo) => {
          const i = el('input', { type: 'number', step: passo, value: o[k] });
          i.addEventListener('change', () => { o[k] = +i.value || o[k]; salvarOrcamento(o); if (this.resultado) this.gerar(ctx); });
          linha.append(el('label', {}, el('span', { text: rot }), i));
        };
        campo('R$ por kg', 'precoKg', 1); campo('Densidade g/cm³', 'densidade', 0.01); campo('Velocidade mm³/s', 'mm3s', 0.5);
        caixa.append(el('p', { class: 'nota', text: 'Orçamento: estimativa pelo volume (preenchimento ~75%). Ajuste com os valores do seu filamento.' }), linha);
      });
      raiz.append(caixa);
    },

    // ---- ciclo de vida da aba ----
    async ativar(ctx) {
      ctx.montarEditor2D?.();
      ctx.mostrarEditor2D?.(this.modo2d);
      this.montarBarra(ctx);
      await this.aplicarExemplo(ctx);
      this.mudou(ctx);
    },
    avisoExemplo() {
      const usando = (cfg.exemplo || []).some(c => c === 'artes' ? this.artes?.some(a => a?.exemplo) : this[c]?.exemplo);
      return usando ? (cfg.exemploSvg ? '<br>Ícone de exemplo: troque pelo seu ou escolha outro na Galeria.' : '<br><b>Usando a raposa de exemplo.</b> Envie a sua arte no campo de arte pra trocar.') : '';
    },
    // na 1ª vez que abre, campos de arte vazios ganham a raposa de exemplo (cfg.exemplo = nomes dos campos)
    async aplicarExemplo(ctx) {
      if (this._exemploFeito || !cfg.exemplo) return;
      this._exemploFeito = true;
      try {
        const ex = cfg.exemploSvg ? { tipo: 'svg', dado: cfg.exemploSvg, exemplo: true } : await arteExemplo();
        let usou = 0;
        for (const campo of cfg.exemplo) {
          if (campo === 'artes') { if (Array.isArray(this.artes) && !this.artes.some(Boolean)) { this.artes[0] = ex; usou++; } }
          else if (!this[campo]) { this[campo] = ex; usou++; }
        }
        // mostra a miniatura e o botão "Remover" do(s) primeiro(s) campo(s) de arte, pra dar pra tirar a raposa
        if (usou && this.painel) {
          const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ex.dado);
          [...this.painel.querySelectorAll('img.miniatura')].slice(0, usou).forEach(i => { i.src = url; i.hidden = false; });
          [...this.painel.querySelectorAll('button.btn-mini')].filter(b => /^Remover/.test(b.textContent)).slice(0, usou).forEach(b => { b.hidden = false; });
        }
      } catch { /* sem exemplo: o modelo pede a arte normalmente */ }
    },
    desativar(ctx) { clearTimeout(this._t); ctx.desmontarEditor2D?.(); ctx.viewer.desativarSelecao(); ctx.esconderBarra2D?.(); },
    ativo(ctx) { return ctx.abaAtiva === this; },

    montarBarra(ctx) {
      const barra = ctx.barra2D();
      barra.replaceChildren(
        el('button', { class: this.modo2d ? 'ativa' : '', text: 'Editar em 2D', onclick: () => this.trocarModo(ctx, true) }),
        el('button', { class: this.modo2d ? '' : 'ativa', text: 'Visualizar em 3D', onclick: () => this.trocarModo(ctx, false) }),
      );
    },
    trocarModo(ctx, m) {
      this.modo2d = m;
      this.montarBarra(ctx);
      if (m) { ctx.mostrarEditor2D(true); this.desenhar2D(ctx); }
      else { ctx.mostrarEditor2D(false); this.gerar(ctx); }
    },

    // ---- campos que só fazem sentido com arte (SVG/PNG) carregada ----
    // detecta sozinho: propriedades de arte do modelo (que começam nulas) e os campos cujo rótulo/seção fala de arte
    mapearCamposArte(raiz) {
      const nomes = ['arte', 'frente', 'verso', 'logo', 'svg', 'artes'];
      this._propsArte = nomes.filter(n => n in this && (this[n] === null || Array.isArray(this[n])));
      if (!this._propsArte.length) return;
      const RE_SECAO = /^(arte|cabeça \(arte\)|arte na face|arte do disco|arte \(vazada)/i;
      const RE_CAMPO = /arte|logo|s[ií]mbolo|svg|limiar/i;
      this._camposArte = [];
      for (const c of raiz.querySelectorAll('label.campo')) {
        if (c.querySelector('input[type=file]')) continue;            // o próprio campo de enviar fica sempre ligado
        const rot = c.querySelector('.rotulo')?.textContent || '';
        const sec = c.closest('fieldset')?.querySelector('legend')?.textContent || '';
        if (/logo \+ QR/i.test(rot)) continue;                         // mexe no QR também: fica sempre ligado
        if (RE_CAMPO.test(rot) || RE_SECAO.test(sec)) this._camposArte.push({ c, limiar: /limiar/i.test(rot) });
      }
      this.atualizarCamposArte();
    },
    atualizarCamposArte() {
      if (!this._camposArte?.length) return;
      const artes = this._propsArte.flatMap(n => Array.isArray(this[n]) ? this[n] : [this[n]]).filter(Boolean);
      const tem = cfg.temArte ? cfg.temArte.call(this, artes) : artes.length > 0;
      const temPng = artes.some(a => a.tipo === 'img');
      for (const { c, limiar } of this._camposArte) {
        const liga = limiar ? tem && temPng : tem;
        c.classList.toggle('desligado', !liga);
        c.querySelectorAll('input, select, textarea').forEach(i => { i.disabled = !liga; });
        c.title = liga ? '' : (limiar ? 'Só vale pra arte em PNG/JPG.' : 'Envie uma arte (SVG ou PNG) pra usar este ajuste.');
      }
    },

    mudou(ctx) {
      this.atualizarCamposArte();
      clearTimeout(this._t);
      this._t = setTimeout(() => { if (!this.ativo(ctx)) return; if (this.modo2d) this.desenhar2D(ctx); else this.gerar(ctx); }, this.modo2d ? 120 : 260);
    },

    // ---- prévia 2D (canvas), com arraste das partes móveis ----
    async desenhar2D(ctx) {
      const cv = ctx.canvas2D();
      if (!cv || !this.ativo(ctx)) return;
      let comp;
      try { comp = await cfg.compor2D.call(this, ctx); }
      catch (e) { if (this.ativo(ctx)) { this.out.textContent = e.message; ctx.limpar2D(); } return; }
      if (!this.ativo(ctx) || !this.modo2d) return;   // trocou de aba/modo enquanto calculava
      this.comp2D = comp;
      this.pintarChips();
      this.atualizarChips(new Set(comp.partes.filter(q => q.poligonos?.length).map(q => q.id)));
      ctx.desenhar2D(comp, this.cores, {
        aoClicarParte: id => this.selecionar(id),
        aoArrastar: (id, dx, dy) => cfg.arrastar?.call(this, id, dx, dy), // chamado 1x no soltar, com o total
        aoSoltar: () => this.desenhar2D(ctx),
      });
      this.out.innerHTML = '';
      this.out.append(comp.dica || 'Arraste as peças móveis. Clique numa peça pra escolher a cor.');
      if (this.avisoExemplo()) this.out.insertAdjacentHTML('beforeend', this.avisoExemplo());
    },

    // ---- 3D ----
    gerar(ctx) {
      if (!this.ativo(ctx)) return;
      ctx.ocupado('Gerando modelo…', async () => {
        let r;
        try { r = await cfg.gerar.call(this, ctx); }
        catch (e) { if (this.ativo(ctx)) this.out.textContent = e.message; return; }
        // trocou de aba enquanto gerava: descarta, senão o modelo "vaza" pra tela da outra ferramenta
        if (!this.ativo(ctx)) { new Set([...r.partes, ...(r.imprimir || [])].map(([, m]) => m)).forEach(m => m.delete?.()); return; }
        // orçamento pelo volume (antes de liberar as malhas da memória)
        let orc = '';
        try { const { orcar } = await import('./extras-editor.js'); orc = orcar((r.imprimir || r.partes).map(([, m]) => m), r.volumeOrcamento).texto; } catch {}
        this.resultado = r;
        this.previa = r.partes.map(([id, m]) => ({ id, geom: paraGeometria(m) }));
        this.montado = r.montado ? r.montado.map(([id, m]) => ({ id, geom: paraGeometria(m) })) : null;
        // r.imprimir (opcional): arranjo de impressão diferente da vista montada (ex.: troféu em peças)
        this.imprimir = r.imprimir ? r.imprimir.map(([id, m]) => ({ id, geom: paraGeometria(m) })) : null;
        this.centralizar(ctx); // centraliza o conjunto no meio da mesa, qualquer modelo/conteúdo
        if (this.imprimir) this.centralizar(ctx, this.imprimir);
        this.arquivos = this.paraExportar().map(x => ({ geom: x.geom.clone(), nome: `${cfg.id}_${x.id}.stl` }));
        // arquivos deitados na mesa pra impressão
        this.arquivos.forEach(a => { a.geom.computeBoundingBox(); a.geom.translate(0, 0, -a.geom.boundingBox.min.z); });
        new Set([...r.partes, ...(r.imprimir || [])].map(([, m]) => m)).forEach(m => m.delete?.()); // sem apagar 2x a mesma
        this.btn3mf.disabled = this.btnZip.disabled = this.btnAbrir.disabled = false;
        this.atualizarChips(new Set([...r.partes, ...(r.montado || []), ...(r.imprimir || [])].map(([id]) => id)));
        if (!this.modo2d) ctx.mostrarEditor2D(false);
        this.mostrar3D(ctx, true);
        this.out.innerHTML = (r.resumo || 'Modelo pronto. Clique numa peça pra trocar a cor.') + orc + this.avisoExemplo();
      });
    },
    paraExportar() { return this.imprimir || this.montado || this.previa; },
    centralizar(ctx, lista) {
      const itens = lista || this.montado || this.previa;
      const cx = new THREE.Box3();
      for (const it of itens) { it.geom.computeBoundingBox(); cx.union(it.geom.boundingBox); }
      const c = cx.getCenter(new THREE.Vector3());
      const dx = ctx.mesa.x / 2 - c.x, dy = ctx.mesa.y / 2 - c.y;
      for (const it of itens) { it.geom.translate(dx, dy, 0); it.desl = [0, 0, 0]; }
    },
    mostrar3D(ctx, enquadrar = false) {
      const itens = (this.montado || this.previa).map(x => ({ geom: x.geom, cor: this.cores[x.id] ?? 0x8a99a3, deslocar: x.desl || [0, 0, 0] }));
      ctx.viewer.mostrar(itens, { enquadrar });
      // clicar numa peça no 3D seleciona pra pintar
      ctx.viewer.aoClicarObjeto = null; // cor só pelos chips do menu (clicar no 3D não pinta)
    },
    pintar(ctx) {
      this.pintarChips();
      if (this.modo2d) this.desenhar2D(ctx);
      else if (this.previa) this.mostrar3D(ctx);
    },
    pintarChips() { for (const id in this.chips) this.chips[id].querySelector('input').value = HEX(this.cores[id]); },
    // cor de peça de arte/logo/símbolo que não existe agora (ex.: arte removida) fica desligada
    atualizarChips(idsPresentes) {
      const RE = /arte|logo|s[ií]mbolo|svg/i;
      for (const pt of cfg.partes) {
        const chip = this.chips?.[pt.id];
        if (!chip) continue;
        const deArte = RE.test(pt.id) || RE.test(pt.nome);
        const liga = !deArte || idsPresentes.has(pt.id);
        chip.classList.toggle('desligado', !liga);
        chip.querySelector('input').disabled = !liga;
        chip.title = liga ? '' : 'Essa peça não existe agora (sem arte carregada).';
      }
    },
    selecionar(id) {
      if (!id) return;
      this.parteSel = id;
      for (const k in this.chips) this.chips[k].classList.toggle('sel', k === id);
    },

    baixar3mf(ctx) {
      const partes = this.paraExportar().map(x => ({ geom: x.geom, nome: `${cfg.id}_${x.id}.stl`, cor: this.cores[x.id] }));
      baixar3MF(partes, `${cfg.id}.3mf`, this.resultado?.pausas ? { pausas: this.resultado.pausas, ...(this.resultado.camadas || {}) } : {});
    },
    abrir(ctx) {
      const g = assentar(this.arquivos[0].geom.clone(), ctx.mesa);
      ctx.definirPeca(g, { nome: this.arquivos[0].nome, enquadrar: true });
      ctx.log('Peça principal aberta nas ferramentas. As outras estão nos downloads.', 'ok');
    },
  };
}
