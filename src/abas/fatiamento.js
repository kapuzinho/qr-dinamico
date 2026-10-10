import { stlBinario } from '../core/arquivos.js';
import { campoTexto, escolha, botao, acoes, saida, secao, tabela, el } from '../core/ui.js';

const salvo = (k, padrao) => { try { return localStorage.getItem(`k3d:fatiar:${k}`) || padrao; } catch { return padrao; } };
const guardar = (k, v) => { try { localStorage.setItem(`k3d:fatiar:${k}`, v); } catch { /* ok */ } };
const horas = s => `${Math.floor(s / 3600)}h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}min`;

export default {
  id: 'fatiamento', grupo: 'Produção', nome: 'Fatiamento real',
  descricao: 'Fatia a peça com o Bambu Studio instalado no seu PC e traz o peso e o tempo exatos. Só funciona rodando local (npm run dev).',
  montar(raiz, ctx) {
    const s1 = secao(raiz, 'Bambu Studio');
    this.exe = campoTexto(s1, 'Executável', salvo('exe', 'C:\\Program Files\\Bambu Studio\\bambu-studio.exe'));
    this.pasta = campoTexto(s1, 'Pasta dos seus perfis', salvo('pasta', 'C:\\Users\\Alan\\AppData\\Roaming\\BambuStudio\\user\\3057594841'),
      { dica: 'Pasta com as subpastas machine, process e filament dos seus perfis de usuário.' });
    this.filtro = campoTexto(s1, 'Filtro dos perfis do sistema', salvo('filtro', 'A1'), { dica: 'Mostra só perfis de sistema com esse texto no nome. Os seus perfis sempre aparecem.' });
    botao(acoes(s1), 'Carregar perfis', () => this.carregar(ctx));
    const s2 = secao(raiz, 'Perfis');
    this.sel = {
      machine: escolha(s2, 'Impressora', [], ''),
      process: escolha(s2, 'Processo', [], ''),
      filament: escolha(s2, 'Filamento', [], ''),
    };
    for (const [k, f] of Object.entries(this.sel)) f.input.addEventListener('change', () => guardar(k, f()));
    botao(acoes(raiz), 'Fatiar peça atual', () => this.fatiar(ctx), { primario: true });
    this.out = saida(raiz);
  },
  async carregar(ctx) {
    guardar('exe', this.exe()); guardar('pasta', this.pasta()); guardar('filtro', this.filtro());
    try {
      const r = await fetch(`/api/bambu/perfis?exe=${encodeURIComponent(this.exe())}&pasta=${encodeURIComponent(this.pasta())}`);
      if (r.status === 404) throw new Error('Fatiamento real só funciona rodando no seu PC com npm run dev.');
      const d = await r.json();
      if (d.erro) throw new Error(d.erro);
      const filtro = this.filtro().toLowerCase();
      for (const [tipo, f] of Object.entries(this.sel)) {
        const s = f.input;
        const usuario = d[tipo].filter(p => p.origem === 'usuario'), sistema = d[tipo].filter(p => p.origem === 'sistema' && (!filtro || p.nome.toLowerCase().includes(filtro)));
        const grupo = (rot, l) => { const g = el('optgroup', { label: rot }); l.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(p => g.append(el('option', { value: p.nome, text: p.nome }))); return g; };
        s.replaceChildren(grupo('Meus perfis', usuario), grupo('Sistema', sistema));
        const ant = salvo(tipo, '');
        if (ant && [...s.options].some(o => o.value === ant)) s.value = ant;
      }
      ctx.log('Perfis carregados.', 'ok');
    } catch (e) { ctx.log(e.message, 'erro'); }
  },
  fatiar(ctx) {
    if (!ctx.temPeca()) return;
    if (!this.sel.machine()) return ctx.log('Carregue e escolha os perfis primeiro.', 'erro');
    ctx.ocupado('Fatiando no Bambu Studio…', async () => {
      const cfg = { exe: this.exe(), pasta: this.pasta(), machine: this.sel.machine(), process: this.sel.process(), filament: this.sel.filament() };
      const r = await fetch('/api/bambu/fatiar', { method: 'POST', headers: { 'x-config': encodeURIComponent(JSON.stringify(cfg)) }, body: new Blob([stlBinario(ctx.peca.geom)]) });
      if (r.status === 404) throw new Error('Fatiamento real só funciona rodando no seu PC com npm run dev.');
      const d = await r.json();
      if (d.erro) { console.warn(d.log); throw new Error(d.erro); }
      ctx.fatiamento = { peso: d.peso, horas: d.segundos / 3600, perfil: cfg.filament, peca: ctx.peca.geom };
      this.out.innerHTML = tabela([
        ['Peso', d.peso != null ? `${d.peso.toFixed(1).replace('.', ',')} g` : '—', 'ok'],
        ['Tempo', d.segundos != null ? horas(d.segundos) : '—', 'ok'],
        ['Filamento', cfg.filament],
      ]);
      ctx.log('Fatiado. A ferramenta Calcular custo já pode usar esse peso e tempo.', 'ok');
    });
  },
};
