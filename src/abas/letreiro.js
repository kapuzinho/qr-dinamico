import { M, paraGeometria, assentar } from '../core/motor.js';
import { baixar3MF } from '../core/arquivos.js';
import { textoParaSecao, tamanho } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { areaTexto, campoTexto, numero, escolha, marcar, botao, acoes, saida, secao, subAbas, tabela, texto } from '../core/ui.js';

// ---------- geometria (tudo com o texto centrado em 0,0) ----------
export function formaBase(cs, formato, margem, raio) {
  const { CrossSection } = M();
  const [w, h] = tamanho(cs);
  if (formato === 'circ') return CrossSection.circle(Math.hypot(w, h) / 2 + margem, 128);
  return retanguloArredondado(w + 2 * margem, h + 2 * margem, raio);
}
function retanguloArredondado(W, H, raio) {
  const { CrossSection } = M();
  const r = Math.max(0, Math.min(raio, W / 2 - 0.05, H / 2 - 0.05));
  return r > 0 ? CrossSection.square([W - 2 * r, H - 2 * r], true).offset(r, 'Round', 2, 64) : CrossSection.square([W, H], true);
}
const emPe = (c, esp) => c.extrude(esp).translate([0, 0, -esp / 2]).rotate([90, 0, 0]); // y da letra vira z

export function geoRebaixo(cs, p) {
  if (p.orient === 'empe') {
    const [w] = tamanho(cs);
    const D = Math.max(p.profY, p.espLetras + 2 * p.folga + 4);
    const base = retanguloArredondado(w + 2 * p.margem, D, p.raio).extrude(p.espBase);
    const zPiso = p.espBase - p.prof;
    const off = cs.offset(p.folga, 'Round', 2, 32);
    const corte = emPe(off, p.espLetras + 2 * p.folga).translate([0, 0, zPiso - off.bounds().min[1]]);
    const peca = base.subtract(corte);
    const letraPe = emPe(cs, p.espLetras).translate([0, 0, zPiso - cs.bounds().min[1]]);
    return { previa: [peca, letraPe], arquivos: [['base', peca], ['letras', cs.extrude(p.espLetras)]], extras: [base, corte, letraPe] };
  }
  const base = formaBase(cs, p.formato, p.margem, p.raio).extrude(p.espBase);
  const corte = cs.offset(p.folga, 'Round', 2, 32).extrude(p.prof + 1).translate([0, 0, p.espBase - p.prof]);
  const peca = base.subtract(corte);
  const letras = cs.extrude(p.espLetras);
  const letrasNoLugar = letras.translate([0, 0, p.espBase - p.prof]);
  return { previa: [peca, letrasNoLugar], arquivos: [['base', peca], ['letras', letras]], extras: [base, corte, letrasNoLugar] };
}

export function geoSoldado(cs, p) {
  const base = formaBase(cs, p.formato, p.margem, p.raio).extrude(p.espBase);
  const letras = cs.extrude(p.espLetras + 0.01).translate([0, 0, p.espBase - 0.01]);
  const peca = base.add(letras);
  return { previa: [peca], arquivos: [['letreiro', peca]], extras: [base, letras] };
}

export function geoSemBase(cs, p) {
  const letras = cs.extrude(p.espLetras);
  return { previa: [letras], arquivos: [['letras', letras]] };
}

export function geoContorno(cs, p) {
  const contorno = cs.offset(p.contorno, 'Round', 2, 48).extrude(p.espC);
  const preench = cs.extrude(p.relevo).translate([0, 0, p.espC]);
  return { previa: [contorno, preench], arquivos: [['contorno', contorno], ['preenchimento', preench]] };
}

const contem = (c, x, y) => c.intersect(M().CrossSection.square([0.2, 0.2], true).translate([x, y])).area() > 0.039;

// acha um ponto dentro da região, preferindo o centro ou um dos lados
function pontoDentro(c, pos = 'centro') {
  const b = c.bounds(), cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
  const nota = {
    centro: (x, y) => Math.hypot(x - cx, y - cy),
    baixo: (x, y) => y * 10 + Math.abs(x - cx), cima: (x, y) => -y * 10 + Math.abs(x - cx),
    esquerda: (x, y) => x * 10 + Math.abs(y - cy), direita: (x, y) => -x * 10 + Math.abs(y - cy),
  }[pos] || ((x, y) => Math.hypot(x - cx, y - cy));
  let melhor = null, dm = Infinity;
  for (let i = 0; i <= 16; i++) {
    for (let j = 0; j <= 16; j++) {
      const x = b.min[0] + ((b.max[0] - b.min[0]) * i) / 16, y = b.min[1] + ((b.max[1] - b.min[1]) * j) / 16;
      if (contem(c, x, y)) { const d = nota(x, y); if (d < dm) { dm = d; melhor = [x, y]; } }
    }
  }
  return melhor;
}

