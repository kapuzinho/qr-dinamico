// Plugin do Vite: expõe /api/bambu/* só no servidor local (npm run dev) pra chamar a CLI do Bambu Studio
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import JSZip from 'jszip';

const TIPOS = ['machine', 'process', 'filament'];

function varrer(pasta, saida = []) {
  if (!fs.existsSync(pasta)) return saida;
  for (const nome of fs.readdirSync(pasta)) {
    const p = path.join(pasta, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) varrer(p, saida);
    else if (nome.endsWith('.json')) saida.push(p);
  }
  return saida;
}

// índice nome -> arquivo, pra perfis do usuário e do sistema
function indice(exe, pastaUsuario) {
  const sistema = path.join(path.dirname(exe), 'resources', 'profiles', 'BBL');
  const idx = { machine: new Map(), process: new Map(), filament: new Map() };
  const lista = { machine: [], process: [], filament: [] };
  const ler = (arq, origem, tipoPasta) => {
    try {
      const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
      const tipo = j.type || tipoPasta;
      if (!TIPOS.includes(tipo) || !j.name) return;
      if (!idx[tipo].has(j.name) || origem === 'usuario') idx[tipo].set(j.name, arq);
      if (origem === 'usuario' || j.instantiation === 'true') lista[tipo].push({ nome: j.name, origem });
    } catch { /* json inválido */ }
  };
  for (const t of TIPOS) for (const a of varrer(path.join(sistema, t))) ler(a, 'sistema', t);
  for (const t of TIPOS) for (const a of varrer(path.join(pastaUsuario, t))) ler(a, 'usuario', t);
  return { idx, lista };
}

function resolver(idx, tipo, nome, prof = 0) {
  const arq = idx[tipo].get(nome);
  if (!arq) throw new Error(`Perfil não encontrado: ${nome}`);
  const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
  if (!j.inherits || prof > 12) return j;
  const base = resolver(idx, tipo, j.inherits, prof + 1);
  const r = { ...base, ...j };
  delete r.inherits;
  return r;
}

const segundos = s => { let t = 0; for (const [, v, u] of String(s).matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/g)) t += v * { d: 86400, h: 3600, m: 60, s: 1 }[u]; return t; };

async function lerResultado(arq3mf) {
  const zip = await JSZip.loadAsync(fs.readFileSync(arq3mf));
  let peso = null, seg = null;
  const info = zip.file('Metadata/slice_info.config');
  if (info) {
    const x = await info.async('string');
    const pred = [...x.matchAll(/key="prediction" value="([\d.]+)"/g)].reduce((s, m) => s + Number(m[1]), 0);
    const pesos = [...x.matchAll(/key="weight" value="([\d.]+)"/g)].reduce((s, m) => s + Number(m[1]), 0);
    if (pred) seg = pred;
    if (pesos) peso = pesos;
  }
  if (peso === null || seg === null) {
    const gc = Object.keys(zip.files).find(n => /Metadata\/plate_\d+\.gcode$/.test(n));
    if (gc) {
      const cab = (await zip.file(gc).async('string')).slice(0, 20000);
      const mt = cab.match(/total estimated time:\s*([^;\n]+)/i) || cab.match(/model printing time:\s*([^;\n]+)/i);
      const mp = cab.match(/total filament weight \[g\]\s*:\s*([\d.]+)/i) || cab.match(/filament used \[g\]\s*=\s*([\d.]+)/i);
      if (mt && seg === null) seg = segundos(mt[1]);
      if (mp && peso === null) peso = Number(mp[1]);
    }
  }
  return { peso, segundos: seg };
}

const lerCorpo = req => new Promise((ok, erro) => { const b = []; req.on('data', c => b.push(c)); req.on('end', () => ok(Buffer.concat(b))); req.on('error', erro); });
const json = (res, cod, obj) => { res.statusCode = cod; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

export default function pluginBambu() {
  return {
    name: 'bambu-fatiamento',
    configureServer(server) {
      server.middlewares.use('/api/bambu/perfis', (req, res) => {
        try {
          const q = new URL(req.url, 'http://x').searchParams;
          const exe = q.get('exe'), pasta = q.get('pasta');
          if (!fs.existsSync(exe)) return json(res, 400, { erro: `Não achei o Bambu Studio em ${exe}` });
          const { lista } = indice(exe, pasta);
          json(res, 200, lista);
        } catch (e) { json(res, 500, { erro: e.message }); }
      });
      server.middlewares.use('/api/bambu/fatiar', async (req, res) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k3d-fatiar-'));
        try {
          const cfg = JSON.parse(decodeURIComponent(req.headers['x-config'] || '{}'));
          const { idx } = indice(cfg.exe, cfg.pasta);
          const arq = {};
          for (const t of TIPOS) {
            arq[t] = path.join(dir, `${t}.json`);
            fs.writeFileSync(arq[t], JSON.stringify(resolver(idx, t, cfg[t]), null, 1));
          }
          const stl = path.join(dir, 'peca.stl');
          fs.writeFileSync(stl, await lerCorpo(req));
          const args = ['--slice', '0', '--arrange', '1', '--load-settings', `${arq.machine};${arq.process}`, '--load-filaments', arq.filament,
            '--outputdir', dir, '--export-3mf', 'saida.3mf', stl];
          const log = await new Promise(ok => execFile(cfg.exe, args, { timeout: 10 * 60 * 1000, windowsHide: true }, (e, so, se) => ok(`${so}\n${se}\n${e ? e.message : ''}`)));
          const saida = path.join(dir, 'saida.3mf');
          if (!fs.existsSync(saida)) {
            let msg = 'O Bambu Studio não gerou o arquivo fatiado.';
            try { const r = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')); if (r.error_string) msg += ` ${r.error_string}`; } catch { /* sem result.json */ }
            return json(res, 500, { erro: msg, log: log.slice(-2000) });
          }
          json(res, 200, await lerResultado(saida));
        } catch (e) {
          json(res, 500, { erro: e.message });
        } finally {
          try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ }
        }
      });
    },
  };
}
