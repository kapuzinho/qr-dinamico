import { criarAbaCarimbo } from './_carimbo.js';
import { M, paraGeometria, assentar } from '../core/motor.js';
import { qrParaSecao } from '../core/formas.js';
import { campoTexto, numero, escolha, botao, acoes, secao, aoMudar } from '../core/ui.js';

export default criarAbaCarimbo({
  id: 'qrcode', nome: 'QR code 3D', tituloForma: 'QR code',
  descricao: 'Gera um QR code a partir de um texto ou link e grava na peça, ou cria uma placa avulsa com o QR em relevo.',
  montarForma(s, ctx, mudou, campos) {
    const texto = campoTexto(s, 'Texto ou link', 'https://kapuzinho-3d.vercel.app/');
    const lado = numero(s, 'Tamanho', 25, { un: 'mm', dica: 'Lado do quadrado do QR. Abaixo de 20 mm com bico 0,4 o celular pode não ler.' });
    const ecc = escolha(s, 'Correção de erro', [['L', 'Baixa (7%)'], ['M', 'Média (15%)'], ['Q', 'Alta (25%)'], ['H', 'Máxima (30%)']], 'M',
      { dica: 'Mais correção deixa o QR mais denso, mas lê mesmo com defeito de impressão.' });
    aoMudar([texto, lado, ecc], mudou);
    Object.assign(campos, { texto, lado, ecc });
    this.qr = { texto, lado, ecc };
    return async () => qrParaSecao(texto(), lado(), { ecc: ecc() }).cs;
  },
  montarExtra(raiz, ctx) {
    const s = secao(raiz, 'Placa avulsa');
    const esp = numero(s, 'Espessura da placa', 1.6, { un: 'mm' });
    const margem = numero(s, 'Margem em volta', 3, { un: 'mm', dica: 'Borda lisa em volta do QR. O ideal são 4 módulos, mas 2 a 3 mm costuma ler bem.' });
    const raio = numero(s, 'Raio dos cantos', 2, { un: 'mm' });
    botao(acoes(s), 'Gerar placa avulsa', () => ctx.ocupado('Gerando placa…', () => {
      const { CrossSection } = M();
      const L = this.qr.lado() + 2 * margem();
      const r = Math.max(0, Math.min(raio(), L / 2 - 0.05));
      const fundo2d = r > 0 ? CrossSection.square([L - 2 * r, L - 2 * r], true).offset(r, 'Round', 2, 48) : CrossSection.square([L, L], true);
      const placa = fundo2d.extrude(esp());
      const modulos = qrParaSecao(this.qr.texto(), this.qr.lado(), { ecc: this.qr.ecc() }).cs.extrude(this.altura()).translate([0, 0, esp()]);
      const unida = placa.add(modulos.translate([0, 0, -0.01]));
      const gUnida = assentar(paraGeometria(unida), ctx.mesa);
      const d = gUnida.userData.deslocamento;
      const gPlaca = paraGeometria(placa.translate(d)), gMod = paraGeometria(modulos.translate(d));
      this.separados = [{ geom: gPlaca, nome: 'qrcode_placa.stl' }, { geom: gMod, nome: 'qrcode_modulos.stl' }];
      this.btnSep.disabled = this.btn3mf.disabled = false;
      [placa, modulos, unida].forEach(m => m.delete());
      ctx.definirPeca(gUnida, { nome: 'qrcode.stl', enquadrar: true });
      this._mostrando = [{ geom: gPlaca }, { geom: gMod }];
      this._geomRef = ctx.peca.geom;
      ctx.viewer.mostrar(this.comCores(this._mostrando));
      ctx.log('Placa gerada. "Baixar separados" traz placa e módulos em arquivos diferentes, pra imprimir em duas cores.', 'ok');
    }), { primario: false });
  },
});
