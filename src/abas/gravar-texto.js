import { criarAbaCarimbo } from './_carimbo.js';
import { textoParaSecao } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { areaTexto, marcar, numero, escolha, aoMudar } from '../core/ui.js';

export default criarAbaCarimbo({
  id: 'gravar-texto', nome: 'Gravar texto', tituloForma: 'Texto',
  descricao: 'Grava texto em relevo ou entalhado seguindo a superfície da peça, mesmo curva. Escolha a vista, clique e arraste pra posicionar.',
  montarForma(s, ctx, mudou, campos) {
    const texto = areaTexto(s, 'Texto', 'Kapuzinho 3D', { linhas: 2, dica: 'Pode ter mais de uma linha.' });
    const fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Bold.ttf', { aoMudar: mudou, dica: 'Cada fonte aparece escrita nela mesma. Dá pra carregar as fontes do Windows ou um arquivo .ttf.' });
    const negrito = marcar(s, 'Negrito', false, { dica: 'Engrossa o traço. Ajuda em fonte fina que some no relevo.' });
    const altura = numero(s, 'Altura das letras', 8, { un: 'mm', dica: 'Altura de uma linha, do ponto mais baixo ao mais alto.' });
    const esp = numero(s, 'Espaço entre letras', 0, { passo: 0.01, dica: 'Fração do tamanho da letra. 0,05 afasta um pouco, negativo aproxima.' });
    const alinh = escolha(s, 'Alinhamento', [['centro', 'Centro'], ['esquerda', 'Esquerda'], ['direita', 'Direita']], 'centro');
    aoMudar([texto, negrito, altura, esp, alinh], mudou);
    Object.assign(campos, { texto, fonte, negrito, altura, esp, alinh });
    return async () => textoParaSecao(await obterFonte(fonte()), texto(), {
      altura: altura(), espacamento: esp(), alinhamento: alinh(), negrito: negrito() ? altura() * 0.035 : 0,
    });
  },
});
