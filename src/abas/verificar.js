import * as THREE from 'three';
import { contarBordas, dadosFaces, criarTestador, volumeDe } from '../core/motor.js';
import { numero, botao, acoes, saida, tabela, mm } from '../core/ui.js';

export default {
  id: 'verificar', grupo: 'Conferir', nome: 'Verificar',
  descricao: 'Confere se a peça está pronta pra imprimir: malha fechada, pedaços soltos, tamanho na mesa, área apoiada, balanços e paredes finas.',
  montar(raiz, ctx) {
    this.min = numero(raiz, 'Parede mínima', 0.8, { un: 'mm', passo: 0.1, dica: 'Com bico de 0,4 mm, paredes abaixo de 0,8 mm costumam sair falhadas ou nem sair.' });
    this.amostras = numero(raiz, 'Pontos medidos', 4000, { passo: 500, dica: 'Quantos pontos da superfície são medidos. Os pontos com parede fina aparecem em vermelho na peça.' });
    botao(acoes(raiz), 'Verificar', () => this.verificar(ctx), { primario: true });
    this.out = saida(raiz);
  },
  verificar(ctx) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Verificando…', () => {
      const g = ctx.peca.geom;
      g.computeBoundingBox();
      const b = g.boundingBox, s = b.getSize(new THREE.Vector3());
      const bordas = contarBordas(g);
      let volume = null, pedacos = null;
      try {
        const m = ctx.manifold();
        volume = volumeDe(m);
        const partes = m.decompose();
        pedacos = partes.filter(p => volumeDe(p) > 0).length; // cavidade interna aparece com volume negativo
        partes.forEach(p => p.delete());
      } catch { /* malha aberta */ }

      const f = dadosFaces(g);
      let contato = 0, balanco = 0;
      for (let i = 0; i < f.n; i++) {
        const nz = f.normais[i * 3 + 2], cz = f.centros[i * 3 + 2];
        if (nz < -0.99 && cz < b.min.z + 0.1) contato += f.areas[i];
        else if (nz < -0.7071 && cz > b.min.z + 0.3) balanco += f.areas[i];
      }

      const t = criarTestador(g), finos = [];
      const n = Math.min(f.n, Math.round(this.amostras()));
      const N = new THREE.Vector3(), C = new THREE.Vector3(), O = new THREE.Vector3();
      let medidos = 0;
      for (let k = 0; k < n; k++) {
        const i = n === f.n ? k : Math.floor(Math.random() * f.n);
        if (f.areas[i] < 1e-6) continue;
        N.fromArray(f.normais, i * 3);
        C.fromArray(f.centros, i * 3);
        O.copy(C).addScaledVector(N, -0.01);
        const d = t.primeiro(O, N.clone().negate());
        if (d === null) continue;
        medidos++;
        if (d < this.min()) finos.push(C.clone());
      }
      t.liberar();
      ctx.viewer.pontos(finos);

      const cabe = s.x <= ctx.mesa.x && s.y <= ctx.mesa.y && s.z <= ctx.mesa.z;
      const pctFino = medidos ? (finos.length / medidos) * 100 : 0;
      this.out.innerHTML = tabela([
        ['Tamanho', `${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)} mm`],
        ['Cabe na mesa', cabe ? 'Sim' : 'Não', cabe ? 'ok' : 'aviso'],
        ['Malha fechada', volume !== null ? 'Sim' : 'Não', volume !== null ? 'ok' : 'aviso'],
        ['Bordas abertas', bordas.abertas, bordas.abertas ? 'aviso' : 'ok'],
        ['Volume', volume !== null ? `${(volume / 1000).toFixed(2).replace('.', ',')} cm³` : '—'],
        ['Pedaços soltos', pedacos ?? '—', pedacos > 1 ? 'aviso' : ''],
        ['Área apoiada na mesa', `${contato.toFixed(0)} mm²`, contato < 50 ? 'aviso' : ''],
        ['Área em balanço (> 45°)', `${balanco.toFixed(0)} mm²`],
        [`Parede abaixo de ${mm(this.min())}`, `${pctFino.toFixed(1).replace('.', ',')}% dos pontos`, pctFino > 2 ? 'aviso' : 'ok'],
      ]);
      if (pedacos > 1) ctx.log(`A peça tem ${pedacos} partes separadas. Se não for de propósito, alguma parte vai sair solta.`, 'erro');
    });
  },
};
