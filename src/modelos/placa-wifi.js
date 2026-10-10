import { criarEditorModelo } from './editor.js';
import { qrParaSecao, textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte } from '../core/fontes.js';
import { geoPlacaPix, layoutPlacaPix, retArred } from './geo.js';
import { deslizante, numero, arquivo, escolha, campoTexto, el, texto, aoMudar } from '../core/ui.js';

const poligonosDe = cs => cs.toPolygons();

export default criarEditorModelo({
  id: 'placa-wifi', nome: 'Placa de Wi-Fi',
  descricao: 'Placa de Wi-Fi: digite o nome da rede e a senha e o QR que conecta direto é gerado na hora (é só apontar a câmera do celular). Logo opcional e base pra ficar em pé.',
  partes: [
    { id: 'placa', nome: 'Placa', cor: 0x5a6472 },
    { id: 'borda', nome: 'Borda', cor: 0xffffff },
    { id: 'detalhes', nome: 'Detalhes (QR, nome, logo)', cor: 0x1a1a1a },
    { id: 'base', nome: 'Base de apoio', cor: 0x5a6472 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.logo = null;
    this.rede = campoTexto(s, 'Nome da rede (Wi-Fi)', '', { placeholder: 'ex.: Kapuzinho_5G', dica: 'Exatamente como aparece no celular (maiúsculas contam).' });
    this.senha = campoTexto(s, 'Senha', '', { placeholder: 'senha da rede' });
    this.seguranca = escolha(s, 'Segurança', [['WPA', 'WPA/WPA2/WPA3 (a maioria)'], ['WEP', 'WEP (antiga)'], ['nopass', 'Sem senha (rede aberta)']], 'WPA');
    this.oculta = escolha(s, 'Rede oculta?', [['nao', 'Não'], ['sim', 'Sim (não aparece na lista)']], 'nao');
    this.mostrarSenha = escolha(s, 'Escrever na placa', [['tudo', 'Rede e senha'], ['rede', 'Só a rede'], ['nada', 'Só o QR']], 'tudo',
      { dica: 'Mesmo sem escrever, o QR já conecta.' });
    this.titulo = campoTexto(s, 'Texto de baixo', 'Wi-Fi grátis', { dica: 'Ex.: "Wi-Fi grátis", "Conecte-se", "Rede dos clientes".' });
    const mini = el('img', { class: 'miniatura', alt: 'Logo' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Logo (SVG ou PNG, opcional)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.logo = { tipo: 'svg', dado: await f.text() };
      else this.logo = { tipo: 'img', dado: await lerImagem(f, 800) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover logo' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.logo = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.limiar.input.addEventListener('input', mudou);
    aoMudar([this.rede, this.senha, this.seguranca, this.oculta, this.mostrarSenha, this.titulo], mudou);
    this.limiar.input.addEventListener('input', mudou);
    texto(s, 'O QR segue o padrão de Wi-Fi do Android e iPhone (câmera → "Conectar"). Teste antes de entregar.');
  },
  montarParametros(raiz, ctx, mudou) {
    this.largura = deslizante(raiz, 'Largura da placa', 70, { min: 50, max: 110, un: 'mm', aoMudar: mudou });
    this.altura = deslizante(raiz, 'Altura da placa', 95, { min: 70, max: 150, un: 'mm', aoMudar: mudou });
    this.tamQR = deslizante(raiz, 'Tamanho máx. do QR', 48, { min: 25, max: 80, un: 'mm', aoMudar: mudou, dica: 'Limite do QR. Ele diminui sozinho pra caber o logo em cima sem encostar.' });
    this.posQR = deslizante(raiz, 'Ajuste vertical (logo + QR)', 0, { min: -15, max: 15, un: 'mm', aoMudar: mudou, dica: '0 = centralizado no espaço livre. Sobe/desce o bloco logo + QR.' });
    this.espaco = deslizante(raiz, 'Espaço entre elementos', 2.5, { min: 1, max: 8, un: 'mm', aoMudar: mudou, dica: 'Distância entre logo, QR, nome e texto.' });
    this.tamLogo = deslizante(raiz, 'Tamanho do logo', 22, { min: 8, max: 45, un: 'mm', aoMudar: mudou });
    this.tamNome = deslizante(raiz, 'Largura do texto (rede/senha)', 56, { min: 20, max: 100, un: 'mm', aoMudar: mudou });
    this.espBase = deslizante(raiz, 'Espessura da placa', 3, { min: 2, max: 6, un: 'mm', aoMudar: mudou });
    this.espBorda = deslizante(raiz, 'Relevo da borda', 1.5, { min: 0.6, max: 4, un: 'mm', aoMudar: mudou });
    this.larguraBorda = deslizante(raiz, 'Largura da borda', 3, { min: 1, max: 8, un: 'mm', aoMudar: mudou });
    this.espDet = deslizante(raiz, 'Relevo dos detalhes', 1.2, { min: 0.6, max: 3, un: 'mm', aoMudar: mudou });
    this.raio = deslizante(raiz, 'Cantos', 6, { min: 0, max: 20, un: 'mm', aoMudar: mudou });
    this.folgaBase = deslizante(raiz, 'Folga do encaixe (base)', 0.3, { min: 0.1, max: 0.8, passo: 0.05, un: 'mm', aoMudar: mudou, dica: 'Folga de cada lado da fenda. PETG: 0.3. Se ficar justo demais, aumente.' });
    this.altBase = deslizante(raiz, 'Altura da base', 15, { min: 10, max: 30, un: 'mm', aoMudar: mudou, dica: 'A fenda tem essa altura menos 3 mm de piso.' });
    this.profBase = deslizante(raiz, 'Profundidade da base', 22, { min: 14, max: 40, un: 'mm', aoMudar: mudou, dica: 'Quanto maior, mais firme a placa fica em pé.' });
  },
  // padrão "WIFI:" lido pela câmera do Android e do iPhone (caracteres especiais escapados com \)
  wifiPayload() {
    const esc = v => String(v).replace(/([\\;,:"])/g, '\\$1');
    const rede = (this.rede() || '').trim() || 'MinhaRede';
    const t = this.seguranca();
    return `WIFI:T:${t};S:${esc(rede)};${t === 'nopass' ? '' : `P:${esc(this.senha() || '')};`}${this.oculta() === 'sim' ? 'H:true;' : ''};`;
  },
  async logoCs() {
    if (!this.logo) return null;
    return this.logo.tipo === 'svg'
      ? svgParaSecao(this.logo.dado, { largura: 40, ignorarBranco: false })
      : imagemParaSecao(this.logo.dado, { limiar: this.limiar(), largura: 40 });
  },
  async formas() {
    const fonte = await obterFonte('emb:Poppins-Bold.ttf');
    const qr = qrParaSecao(this.wifiPayload(), 50).cs;
    const modo = this.mostrarSenha(), rede = (this.rede() || '').trim() || 'MinhaRede';
    const linhas = [];
    if (modo !== 'nada') linhas.push(`Rede: ${rede}`);
    if (modo === 'tudo' && this.seguranca() !== 'nopass' && (this.senha() || '').trim()) linhas.push(`Senha: ${this.senha().trim()}`);
    const nome = linhas.length ? textoParaSecao(fonte, linhas.join('\n'), { altura: 10 }) : null;
    const tit = (this.titulo() || '').trim();
    const txt = tit ? textoParaSecao(fonte, tit, { altura: 7 }) : null;
    return { qr, logo: await this.logoCs(), nome, texto: txt };
  },
  parametros() {
    return { largura: this.largura(), altura: this.altura(), raio: this.raio(), espBase: this.espBase(),
      espBorda: this.espBorda(), espDetalhe: this.espDet(), larguraBorda: this.larguraBorda(),
      tamLogo: this.tamLogo(), tamQR: this.tamQR(), posQR: this.posQR(), espaco: this.espaco(),
      tamNome: this.tamNome(), altNome: this.mostrarSenha() === 'tudo' ? 15 : 9, profBase: this.profBase(), altBase: this.altBase(), folgaBase: this.folgaBase() };
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const placa = retArred(p.largura, p.altura, p.raio);
    const borda = placa.subtract(retArred(p.largura - 2 * p.larguraBorda, p.altura - 2 * p.larguraBorda, Math.max(p.raio - p.larguraBorda, 1)));
    // mesmo layout do 3D, pra prévia bater com o STL
    const L = layoutPlacaPix(f, p);
    const dets = [L.logo, L.qr, L.nome, L.texto].filter(Boolean);
    return {
      largura: p.largura + 20, altura: p.altura + 20,
      partes: [
        { id: 'placa', poligonos: poligonosDe(placa) },
        { id: 'borda', poligonos: poligonosDe(borda) },
        { id: 'detalhes', poligonos: dets.flatMap(d => poligonosDe(d)) },
      ],
      dica: 'Confira o QR e os textos. Clique no quadradinho de cor de cada peça. Teste o QR no banco antes de imprimir.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoPlacaPix(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: ((this.rede() || '').trim() ? '' : '<b style="color:#e5484d">⚠ QR com rede de EXEMPLO: digite o nome da rede e a senha!</b><br>') + `Placa de Wi-Fi ${this.largura().toFixed(0)} × ${this.altura().toFixed(0)} × ${r.espTotal.toFixed(1)} mm, QR de ${r.ladoQR.toFixed(1)} mm. `
        + `Fenda da base: ${r.fenda.L.toFixed(1)} × ${r.fenda.E.toFixed(1)} mm, ${r.fenda.prof.toFixed(0)} mm de fundo. Teste a leitura do QR no app do banco antes de imprimir.`,
    };
  },
});
