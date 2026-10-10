import { criarEditorModelo } from './editor.js';
import { textoParaSecao } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoSuporteMesa, perfilSuporteMesa } from './geo.js';
import { deslizante, escolha, campoTexto, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);
// medidas prontas por aparelho (o usuário ainda pode ajustar tudo)
const PRESETS = {
  celular: { profundidade: 85, espessura: 5, alturaLabio: 12, vao: 13, alturaEncosto: 95, angulo: 65, largura: 75, furoCabo: 12, alturaTexto: 10 },
  tablet: { profundidade: 110, espessura: 6, alturaLabio: 14, vao: 14, alturaEncosto: 130, angulo: 68, largura: 140, furoCabo: 14, alturaTexto: 12 },
  controle: { profundidade: 110, espessura: 6, alturaLabio: 30, vao: 45, alturaEncosto: 110, angulo: 70, largura: 90, furoCabo: 0, alturaTexto: 18 },
};

export default criarEditorModelo({
  id: 'suporte-mesa', nome: 'Suporte de Mesa com Nome (celular/tablet/controle)',
  descricao: 'Suporte de mesa com o nome em relevo na frente. Medidas prontas pra celular, tablet ou controle de videogame (PS/Xbox). Imprime deitado de lado, sem suporte.',
  partes: [
    { id: 'corpo', nome: 'Suporte', cor: 0x1f2328 },
    { id: 'texto', nome: 'Nome', cor: 0x2fd3a0 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.tipo = escolha(s, 'Pra quê', [['celular', 'Celular'], ['tablet', 'Tablet'], ['controle', 'Controle (PS/Xbox)']], 'celular',
      { dica: 'Trocar aqui aplica as medidas prontas daquele aparelho.' });
    this.tipo.input.addEventListener('change', () => {
      const pr = PRESETS[this.tipo()];
      for (const [k, v] of Object.entries(pr)) this[k]?.definir?.(v);
      mudou();
    });
    this.nomeTxt = campoTexto(s, 'Nome na frente', 'ALAN');
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Bangers-Regular.ttf', { aoMudar: mudou });
    aoMudar([this.nomeTxt], mudou);
    texto(s, 'Imprima deitado de lado (como sai no arquivo): fica forte e sem suporte. O nome fica na aba da frente.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const P = PRESETS.celular, sm = secao(raiz, 'Medidas');
    this.largura = d(sm, 'Largura', P.largura, { min: 30, max: 220, passo: 1 });
    this.profundidade = d(sm, 'Profundidade (base)', P.profundidade, { min: 40, max: 200, passo: 1 });
    this.alturaEncosto = d(sm, 'Altura do encosto', P.alturaEncosto, { min: 30, max: 200, passo: 1 });
    this.angulo = deslizante(sm, 'Inclinação do encosto', P.angulo, { min: 45, max: 85, passo: 1, un: '°', aoMudar: mudou });
    this.vao = d(sm, 'Vão do aparelho', P.vao, { min: 6, max: 80, passo: 0.5, dica: 'Espessura do aparelho + capinha + folga (controle: espessura do cabo/pegada).' });
    this.alturaLabio = d(sm, 'Altura da aba da frente', P.alturaLabio, { min: 5, max: 60, passo: 0.5 });
    this.espessura = d(sm, 'Espessura das paredes', P.espessura, { min: 3, max: 12, passo: 0.5 });
    this.furoCabo = d(sm, 'Rasgo pro cabo', P.furoCabo, { min: 0, max: 30, passo: 0.5, dica: '0 = sem rasgo.' });
    const st = secao(raiz, 'Nome');
    this.alturaTexto = d(st, 'Altura do nome', P.alturaTexto, { min: 4, max: 50, passo: 0.5 });
    this.relevo = d(st, 'Relevo', 1.2, { min: 0.4, max: 3, passo: 0.1 });
  },
  async formas() {
    const n = (this.nomeTxt() || '').trim();
    return { texto: n ? textoParaSecao(await obterFonte(this.fonte()), n, { altura: 10 }) : null };
  },
  parametros() {
    const k = ['largura', 'profundidade', 'alturaEncosto', 'angulo', 'vao', 'alturaLabio', 'espessura', 'furoCabo', 'alturaTexto', 'relevo'];
    return Object.fromEntries(k.map(n => [n, this[n]()]));
  },
  async compor2D(ctx) {
    const p = this.parametros();
    const { perfil } = perfilSuporteMesa(p), b = perfil.bounds();
    return {
      largura: b.max[0] - b.min[0] + 30, altura: (b.max[1] - b.min[1]) * 2 + 30,
      partes: [{ id: 'corpo', poligonos: poligonosDe(perfil.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2])) }],
      dica: 'Vista de lado (o aparelho fica à direita, apoiado no encosto). Veja o nome em "Visualizar em 3D".',
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const r = geoSuporteMesa(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.montado, montado: r.montado.map(([id, m]) => [id, m, [cx, cy, 0]]), imprimir: r.imprimir,
      resumo: `Suporte ${p.largura} mm de largura, encosto de ${p.alturaEncosto} mm a ${p.angulo}°, vão de ${p.vao} mm. O arquivo sai deitado de lado, pronto pra imprimir.`,
    };
  },
});
