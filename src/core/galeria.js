// Galeria de artes prontas (desenhos próprios, simples e "imprimíveis": silhuetas cheias, sem traço fino).
// Todas em viewBox 0 0 100 100, preenchimento preto.
const S = corpo => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#000">${corpo}</g></svg>`;
const estrela = (cx, cy, r1, r2, n = 5, rot = -90) => {
  const p = [];
  for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? r2 : r1; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return `<polygon points="${p.join(' ')}"/>`;
};
const CORACAO = '<path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88Z"/>';

export const GALERIA = {
  'Pets': {
    'Patinha': S('<ellipse cx="50" cy="66" rx="22" ry="19"/><ellipse cx="22" cy="42" rx="9" ry="12" transform="rotate(-20 22 42)"/><ellipse cx="40" cy="26" rx="9" ry="12"/><ellipse cx="60" cy="26" rx="9" ry="12"/><ellipse cx="78" cy="42" rx="9" ry="12" transform="rotate(20 78 42)"/>'),
    'Osso': S('<circle cx="18" cy="38" r="12"/><circle cx="18" cy="62" r="12"/><circle cx="82" cy="38" r="12"/><circle cx="82" cy="62" r="12"/><rect x="18" y="40" width="64" height="20" rx="4"/>'),
    'Cachorro': S('<path d="M28 30 L14 18 L12 52 Q14 62 24 60 L28 50Z"/><path d="M72 30 L86 18 L88 52 Q86 62 76 60 L72 50Z"/><ellipse cx="50" cy="52" rx="26" ry="28"/><ellipse cx="50" cy="74" rx="14" ry="11"/>'),
    'Gato': S('<path d="M22 40 L24 10 L42 28 Q50 26 58 28 L76 10 L78 40 Q86 56 78 72 Q66 88 50 88 Q34 88 22 72 Q14 56 22 40Z"/>'),
    'Peixe': S('<path d="M10 50 Q34 20 62 30 Q74 36 80 50 Q74 64 62 70 Q34 80 10 50Z"/><path d="M76 50 L96 30 L92 50 L96 70Z"/>'),
    'Pássaro': S('<path d="M20 60 Q22 36 46 32 Q56 20 70 24 L86 26 L72 32 Q76 46 66 58 Q56 72 34 72 L12 80 Q20 70 20 60Z"/>'),
  },
  'Festa': {
    'Coração': S(CORACAO),
    'Estrela': S(estrela(50, 52, 46, 19)),
    'Balão': S('<ellipse cx="50" cy="40" rx="28" ry="34"/><polygon points="44,74 56,74 50,82"/><rect x="48" y="80" width="4" height="16" rx="2"/>'),
    'Bolo': S('<rect x="14" y="56" width="72" height="30" rx="4"/><rect x="22" y="38" width="56" height="20" rx="4"/><rect x="47" y="20" width="6" height="18" rx="2"/><ellipse cx="50" cy="15" rx="5" ry="7"/>'),
    'Presente': S('<rect x="12" y="40" width="76" height="16" rx="3"/><rect x="18" y="58" width="64" height="32" rx="3"/><path d="M50 40 Q30 14 22 28 Q20 38 50 40Z"/><path d="M50 40 Q70 14 78 28 Q80 38 50 40Z"/>'),
    'Coroa': S('<path d="M10 78 L14 30 L32 52 L50 20 L68 52 L86 30 L90 78Z"/><rect x="10" y="82" width="80" height="10" rx="3"/>'),
    'Nota musical': S('<ellipse cx="30" cy="76" rx="16" ry="12" transform="rotate(-20 30 76)"/><rect x="40" y="16" width="7" height="60"/><path d="M40 16 L80 6 L80 22 L47 31Z"/><ellipse cx="72" cy="66" rx="14" ry="11" transform="rotate(-20 72 66)"/><rect x="78" y="10" width="7" height="56"/>'),
    'Alianças': S('<path fill-rule="evenodd" d="M36 30 a24 24 0 1 0 0.1 0Z M36 40 a14 14 0 1 1 -0.1 0Z"/><path fill-rule="evenodd" d="M64 30 a24 24 0 1 0 0.1 0Z M64 40 a14 14 0 1 1 -0.1 0Z"/>'),
  },
  'Profissões': {
    'Tesoura (salão)': S('<path fill-rule="evenodd" d="M28 62 a14 14 0 1 0 0.1 0Z M28 70 a6 6 0 1 1 -0.1 0Z"/><path fill-rule="evenodd" d="M72 62 a14 14 0 1 0 0.1 0Z M72 70 a6 6 0 1 1 -0.1 0Z"/><path d="M34 64 L70 10 L76 14 L42 70Z"/><path d="M66 64 L30 10 L24 14 L58 70Z"/>'),
    'Dente (dentista)': S('<path d="M50 20 Q66 8 80 16 Q92 26 86 46 Q80 64 76 86 Q72 94 66 86 L58 60 Q50 54 42 60 L34 86 Q28 94 24 86 Q20 64 14 46 Q8 26 20 16 Q34 8 50 20Z"/>'),
    'Chave inglesa (mecânico)': S('<path d="M70 6 a20 20 0 0 0 -16 30 L12 78 a8 8 0 0 0 12 12 L66 48 a20 20 0 0 0 28 -22 L82 36 L70 32 L66 20 L78 8 a20 20 0 0 0 -8 -2Z"/>'),
    'Martelo (obras)': S('<rect x="14" y="14" width="52" height="22" rx="4"/><path d="M66 18 L86 12 L86 38 L66 32Z"/><rect x="34" y="34" width="12" height="58" rx="4"/>'),
    'Xícara (café)': S('<path d="M14 36 L72 36 L66 80 Q64 88 56 88 L30 88 Q22 88 20 80Z"/><path fill-rule="evenodd" d="M68 42 a16 16 0 1 1 0 28 L68 62 a7 7 0 1 0 0 -12Z"/><path d="M30 8 q8 8 0 16 q-8 8 0 14" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round"/><path d="M48 8 q8 8 0 16 q-8 8 0 14" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round"/>'),
    'Chapéu de chef': S('<path d="M24 62 Q8 58 10 40 Q14 24 32 28 Q36 10 50 10 Q64 10 68 28 Q86 24 90 40 Q92 58 76 62Z"/><rect x="24" y="64" width="52" height="24" rx="4"/>'),
    'Câmera (foto)': S('<path fill-rule="evenodd" d="M16 30 H84 Q92 30 92 38 V78 Q92 86 84 86 H16 Q8 86 8 78 V38 Q8 30 16 30Z M50 39 a19 19 0 1 0 0.1 0Z"/><rect x="32" y="18" width="36" height="16" rx="4"/><circle cx="50" cy="58" r="12"/>'),
    'Casa (imóveis)': S('<path fill-rule="evenodd" d="M50 8 L94 48 L82 48 L82 90 L18 90 L18 48 L6 48Z M42 90 L42 62 L58 62 L58 90Z"/>'),
    'Carro': S('<path d="M10 62 L16 44 Q20 36 30 34 L38 22 Q42 18 50 18 L66 18 Q74 18 78 26 L84 36 Q92 40 92 50 L92 62Z"/><circle cx="28" cy="66" r="11"/><circle cx="74" cy="66" r="11"/>'),
    'Troféu': S('<path d="M28 10 H72 V36 Q72 60 50 62 Q28 60 28 36Z"/><path fill-rule="evenodd" d="M28 16 H14 Q12 40 30 46 L30 40 Q20 36 20 22 H28Z"/><path fill-rule="evenodd" d="M72 16 H86 Q88 40 70 46 L70 40 Q80 36 80 22 H72Z"/><rect x="45" y="60" width="10" height="18"/><rect x="30" y="76" width="40" height="14" rx="3"/>'),
    'Halter (academia)': S('<rect x="8" y="34" width="12" height="32" rx="3"/><rect x="20" y="26" width="12" height="48" rx="3"/><rect x="32" y="45" width="36" height="10"/><rect x="68" y="26" width="12" height="48" rx="3"/><rect x="80" y="34" width="12" height="32" rx="3"/>'),
    'Cruz (saúde)': S('<rect x="36" y="10" width="28" height="80" rx="5"/><rect x="10" y="36" width="80" height="28" rx="5"/>'),
  },
  'Bebê': {
    'Pezinho': S('<ellipse cx="54" cy="66" rx="20" ry="27"/><circle cx="34" cy="28" r="7"/><circle cx="45" cy="22" r="6"/><circle cx="56" cy="21" r="5.5"/><circle cx="66" cy="24" r="5"/><circle cx="74" cy="30" r="4.5"/>'),
    'Mamadeira': S('<path d="M42 6 h16 v8 h-16Z"/><path d="M38 14 h24 l-4 10 h-16Z"/><rect x="30" y="24" width="40" height="70" rx="14"/>'),
    'Chupeta': S('<path fill-rule="evenodd" d="M50 8 a14 14 0 1 0 0.1 0Z M50 15 a7 7 0 1 1 -0.1 0Z"/><ellipse cx="50" cy="50" rx="34" ry="13"/><path d="M38 58 Q50 98 62 58Z"/>'),
    'Carrinho': S('<path d="M14 30 H52 V62 H14 Q14 30 14 30Z"/><path d="M52 30 Q86 30 88 62 H52Z"/><circle cx="28" cy="78" r="10"/><circle cx="72" cy="78" r="10"/>'),
    'Ursinho': S('<circle cx="24" cy="24" r="13"/><circle cx="76" cy="24" r="13"/><circle cx="50" cy="52" r="34"/>'),
    'Nuvem': S('<path d="M22 78 Q4 78 6 60 Q8 44 24 46 Q26 24 48 24 Q64 24 70 38 Q92 36 94 58 Q94 78 76 78Z"/>'),
  },
  'Fé': {
    'Cruz': S('<rect x="42" y="6" width="16" height="88" rx="3"/><rect x="20" y="26" width="60" height="16" rx="3"/>'),
    'Pomba': S('<path d="M8 52 Q30 40 46 46 L62 20 Q66 40 58 52 L92 46 Q78 70 52 72 L40 90 L38 72 Q18 70 8 52Z"/>'),
    'Asas de anjo': S('<path d="M48 30 Q20 8 6 26 Q18 30 10 42 Q24 44 16 56 Q32 58 28 70 Q48 66 48 40Z"/><path d="M52 30 Q80 8 94 26 Q82 30 90 42 Q76 44 84 56 Q68 58 72 70 Q52 66 52 40Z"/>'),
    'Ichthys (peixe)': S('<path fill-rule="evenodd" d="M6 50 Q40 14 74 44 L94 28 L94 72 L74 56 Q40 86 6 50Z M20 50 Q40 30 62 50 Q40 70 20 50Z"/>'),
  },
  'Saúde': {
    'Coração (saúde)': S('<path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88Z"/><path d="M8 50 H30 L38 34 L48 66 L56 44 L62 50 H92" fill="none" stroke="#fff" stroke-width="0"/>'),
    'Cápsula': S('<rect x="10" y="34" width="80" height="32" rx="16" transform="rotate(-35 50 50)"/>'),
    'Seringa': S('<rect x="24" y="40" width="46" height="20" rx="3"/><rect x="70" y="46" width="22" height="8"/><rect x="6" y="48" width="18" height="4"/><rect x="86" y="34" width="6" height="32" rx="2"/>'),
    'Estetoscópio': S('<path d="M22 8 h8 v30 q0 18 18 18 q18 0 18 -18 v-30 h8 v30 q0 26 -26 26 q-26 0 -26 -26Z"/><rect x="44" y="60" width="8" height="18"/><circle cx="48" cy="84" r="11"/>'),
  },
  'Esporte': {
    'Escudo de time': S('<path d="M50 6 L88 18 Q90 62 50 94 Q10 62 12 18Z"/>'),
    'Chuteira': S('<path d="M8 50 Q8 34 22 34 L46 36 L60 22 L72 26 L70 44 Q92 50 92 66 L92 72 H8Z"/><rect x="16" y="74" width="8" height="8"/><rect x="40" y="74" width="8" height="8"/><rect x="70" y="74" width="8" height="8"/>'),
    'Raquete': S('<path fill-rule="evenodd" d="M44 6 a26 32 0 1 0 0.1 0Z M44 14 a18 24 0 1 1 -0.1 0Z"/><rect x="40" y="66" width="8" height="30" rx="3"/>'),
  },
  'Natureza': {
    'Flor': S('<circle cx="50" cy="26" r="16"/><circle cx="74" cy="44" r="16"/><circle cx="65" cy="72" r="16"/><circle cx="35" cy="72" r="16"/><circle cx="26" cy="44" r="16"/><circle cx="50" cy="52" r="12"/>'),
    'Folha': S('<path d="M14 86 Q10 30 58 14 Q80 8 90 10 Q92 40 72 66 Q48 92 14 86Z"/>'),
    'Sol': S(`<circle cx="50" cy="50" r="22"/>${estrela(50, 50, 46, 26, 12)}`),
    'Lua': S('<path d="M60 8 A42 42 0 1 0 92 66 A34 34 0 1 1 60 8Z"/>'),
    'Árvore': S('<polygon points="50,6 82,46 66,46 88,72 12,72 34,46 18,46"/><rect x="43" y="72" width="14" height="20"/>'),
  },
};