// p.posFuro: centro | baixo | cima | esquerda | direita | manual; p.quais: todas | primeira | ultima | nenhuma
export function geoCanal(cs, p) {
  const { CrossSection } = M();
  const casca = cs.extrude(p.prof).subtract(cs.offset(-p.parede, 'Round', 2, 32).extrude(p.prof - p.face + 0.01).translate([0, 0, -0.01]));
  const recuo = p.parede + p.furo / 2 + 0.5; // o furo precisa caber dentro da parede, com uma folguinha
  const furos = [];
  let semFuro = 0, foraDaLetra = 0;
  if (p.posFuro === 'manual') {
    const dentro = cs.offset(-recuo, 'Round', 2, 32);
    for (const [x, y] of p.manuais || []) {
      if (!contem(dentro, x, y)) foraDaLetra++;
      furos.push(CrossSection.circle(p.furo / 2, 48).translate([x, y]));
    }
  } else if (p.quais !== 'nenhuma') {
    let letras = cs.decompose().sort((a, b) => a.bounds().min[0] - b.bounds().min[0]);
    if (p.quais === 'primeira') letras = letras.slice(0, 1);
    if (p.quais === 'ultima') letras = letras.slice(-1);
    for (const letra of letras) {
      const dentro = letra.offset(-recuo, 'Round', 2, 32);
      const pt = dentro.isEmpty() ? null : pontoDentro(dentro, p.posFuro);
      if (pt) furos.push(CrossSection.circle(p.furo / 2, 48).translate(pt));
      else semFuro++;
    }
  }
  const tampa = (furos.length ? cs.subtract(CrossSection.union(furos)) : cs).extrude(p.espTampa);
  // prévia: tampa logo atrás da letra (com um vão pra enxergar); .3mf: tampa encostada atrás, na posição de montagem
  const tampaPrevia = tampa.translate([0, 0, -p.espTampa - 8]);
  const tampaMontada = tampa.translate([0, 0, -p.espTampa]);
  const areaUtil = cs.offset(-recuo, 'Round', 2, 32).toPolygons();
  return {
    previa: [casca, tampaPrevia], arquivos: [['canal', casca], ['tampa', tampa]], montados: [['canal', casca], ['tampa', tampaMontada]],
    extras: [tampaPrevia, tampaMontada], areaUtil, semFuro, foraDaLetra, furos: furos.length,
  };
}

export function geoLetraGrande(csLetra, csNome, p) {
  const letra = csLetra.extrude(p.espLetra);
  const [, hL] = tamanho(csLetra);
  const nome = csNome.translate([0, (p.desloc / 100) * hL]).extrude(p.espNome);
  if (p.modo === 'soldado') { const u = letra.add(nome); return { previa: [u], arquivos: [['letra_nome', u]], extras: [letra, nome] }; }
  return { previa: [letra, nome], arquivos: [['letra', letra], ['nome', nome]] };
}

// ---------- aba ----------
const SUB = ['Rebaixo', 'Soldado', 'Sem base', 'Contorno 3D', 'Canal (LED)', 'Letra grande + nome'];
const COR = [0x0f7c80, 0xb8893a];

