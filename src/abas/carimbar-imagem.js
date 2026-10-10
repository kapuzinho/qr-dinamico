import { criarAbaCarimbo } from './_carimbo.js';
import { imagemParaSecao, svgParaSecao, lerImagem } from '../core/formas.js';
import { numero, marcar, arquivo, el, aoMudar } from '../core/ui.js';

export default criarAbaCarimbo({
  id: 'carimbar-imagem', nome: 'Carimbar imagem', tituloForma: 'Imagem',
  descricao: 'Carimba um logo ou desenho na superfície. PNG/JPG viram preto e branco pelo limiar; SVG é usado direto como vetor, sem perder qualidade.',
  montarForma(s, ctx, mudou, campos) {
    const estado = { tipo: null, img: null, svg: null };
    arquivo(s, 'Arquivo', '.png,.jpg,.jpeg,.webp,.svg', async f => {
      if (/\.svg$/i.test(f.name) || f.type === 'image/svg+xml') { estado.tipo = 'svg'; estado.svg = await f.text(); }
      else { estado.tipo = 'img'; estado.img = await lerImagem(f, 800); }
      mudou();
    }, { aoRemover: () => { estado.tipo = null; estado.img = estado.svg = null; mudou(); } });
    const limiar = numero(s, 'Limiar preto/branco', 128, { passo: 1, min: 1, max: 254, dica: 'Pixels mais escuros que isso viram o desenho. Só vale pra PNG/JPG.' });
    const inverter = marcar(s, 'Inverter (usar a parte clara)', false);
    const ignorarBranco = marcar(s, 'Ignorar formas brancas do SVG', true, { dica: 'Evita que um fundo branco no SVG vire um bloco inteiro.' });
    const largura = numero(s, 'Largura', 30, { un: 'mm' });
    const altura = numero(s, 'Altura', 0, { un: 'mm', dica: 'Deixe 0 pra manter a proporção. Com valor, estica ou achata de propósito.' });
    aoMudar([limiar, inverter, ignorarBranco, largura, altura], mudou);
    Object.assign(campos, { limiar, inverter, ignorarBranco, largura, altura });
    return async () => {
      if (!estado.tipo) throw new Error('Escolha uma imagem PNG, JPG ou SVG.');
      if (estado.tipo === 'svg') return svgParaSecao(estado.svg, { largura: largura(), altura: altura(), ignorarBranco: ignorarBranco() });
      return imagemParaSecao(estado.img, { limiar: limiar(), inverter: inverter(), largura: largura(), altura: altura() });
    };
  },
});
