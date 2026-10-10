import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const CORES = [0x0f7c80, 0xb8893a, 0x5a6fa8, 0xa2566e, 0x5e8c4a, 0x8a6bb5, 0xc07a3e, 0x4a8fa0];
const VISTAS = {
  iso: [-0.55, -0.85, 0.65], cima: [0, -0.001, 1], baixo: [0, -0.001, -1],
  frente: [0, -1, 0], tras: [0, 1, 0], esquerda: [-1, 0, 0], direita: [1, 0, 0],
  baixoIso: [-0.5, -0.8, -0.45],
};

export class Visualizador {
  constructor(el) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xdde3e7);
    this.renderer.localClippingEnabled = true;
    this.planoCorte = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // esconde a metade da frente (lado da câmera)
    this.cortar = false;
    this.aramado = false;
    el.append(this.renderer.domElement);

    this.cena = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
    this.camera.up.set(0, 0, 1);
    this.controles = new OrbitControls(this.camera, this.renderer.domElement);
    this.controles.enableDamping = true;

    this.cena.add(new THREE.HemisphereLight(0xffffff, 0x7d8a96, 1.3));
    this.luz = new THREE.DirectionalLight(0xffffff, 1.9);
    this.luz.position.set(120, 180, 0); // relativo à câmera: luz vem de cima/direita
    this.alvoLuz = new THREE.Object3D();
    this.luz.target = this.alvoLuz;
    this.camera.add(this.luz);
    this.cena.add(this.camera, this.alvoLuz);

    this.mesaGrupo = new THREE.Group();
    this.pecas = new THREE.Group();
    this.extras = new THREE.Group();
    this.cena.add(this.mesaGrupo, this.pecas, this.extras);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.selecao = null;
    this.ponto = null;
    this.marcador = null;
    this.arrastando = false;

    const cv = this.renderer.domElement;
    cv.addEventListener('pointerdown', e => this.aoDescer(e), { capture: true });
    cv.addEventListener('pointermove', e => this.aoMover(e));
    window.addEventListener('pointerup', () => this.aoSubir());
    new ResizeObserver(() => this.redimensionar()).observe(el);

    this.definirMesa(256, 256);
    this.vista('iso');
    this.renderer.setAnimationLoop(() => {
      this.controles.update();
      this.alvoLuz.position.copy(this.controles.target);
      this.renderer.render(this.cena, this.camera);
    });
  }

  redimensionar() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  definirMesa(w, h) {
    for (const c of [...this.mesaGrupo.children]) { c.geometry.dispose(); this.mesaGrupo.remove(c); }
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xf5f7f8 }));
    placa.position.set(w / 2, h / 2, -0.05);
    const fina = [], grossa = [];
    for (let x = 0; x <= w; x += 10) (x % 50 ? fina : grossa).push(x, 0, 0, x, h, 0);
    for (let y = 0; y <= h; y += 10) (y % 50 ? fina : grossa).push(0, y, 0, w, y, 0);
    const linhas = (arr, cor) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cor }));
    };
    const borda = linhas([0, 0, 0, w, 0, 0, w, 0, 0, w, h, 0, w, h, 0, 0, h, 0, 0, h, 0, 0, 0, 0], 0xb8893a);
    this.mesaGrupo.add(placa, linhas(fina, 0xd3dadf), linhas(grossa, 0xb5c0c7), borda);
  }

  // itens: [{ geom, cor?, deslocar?: [x,y,z] }]
  mostrar(itens, { enquadrar = false } = {}) {
    this.aoClicarObjeto = null;
    for (const c of [...this.pecas.children]) { c.material.dispose(); this.pecas.remove(c); }
    itens.forEach((it, i) => {
      if (!it.geom.boundsTree) it.geom.computeBoundsTree();
      const mat = new THREE.MeshStandardMaterial({
        color: it.cor ?? CORES[i % CORES.length], flatShading: true, roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide,
        wireframe: this.aramado, clippingPlanes: this.cortar ? [this.planoCorte] : [],
      });
      const m = new THREE.Mesh(it.geom, mat);
      if (it.deslocar) m.position.set(...it.deslocar);
      this.pecas.add(m);
    });
    this.ajustarCorte();
    if (enquadrar) this.vista(this.vistaAtual || 'iso');
  }

  // corte no meio da peça (em Y) pra enxergar parede interna
  definirCorte(ativo) { this.cortar = ativo; this.pecas.children.forEach(m => { m.material.clippingPlanes = ativo ? [this.planoCorte] : []; m.material.needsUpdate = true; }); this.ajustarCorte(); }
  ajustarCorte() {
    const cx = new THREE.Box3().setFromObject(this.pecas);
    if (!cx.isEmpty()) this.planoCorte.constant = -(cx.min.y + cx.max.y) / 2;
  }
  definirAramado(ativo) { this.aramado = ativo; this.pecas.children.forEach(m => { m.material.wireframe = ativo; }); }

  vista(nome) {
    this.vistaAtual = nome;
    const cx = new THREE.Box3().setFromObject(this.pecas);
    if (cx.isEmpty()) cx.setFromObject(this.mesaGrupo);
    const c = cx.getCenter(new THREE.Vector3());
    const t = Math.max(cx.getSize(new THREE.Vector3()).length(), 20);
    const d = (t / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.15;
    this.camera.position.copy(c).addScaledVector(new THREE.Vector3(...VISTAS[nome]).normalize(), d);
    this.controles.target.copy(c);
    this.controles.update();
  }

  pontos(lista, cor = 0xc8412a) {
    this.limparExtras();
    if (!lista.length) return;
    const g = new THREE.BufferGeometry().setFromPoints(lista);
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: cor, size: 6, sizeAttenuation: false, depthTest: false }));
    p.renderOrder = 998;
    this.extras.add(p);
  }
  linhas2D(polys, z, desloc = [0, 0], cor = 0xd6452b) {
    this.limparExtras();
    const pts = [];
    for (const p of polys) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; pts.push(a[0] + desloc[0], a[1] + desloc[1], z, b[0] + desloc[0], b[1] + desloc[1], z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cor, depthTest: false }));
    l.renderOrder = 998;
    this.extras.add(l);
  }
  limparExtras() { for (const c of [...this.extras.children]) { c.geometry?.dispose(); this.extras.remove(c); } }

  // ---- seleção por clique e arraste ----
  // raio: círculo (furos); forma + base: contorno 2D desenhado no plano da vista
  // auto(normalMundo) -> base: o desenho acompanha a face sob o mouse
  ativarSelecao({ raio = 2, dir, forma = null, base = null, auto = null }) {
    this.selecao = { raio, dir: new THREE.Vector3(...dir), forma, base, auto };
    if (this.ponto) this.desenharMarcador();
  }
  desativarSelecao() { this.selecao = null; this.limparPonto(); }
  limparPonto() {
    this.ponto = null;
    this.objetoPonto = null;
    if (this.marcador) { this.marcador.traverse(o => o.geometry?.dispose()); this.cena.remove(this.marcador); this.marcador = null; }
  }

  acerto(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    return this.raycaster.intersectObjects(this.pecas.children, false)[0] || null;
  }
  aoDescer(e) {
    if (e.button !== 0) return;
    if (!this.selecao) {
      // sem ferramenta de seleção ativa: clique numa peça pode pintar (modelos)
      if (this.aoClicarObjeto) { const h0 = this.acerto(e); if (h0) { const i = this.pecas.children.indexOf(h0.object); if (i >= 0) this.aoClicarObjeto(i); } }
      return;
    }
    const h = this.acerto(e);
    if (!h) return; // clique fora da peça continua girando a câmera
    e.stopImmediatePropagation();
    this.arrastando = true;
    this.controles.enabled = false;
    this.ponto = h.point.clone();
    this.objetoPonto = h.object;
    this.seguirFace(h);
    this.desenharMarcador();
  }
  // normal da face atingida (em coordenadas do mundo) -> nova base do desenho
  seguirFace(h) {
    if (!this.selecao?.auto || !h.face) return false;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    const b = this.selecao.auto(n);
    this.selecao.base = b; this.selecao.dir = b.D.clone();
    return true;
  }
  aoMover(e) {
    if (!this.arrastando) return;
    const h = this.acerto(e);
    if (!h) return;
    this.ponto.copy(h.point);
    this.objetoPonto = h.object;
    if (this.seguirFace(h)) return this.desenharMarcador();
    this.marcador.position.copy(this.ponto).addScaledVector(this.selecao.dir, -0.3);
  }
  aoSubir() { if (this.arrastando) { this.arrastando = false; this.controles.enabled = true; } }

  desenharMarcador() {
    if (this.marcador) { this.marcador.traverse(o => o.geometry?.dispose()); this.cena.remove(this.marcador); }
    const { raio, dir, forma, base } = this.selecao;
    if (forma && base) {
      const pts = [];
      for (const p of forma) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; pts.push(a[0], a[1], 0, b[0], b[1], 0); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const linhas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd6452b, depthTest: false, transparent: true, opacity: 0.9 }));
      linhas.renderOrder = 999;
      const g = new THREE.Group();
      g.add(linhas);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(base.U, base.V, base.W));
      g.position.copy(this.ponto).addScaledVector(dir, -0.3);
      this.marcador = g;
      this.cena.add(g);
      return;
    }
    const mat = op => new THREE.MeshBasicMaterial({ color: 0xc8412a, transparent: true, opacity: op, depthTest: false, side: THREE.DoubleSide });
    const anel = new THREE.Mesh(new THREE.RingGeometry(Math.max(raio - 0.25, 0.05), raio + 0.25, 64), mat(0.95));
    const disco = new THREE.Mesh(new THREE.CircleGeometry(raio, 64), mat(0.25));
    anel.renderOrder = disco.renderOrder = 999;
    const g = new THREE.Group();
    g.add(disco, anel);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
    g.position.copy(this.ponto).addScaledVector(dir, -0.3);
    this.marcador = g;
    this.cena.add(g);
  }
}