export default {
  id: 'letreiro', grupo: 'Personalizar', nome: 'Letreiro',
  descricao: 'Nomes e letreiros a partir de texto: base com rebaixo pra encaixar as letras, peça soldada, só letras, contorno tipo adesivo, letra canal pra LED ou letra grande com nome.',
  montar(raiz, ctx) {
    const sc = secao(raiz, 'Texto');
    this.texto = areaTexto(sc, 'Texto', 'Alan', { linhas: 1 });
    this.fonte = seletorFonte(sc, 'Fonte', 'emb:Pacifico-Regular.ttf', { dica: 'Fontes cursivas com letras ligadas (Pacifico, Lobster) saem numa peça só.' });
    this.negrito = marcar(sc, 'Negrito', false);
    this.alturaL = numero(sc, 'Altura das letras', 40, { un: 'mm' });
    this.espaco = numero(sc, 'Espaço entre letras', 0, { passo: 0.01, dica: 'Fração do tamanho da letra. Negativo aproxima e ajuda a soldar letras cursivas.' });
    this.margem = numero(sc, 'Margem da base', 6, { un: 'mm', dica: 'Sobra de base em volta do texto.' });

    const subs = subAbas(raiz, SUB, i => { this.sub = i; this.atualizarSelecao(ctx); });
    const [pr, ps, pb, pc, pl, pg] = subs.paineis;
    const base = pai => ({
      formato: escolha(pai, 'Formato da base', [['ret', 'Retangular'], ['circ', 'Circular']], 'ret'),
      raio: numero(pai, 'Raio dos cantos', 4, { un: 'mm', dica: 'Só na base retangular. 0 deixa canto vivo.' }),
    });
    this.r = {
      orient: escolha(pr, 'Orientação', [['deitado', 'Deitado'], ['empe', 'Em pé (placa de mesa)']], 'deitado',
        { dica: 'Em pé: a letra é impressa deitada e depois encaixa em pé na fresta da base, que segue o contorno real das letras.' }),
      ...base(pr),
      espBase: numero(pr, 'Espessura da base', 6, { un: 'mm' }),
      prof: numero(pr, 'Profundidade do rebaixo', 3, { un: 'mm', dica: 'Pra texto em pé numa fresta rasa (tipo placa "Direito"), 3 a 5 mm.' }),
      espLetras: numero(pr, 'Espessura das letras', 4, { un: 'mm', dica: 'No modo em pé vira a grossura da letra na frente da placa.' }),
      folga: numero(pr, 'Folga do encaixe', 0.2, { un: 'mm', passo: 0.05, dica: 'Aumenta só o rebaixo; a letra fica no tamanho normal. 0,15 a 0,25 mm encaixa justo.' }),
      profY: numero(pr, 'Profundidade da base (Y)', 25, { un: 'mm', dica: 'Só no modo em pé: quanto a base vai pra trás.' }),
    };
    this.s = { ...base(ps), espBase: numero(ps, 'Espessura da base', 3, { un: 'mm' }), espLetras: numero(ps, 'Altura das letras sobre a base', 3, { un: 'mm' }) };
    this.b = { espLetras: numero(pb, 'Espessura das letras', 5, { un: 'mm' }) };
    this.c = {
      contorno: numero(pc, 'Largura do contorno', 3, { un: 'mm', dica: 'Quanto a borda passa pra fora das letras.' }),
      espC: numero(pc, 'Espessura do contorno', 3, { un: 'mm' }),
      relevo: numero(pc, 'Relevo das letras', 1.5, { un: 'mm', dica: 'As letras ficam em cima do contorno. Carregue os dois arquivos juntos como uma peça só pra imprimir em duas cores.' }),
    };
    this.l = {
      prof: numero(pl, 'Profundidade da letra', 30, { un: 'mm' }),
      parede: numero(pl, 'Parede lateral', 1.6, { un: 'mm' }),
      face: numero(pl, 'Face da frente', 1.2, { un: 'mm', dica: 'Espessura da frente, por onde a luz passa. Em PETG translúcido, 0,8 a 1,2 mm.' }),
      espTampa: numero(pl, 'Espessura da tampa', 2, { un: 'mm', dica: 'A tampa traseira tem o tamanho externo da letra e cobre por fora.' }),
      furo: numero(pl, 'Furo do fio', 5, { un: 'mm' }),
      posFuro: escolha(pl, 'Posição do furo', [['centro', 'Mais perto do centro'], ['baixo', 'Embaixo da letra'], ['cima', 'Em cima da letra'], ['esquerda', 'Lado esquerdo'], ['direita', 'Lado direito'], ['manual', 'Escolher clicando']], 'centro',
        { dica: 'Em "Escolher clicando", pré-visualize e clique na letra onde quer cada furo. O contorno vermelho mostra onde o furo cabe (dentro da parede).' }),
      quais: escolha(pl, 'Furo em quais letras', [['todas', 'Todas'], ['primeira', 'Só na primeira'], ['ultima', 'Só na última'], ['nenhuma', 'Nenhuma']], 'todas',
        { dica: 'Se as letras vão ligadas por fio entre si, dá pra furar só uma. Não vale no modo manual.' }),
    };
    this.manuais = [];
    const acManual = acoes(pl);
    this.btnAddFuro = botao(acManual, 'Adicionar furo no ponto marcado', () => this.adicionarFuro(ctx));
    this.btnLimparFuros = botao(acManual, 'Limpar furos', () => { this.manuais = []; this.gerar(ctx); });
    this.infoManual = texto(pl, '');
    this.l.posFuro.input.addEventListener('change', () => this.atualizarSelecao(ctx));
    this.g = {
      letra: campoTexto(pg, 'Letra', 'M'),
      fonteLetra: seletorFonte(pg, 'Fonte da letra', 'emb:Anton-Regular.ttf'),
      alturaLetra: numero(pg, 'Altura da letra', 120, { un: 'mm' }),
      espLetra: numero(pg, 'Espessura da letra', 6, { un: 'mm' }),
      nome: campoTexto(pg, 'Nome', 'miguel'),
      fonteNome: seletorFonte(pg, 'Fonte do nome', 'emb:Pacifico-Regular.ttf'),
      alturaNome: numero(pg, 'Altura do nome', 35, { un: 'mm' }),
      espNome: numero(pg, 'Espessura do nome', 9, { un: 'mm', dica: 'Mais grosso que a letra faz o nome saltar pra frente.' }),
      desloc: numero(pg, 'Posição vertical do nome', 0, { un: '%', passo: 5, dica: '0 = centro da letra. Positivo sobe, negativo desce (em % da altura da letra).' }),
      modo: escolha(pg, 'Arquivos', [['separados', 'Letra e nome separados'], ['soldado', 'Tudo numa peça só']], 'separados'),
    };

    const a = acoes(raiz);
    botao(a, 'Pré-visualizar', () => this.gerar(ctx), { primario: true });
    this.btnBaixar = botao(a, 'Baixar arquivos (.zip)', () => ctx.baixarZip(this.arquivos, `letreiro_${this.slug()}.zip`));
    this.btn3mf = botao(a, 'Baixar .3mf (partes montadas)', () => baixar3MF(this.montados || this.arquivos, `letreiro_${this.slug()}.3mf`));
    this.btnAbrir = botao(a, 'Editar na área de trabalho', () => {
      const g = assentar(this.arquivos[0].geom.clone(), ctx.mesa);
      ctx.definirPeca(g, { nome: this.arquivos[0].nome, enquadrar: true });
      ctx.log('Peça principal aberta. Agora dá pra usar as outras ferramentas nela.', 'ok');
    });
    this.btnBaixar.disabled = this.btnAbrir.disabled = true;
    this.btn3mf.hidden = true;
    this.out = saida(raiz);
    this.atualizarSelecao(ctx);
  },
  slug() { return (this.sub === 5 ? this.g.nome() : this.texto()).trim().toLowerCase().replace(/[^a-z0-9]+/gi, '_').slice(0, 30) || 'texto'; },
  ativar(ctx) { if (this.previa) this.mostrar(ctx); this.atualizarSelecao(ctx); },
  desativar(ctx) { ctx.viewer.desativarSelecao(); },
  manual() { return this.sub === 4 && this.l?.posFuro() === 'manual'; },
  atualizarSelecao(ctx) {
    if (!this.l) return;
    const on = this.manual();
    this.btnAddFuro.hidden = this.btnLimparFuros.hidden = this.infoManual.hidden = !on;
    if (ctx.abaAtiva !== this) return;
    if (on) {
      if (this.areaUtil && this.previa) ctx.viewer.linhas2D(this.areaUtil, this.l.prof() + 0.3, [ctx.mesa.x / 2, ctx.mesa.y / 2]);
      ctx.viewer.vista('cima');
      ctx.viewer.ativarSelecao({ raio: this.l.furo() / 2, dir: [0, 0, -1] });
      this.infoManual.textContent = `${this.manuais.length} furo(s) marcado(s). Clique dentro do contorno vermelho e depois em Adicionar. Se não aparecer contorno, o traço é fino demais pro furo: aumente a letra, ligue o Negrito, ou diminua o furo ou a parede.`;
    } else { ctx.viewer.desativarSelecao(); ctx.viewer.limparExtras(); }
  },
  adicionarFuro(ctx) {
    const p = ctx.viewer.ponto, obj = ctx.viewer.objetoPonto;
    if (!p || !obj) return ctx.log('Clique na letra ou na tampa, na vista de cima, pra marcar o furo.', 'erro');
    this.manuais.push([p.x - obj.position.x, p.y - obj.position.y]);
    ctx.viewer.limparPonto();
    this.gerar(ctx);
  },
  valores(obj) { return Object.fromEntries(Object.entries(obj).map(([k, f]) => [k, f()])); },
  gerar(ctx) {
    ctx.ocupado('Gerando letreiro…', async () => {
      const alt = this.alturaL();
      const extra = { espacamento: this.espaco(), negrito: this.negrito() ? alt * 0.035 : 0 };
      let r;
      if (this.sub === 5) {
        const g = this.valores(this.g);
        const csL = textoParaSecao(await obterFonte(g.fonteLetra), g.letra, { altura: g.alturaLetra });
        const csN = textoParaSecao(await obterFonte(g.fonteNome), g.nome, { altura: g.alturaNome, espacamento: this.espaco() });
        r = geoLetraGrande(csL, csN, g);
      } else {
        const cs = textoParaSecao(await obterFonte(this.fonte()), this.texto(), { altura: alt, ...extra });
        const m = this.margem();
        r = [
          () => geoRebaixo(cs, { ...this.valores(this.r), margem: m }),
          () => geoSoldado(cs, { ...this.valores(this.s), margem: m }),
          () => geoSemBase(cs, this.valores(this.b)),
          () => geoContorno(cs, this.valores(this.c)),
          () => geoCanal(cs, { ...this.valores(this.l), manuais: this.manuais }),
        ][this.sub]();
      }
      const slug = this.slug();
      this.previa = r.previa.map(m => paraGeometria(m));
      this.deslocamentos = null;
      this.areaUtil = r.areaUtil || null;
      this.montados = r.montados ? r.montados.map(([n, m], i) => ({ geom: paraGeometria(m), nome: `letreiro_${slug}_${n}.stl`, cor: COR[i % 2] })) : null;
      this.arquivos = r.arquivos.map(([n, m], i) => ({ geom: paraGeometria(m), nome: `letreiro_${slug}_${n}.stl`, cor: COR[i % 2] }));
      new Set([...r.previa, ...r.arquivos.map(x => x[1]), ...(r.extras || [])]).forEach(m => m.delete());
      this.btnBaixar.disabled = this.btnAbrir.disabled = false;
      // .3mf só onde as partes já saem encaixadas uma na outra (contorno 3D e letra grande + nome)
      this.btn3mf.hidden = !(this.sub === 3 || this.sub === 4 || (this.sub === 5 && this.arquivos.length > 1));
      this.mostrar(ctx, true);
      const g0 = this.arquivos[0].geom.boundingBox;
      const linhas = [['Tamanho', `${(g0.max.x - g0.min.x).toFixed(1)} × ${(g0.max.y - g0.min.y).toFixed(1)} × ${(g0.max.z - g0.min.z).toFixed(1)} mm`], ['Arquivos', this.arquivos.map(a => a.nome.replace(`letreiro_${slug}_`, '')).join(', ')]];
      if (this.sub === 4) linhas.push(['Furos na tampa', r.furos]);
      if (r.semFuro) linhas.push(['Letras sem furo pro fio', `${r.semFuro} (traço fino demais: diminua o furo ou aumente a letra)`, 'aviso']);
      if (r.foraDaLetra) linhas.push(['Furos fora da área útil', `${r.foraDaLetra}: marque dentro do contorno vermelho`, 'aviso']);
      if (this.sub === 4 && r.areaUtil && !r.areaUtil.length) linhas.push(['Área útil pro furo', 'nenhuma: traço fino demais, veja a dica abaixo', 'aviso']);
      this.out.innerHTML = tabela(linhas);
      ctx.log('Letreiro gerado. Confira na prévia e baixe os arquivos.', 'ok');
    });
  },
  mostrar(ctx, enquadrar = false) {
    const d = [ctx.mesa.x / 2, ctx.mesa.y / 2, 0];
    ctx.viewer.mostrar(this.previa.map((geom, i) => {
      const e = this.deslocamentos?.[i] || [0, 0, 0];
      return { geom, cor: COR[i % 2], deslocar: [d[0] + e[0], d[1] + e[1], d[2] + e[2]] };
    }));
    if (enquadrar && !this.manual()) ctx.viewer.vista(this.sub === 4 ? 'baixoIso' : 'iso');
    this.atualizarSelecao(ctx);
  },
};
