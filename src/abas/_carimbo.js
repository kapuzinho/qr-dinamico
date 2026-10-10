// Base comum das abas que carimbam uma forma 2D na superfície (Gravar texto, Carimbar imagem, QR code)
import { paraGeometria, OPCOES_VISTA } from '../core/motor.js';
import { baixar3MF } from '../core/arquivos.js';
import { carimbar, baseDaVista, baseDaNormal } from '../core/carimbo.js';
import { tamanho } from '../core/formas.js';
import { numero, escolha, marcar, botao, acoes, secao, saida, presets, aoMudar, deslizante, cor } from '../core/ui.js';

const HEXN = s => parseInt(String(s).replace('#', ''), 16);

export function criarAbaCarimbo(cfg) {
  return {
    id: cfg.id, grupo: 'Personalizar', nome: cfg.nome, descricao: cfg.descricao,
    montar(raiz, ctx) {
      this.campos = {};
      const mudou = () => this.agendarContorno(ctx);
      this.forma = cfg.montarForma.call(this, secao(raiz, cfg.tituloForma), ctx, mudou, this.campos);

      const s1 = secao(raiz, 'Posição');
      this.vista = escolha(s1, 'Lado da peça', [['auto', 'Onde eu clicar (segue a face)'], ...OPCOES_VISTA], 'auto',
        { dica: '"Onde eu clicar": o desenho deita na face que você clicar, até em face inclinada. As outras opções projetam reto a partir de um lado.' });
      this.rot = deslizante(s1, 'Rotação', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou, dica: 'Gira o desenho na superfície.' });
      const ag = acoes(s1);
      botao(ag, '⟲ 15°', () => this.girar(-15));
      botao(ag, '⟳ 15°', () => this.girar(15));
      botao(ag, '↻ 90°', () => this.girar(90));
      this.dx = deslizante(s1, 'Mover pro lado', 0, { min: -100, max: 100, passo: 0.5, un: 'mm', aoMudar: mudou, dica: 'Ajuste fino depois de clicar na peça (setas ← → do teclado também, com Shift = 5 mm).' });
      this.dy = deslizante(s1, 'Mover pra cima/baixo', 0, { min: -100, max: 100, passo: 0.5, un: 'mm', aoMudar: mudou, dica: 'Setas ↑ ↓ do teclado também. Q/E giram 5°.' });

      const s2 = secao(raiz, 'Acabamento');
      this.modo = escolha(s2, 'Tipo', [['relevo', 'Em relevo (saliente)'], ['gravar', 'Gravado (entalhado)']], 'relevo');
      this.altura = numero(s2, 'Altura do relevo', 1, { un: 'mm', dica: 'Quanto o desenho sobe acima da superfície (modo relevo).' });
      this.prof = numero(s2, 'Profundidade do entalhe', 0.8, { un: 'mm', dica: 'Quanto o desenho afunda na peça (modo gravado).' });
      this.corPeca = cor(s2, 'Cor da peça', '#0f7c80', { dica: 'Vai assim pro .3mf (e pra prévia).' });
      this.corDet = cor(s2, 'Cor do desenho', '#b8893a');
      this.separado = marcar(s2, 'Exportar peça e detalhe separados', false, { dica: 'Gera dois arquivos pra pintar de cor diferente no Bambu Studio (carregue os dois juntos como uma peça só), em vez de fundir.' });

      Object.assign(this.campos, { vista: this.vista, rot: this.rot, dx: this.dx, dy: this.dy, modo: this.modo, altura: this.altura, prof: this.prof,
        separado: this.separado, corPeca: this.corPeca, corDet: this.corDet });
      presets(raiz, cfg.id, this.campos, () => this.ativar(ctx));
      this.vista.input.addEventListener('change', () => this.ativar(ctx));
      // trocar a cor só repinta (e vale pro próximo download)
      for (const c of [this.corPeca, this.corDet]) c.input.addEventListener('input', () => this.repintar(ctx));
      aoMudar([this.modo, this.altura, this.prof], () => {
        if (!this.separados) return;
        this.separados = null;
        this.btnSep.disabled = this.btn3mf.disabled = true;
        this.out.textContent = 'Configuração mudou: clique em Aplicar de novo pra gerar os arquivos com ela.';
      });

      const a = acoes(raiz);
      botao(a, 'Aplicar na peça', () => this.aplicar(ctx), { primario: true });
      this.btnSep = botao(a, 'Baixar separados (.zip)', () => ctx.baixarZip(this.separados, `${ctx.nomeBase()}_${cfg.id}.zip`));
      this.btn3mf = botao(a, 'Baixar .3mf (peça + detalhe)', () => baixar3MF(this.comCores(this.separados), `${ctx.nomeBase()}_${cfg.id}.3mf`));
      this.btnSep.disabled = this.btn3mf.disabled = true;
      cfg.montarExtra?.call(this, raiz, ctx);
      this.out = saida(raiz);

      // atalhos de teclado enquanto a aba está aberta (fora de campos de texto)
      this._tecla = e => {
        if (ctx.abaAtiva !== this || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
        const st = e.shiftKey ? 5 : 0.5;
        const k = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
        if (k) { e.preventDefault(); this.dx.definir(+(this.dx() + k[0]).toFixed(1)); this.dy.definir(+(this.dy() + k[1]).toFixed(1)); return; }
        if (e.key === 'q' || e.key === 'Q') this.girar(-5);
        if (e.key === 'e' || e.key === 'E') this.girar(5);
      };
      window.addEventListener('keydown', this._tecla);
    },
    girar(g) {
      let v = this.rot() + g;
      while (v > 180) v -= 360;
      while (v < -180) v += 360;
      this.rot.definir(v);
    },
    cores() { return { peca: HEXN(this.corPeca()), det: HEXN(this.corDet()) }; },
    comCores(lista) {
      if (!lista) return lista;
      const c = this.cores();
      return lista.map((x, i) => ({ ...x, cor: i === 0 ? c.peca : c.det }));
    },
    // mostra a peça (e o desenho aplicado, se houver) com as cores escolhidas
    repintar(ctx) {
      if (ctx.abaAtiva !== this || !ctx.peca) return;
      const atual = this._mostrando && this._geomRef === ctx.peca.geom ? this._mostrando : [{ geom: ctx.peca.geom }];
      ctx.viewer.mostrar(this.comCores(atual));
      if (ctx.viewer.ponto && ctx.viewer.selecao) ctx.viewer.desenharMarcador();
    },
    // base (eixos) do desenho: fixa pela vista, ou da face clicada
    base() {
      if (this.vista() === 'auto') return this._baseAuto || baseDaVista('cima');
      return baseDaVista(this.vista());
    },
    ativar(ctx) {
      if (this.vista() !== 'auto') ctx.viewer.vista(this.vista());
      this.repintar(ctx);
      this.atualizarContorno(ctx);
    },
    desativar(ctx) { clearTimeout(this._t); ctx.viewer.desativarSelecao(); ctx.mostrarAtual?.(); },
    agendarContorno(ctx) { clearTimeout(this._t); this._t = setTimeout(() => this.atualizarContorno(ctx), 150); },
    async formaFinal() {
      let cs = await this.forma();
      if (this.rot()) cs = cs.rotate(this.rot());
      if (this.dx() || this.dy()) cs = cs.translate([this.dx(), this.dy()]);
      return cs;
    },
    async atualizarContorno(ctx) {
      if (ctx.abaAtiva !== this) return;
      const base = this.base();
      const auto = this.vista() === 'auto' ? n => { this._baseAuto = baseDaNormal(n); return this._baseAuto; } : null;
      try {
        const cs = await this.formaFinal();
        if (ctx.abaAtiva !== this) return;
        ctx.viewer.ativarSelecao({ dir: base.D.toArray(), forma: cs.toPolygons(), base, auto });
        const [w, h] = tamanho(cs);
        this.out.textContent = `Tamanho do desenho: ${w.toFixed(1)} × ${h.toFixed(1)} mm. Clique e arraste na peça pra posicionar`
          + (this.vista() === 'auto' ? ' (ele deita na face onde você soltar).' : '.') + ' Setas movem, Q/E giram.';
      } catch (e) {
        ctx.viewer.ativarSelecao({ dir: base.D.toArray(), raio: 3, auto });
        this.out.textContent = e.message;
      }
    },
    aplicar(ctx) {
      if (!ctx.temPeca()) return;
      const p = ctx.viewer.ponto?.clone();
      if (!p) return ctx.log('Clique e arraste na peça pra posicionar o contorno vermelho.', 'erro');
      ctx.ocupado('Aplicando na superfície…', async () => {
        const cs = await this.formaFinal();
        const sep = this.separado();
        const antes = ctx.peca.geom;
        const r = carimbar(ctx.manifold(), antes, cs, { base: this.base(), ponto: p, modo: this.modo(), altura: this.altura(), prof: this.prof() });
        const gPeca = this.modo() === 'gravar' ? paraGeometria(r.pecaSeparada) : antes;
        const gDet = paraGeometria(r.detalhe);
        this.separados = [{ geom: gPeca, nome: `${ctx.nomeBase()}_peca.stl` }, { geom: gDet, nome: `${ctx.nomeBase()}_${cfg.id}.stl` }];
        this.btnSep.disabled = this.btn3mf.disabled = false;
        if (sep) {
          // a peça aberta não muda: dá pra trocar relevo/gravado e aplicar de novo sempre a partir do original
          this._mostrando = [{ geom: gPeca }, { geom: gDet }];
          this._geomRef = ctx.peca.geom;
          ctx.viewer.mostrar(this.comCores(this._mostrando));
          ctx.log(`Pronto (${this.modo() === 'relevo' ? 'relevo' : 'gravado'}). Baixe o .3mf ou o .zip; a peça aberta continua sem alteração.`, 'ok');
        } else {
          ctx.definirPeca(paraGeometria(r.final));
          // a peça vira a versão fundida, mas na tela aparece em 2 cores (peça + desenho), igual vai pro .3mf
          this._mostrando = [{ geom: gPeca }, { geom: gDet }];
          this._geomRef = ctx.peca.geom;
          ctx.viewer.mostrar(this.comCores(this._mostrando));
          ctx.log('Aplicado na peça. Os botões .3mf e .zip também baixam peça e detalhe separados desta aplicação, com as cores escolhidas.', 'ok');
        }
        this.out.textContent = 'Arquivos prontos pra baixar.';
        r.liberar();
        ctx.viewer.limparPonto();
      });
    },
  };
}
