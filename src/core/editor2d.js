// Canvas 2D interativo: desenha a composição (silhuetas coloridas), deixa arrastar peças móveis e clicar pra selecionar
export class Editor2D {
  constructor(el) {
    this.el = el;
    this.canvas = document.createElement('canvas');
    el.append(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.comp = null;
    this.cores = {};
    this.cb = {};
    this.arrastando = null;
    this.escala = 1;
    this.offset = [0, 0];
    new ResizeObserver(() => this.render()).observe(el);
    this.canvas.addEventListener('pointerdown', e => this.aoDescer(e));
    this.canvas.addEventListener('pointermove', e => this.aoMover(e));
    window.addEventListener('pointerup', () => this.aoSubir());
  }
  limpar() { this.comp = null; this.g?.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  // comp: { largura, altura, partes: [{id, poligonos:[[ [x,y]... ]], movel?}], dica }
  desenhar(comp, cores, cb) {
    this.comp = comp;
    this.cores = cores;
    this.cb = cb || {};
    this.ajustarVista();
    this.render();
  }
  ajustarVista() {
    const w = this.canvas.width = this.el.clientWidth;
    const h = this.canvas.height = this.el.clientHeight;
    if (!this.comp) return;
    const cw = this.comp.largura, ch = this.comp.altura;
    this.escala = Math.min(w / cw, h / ch) * 0.8;
    this.offset = [w / 2, h / 2];
  }
  paraTela(x, y) { return [this.offset[0] + x * this.escala, this.offset[1] - y * this.escala]; }
  paraModelo(px, py) { return [(px - this.offset[0]) / this.escala, -(py - this.offset[1]) / this.escala]; }

  render() {
    const g = this.g;
    if (!g) return;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.comp) return;
    // grade leve
    g.fillStyle = '#eef1f3'; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.strokeStyle = '#dbe1e5'; g.lineWidth = 1;
    const passo = 10 * this.escala;
    if (passo > 4) { for (let x = this.offset[0] % passo; x < this.canvas.width; x += passo) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, this.canvas.height); g.stroke(); } for (let y = this.offset[1] % passo; y < this.canvas.height; y += passo) { g.beginPath(); g.moveTo(0, y); g.lineTo(this.canvas.width, y); g.stroke(); } }
    for (const parte of this.comp.partes) {
      g.fillStyle = '#' + (this.cores[parte.id] ?? 0x888888).toString(16).padStart(6, '0');
      g.strokeStyle = parte.movel ? 'rgba(15,124,128,.9)' : 'rgba(28,43,54,.35)';
      g.lineWidth = parte.movel ? 2 : 1;
      g.beginPath();
      for (const poly of parte.poligonos) {
        poly.forEach(([x, y], i) => { const [sx, sy] = this.paraTela(x, y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); });
        g.closePath();
      }
      g.fill('evenodd');
      g.stroke();
    }
  }

  parteEm(px, py) {
    const [mx, my] = this.paraModelo(px, py);
    for (let i = this.comp.partes.length - 1; i >= 0; i--) {
      const p = this.comp.partes[i];
      let dentro = false;
      for (const poly of p.poligonos) {
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
          const [xi, yi] = poly[a], [xj, yj] = poly[b];
          if ((yi > my) !== (yj > my) && mx < ((xj - xi) * (my - yi)) / (yj - yi) + xi) dentro = !dentro;
        }
      }
      if (dentro) return p;
    }
    return null;
  }
  ponto(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  aoDescer(e) {
    if (!this.comp) return;
    const [px, py] = this.ponto(e);
    const p = this.parteEm(px, py);
    if (!p) return;
    this.cb.aoClicarParte?.(p.id);
    if (p.movel) { this.arrastando = { id: p.id, ini: this.paraModelo(px, py), movido: [0, 0] }; this.el.classList.add('arrastavel'); }
  }
  aoMover(e) {
    if (!this.arrastando) return;
    const [px, py] = this.ponto(e);
    const [mx, my] = this.paraModelo(px, py);
    const dx = mx - this.arrastando.ini[0], dy = my - this.arrastando.ini[1];
    this.arrastando.ini = [mx, my];
    this.arrastando.movido[0] += dx; this.arrastando.movido[1] += dy;
    // move só os polígonos da peça móvel (sem recalcular geometria): leve e fluido
    const parte = this.comp.partes.find(p => p.id === this.arrastando.id);
    if (parte) parte.poligonos = parte.poligonos.map(poly => poly.map(([x, y]) => [x + dx, y + dy]));
    if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); });
  }
  aoSubir() {
    if (!this.arrastando) return;
    const a = this.arrastando; this.arrastando = null;
    this.el.classList.remove('arrastavel');
    this.cb.aoArrastar?.(a.id, a.movido[0], a.movido[1]); // aplica o deslocamento total de uma vez
    this.cb.aoSoltar?.(a.id);
  }
}