// lista simples pra montar a janela
export function itensGaleria() {
  return Object.entries(GALERIA).flatMap(([cat, itens]) => Object.entries(itens).map(([nome, svg]) => ({ cat, nome, svg })));
}

// abre a janela da galeria; resolve com { nome, svg } ou null
export function abrirGaleria() {
  return new Promise(resolver => {
    const fundo = document.createElement('div');
    fundo.className = 'galeria-fundo';
    const caixa = document.createElement('div');
    caixa.className = 'galeria-caixa';
    caixa.innerHTML = `<div class="galeria-topo"><b>Galeria de artes</b><input type="search" placeholder="Buscar (ex.: pata, bolo, carro)…"><button type="button" class="btn">Fechar</button></div><div class="galeria-grade"></div>`;
    fundo.append(caixa); document.body.append(fundo);
    const grade = caixa.querySelector('.galeria-grade'), busca = caixa.querySelector('input');
    const fechar = v => { fundo.remove(); resolver(v); };
    const desenhar = () => {
      const q = busca.value.trim().toLowerCase();
      grade.replaceChildren();
      let cat = '';
      for (const it of itensGaleria()) {
        if (q && !(`${it.nome} ${it.cat}`.toLowerCase().includes(q))) continue;
        if (it.cat !== cat) { cat = it.cat; const h = document.createElement('h4'); h.textContent = cat; grade.append(h); }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'galeria-item'; b.title = it.nome;
        b.innerHTML = `<img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(it.svg)}"><span>${it.nome}</span>`;
        b.addEventListener('click', () => fechar(it));
        grade.append(b);
      }
    };
    busca.addEventListener('input', desenhar);
    caixa.querySelector('.btn').addEventListener('click', () => fechar(null));
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(null); });
    desenhar(); busca.focus();
  });
}
