// Empacotamento dos arquivos de download (.3mf com cores/pausa pro Bambu, .stl e .zip de STLs).
// Código "puro" (sem three.js nem DOM): roda no servidor (Supabase Edge Function / Deno) e,
// só no modo local de desenvolvimento, no navegador.
//
// Pacote binário que o site manda pro servidor:
//   [u32 tamanho do cabeçalho][cabeçalho JSON (UTF-8, completado até múltiplo de 4)]
//   e, pra cada peça na ordem do cabeçalho: Float32 posições (nPos) + Uint32 índices (nIdx)
// cabeçalho: { formato: '3mf'|'zip'|'stl', nome, opcoes, partes: [{ nome, cor, nPos, nIdx }] }

import { lerPacote, montarPacote } from './pacote.js';
export { lerPacote, montarPacote };
const enc = new TextEncoder();

// ---------- STL binário ----------
export function stlBinario(pos, idx) {
  const nT = idx.length / 3, buf = new ArrayBuffer(84 + nT * 50), dv = new DataView(buf);
  const titulo = enc.encode('Kapuzinho 3D');
  new Uint8Array(buf, 0, 80).set(titulo.slice(0, 80));
  dv.setUint32(80, nT, true);
  let o = 84;
  for (let t = 0; t < nT; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true); o += 12;
    for (const v of [a, b, c]) { dv.setFloat32(o, pos[v], true); dv.setFloat32(o + 4, pos[v + 1], true); dv.setFloat32(o + 8, pos[v + 2], true); o += 12; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}

export async function gerarZipSTL(JSZip, partes) {
  const zip = new JSZip();
  const usados = new Set();
  for (const p of partes) {
    let n = p.nome.toLowerCase().endsWith('.stl') ? p.nome : p.nome + '.stl', k = 2;
    while (usados.has(n)) n = p.nome.replace(/\.stl$/i, '') + `_${k++}.stl`;
    usados.add(n);
    zip.file(n, stlBinario(p.pos, p.idx));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 3 } });
}

// ---------- 3MF (cores pro Bambu Studio; com pausa vira projeto completo da A1) ----------
const xmlSeguro = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const CORES_PADRAO = [0x0f7c80, 0xb8893a, 0x5a6fa8, 0xa2566e, 0x5e8c4a, 0x8a6bb5, 0xc07a3e, 0x4a8fa0];

// (escrito em pedaços: montar uma string por vértice deixava lento no servidor, que tem limite de CPU)
const num = x => { const r = Math.round(x * 1e4) / 1e4; return Object.is(r, -0) ? '0' : String(r); };
function malha3MF(pos, idx) {
  let v = '', t = '';
  for (let i = 0; i < pos.length; i += 3) v += '<vertex x="' + num(pos[i]) + '" y="' + num(pos[i + 1]) + '" z="' + num(pos[i + 2]) + '"/>';
  for (let i = 0; i < idx.length; i += 3) t += '<triangle v1="' + idx[i] + '" v2="' + idx[i + 1] + '" v3="' + idx[i + 2] + '"/>';
  return '<mesh><vertices>' + v + '</vertices><triangles>' + t + '</triangles></mesh>';
}

// opções: material 'PLA' | 'PETG' e resistencia 'padrao' | 'reforcado' | 'maximo' (perfis em bambu-perfis.json).
// Com PERFIS o .3mf sempre sai como projeto da A1 já configurado; sem PERFIS, só vira projeto quando tem pausa.
export async function gerar3MF(JSZip, CONFIG_A1, partes, nomeObjeto, { pausas = [], alturaCamada = 0.2, primeiraCamada = 0.2, material = 'PETG', resistencia = 'reforcado' } = {}, PERFIS = null) {
  pausas = Array.isArray(pausas) ? pausas.slice(0, 20) : [];
  const projetoBambu = pausas.length > 0 || !!PERFIS;
  const idObj = partes.length + 1;
  partes = partes.map((pt, i) => (pt.cor === undefined || pt.cor === null) ? { ...pt, cor: CORES_PADRAO[i % CORES_PADRAO.length] } : pt);
  const hex6 = c => {
    const n = (typeof c === 'number') ? c : parseInt(String(c).replace('#', '').slice(-6), 16);
    return '#' + ((n || 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
  };
  const cores = [];
  const idxCor = partes.map(pt => {
    const c = hex6(pt.cor);
    let i = cores.indexOf(c);
    if (i < 0) { cores.push(c); i = cores.length - 1; }
    return i;
  });
  const nomeDe = pt => xmlSeguro(pt.nome.replace(/\.stl$/i, ''));
  const grupo = `<m:colorgroup id="1">${cores.map(c => `<m:color color="${c}"/>`).join('')}</m:colorgroup>`;
  const objetos = partes.map((pt, i) =>
    `<object id="${i + 1}" type="model" name="${nomeDe(pt)}" pid="1" pindex="${idxCor[i]}">${malha3MF(pt.pos, pt.idx)}</object>`).join('');
  const comps = partes.map((_, i) => `<component objectid="${i + 1}"/>`).join('');
  const modelo = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
<metadata name="Title">${xmlSeguro(nomeObjeto)}</metadata>
<metadata name="Application">${projetoBambu ? 'BambuStudio-02.00.00.00' : 'Kapuzinho 3D'}</metadata>${projetoBambu ? '\n<metadata name="BambuStudio:3mfVersion">1</metadata>' : ''}
<resources>${grupo}${objetos}<object id="${idObj}" type="model" name="${xmlSeguro(nomeObjeto)}"><components>${comps}</components></object></resources>
<build><item objectid="${idObj}"/></build>
</model>`;
  const config = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${idObj}">
    <metadata key="name" value="${xmlSeguro(nomeObjeto)}"/>
    <metadata key="extruder" value="${idxCor[0] + 1}"/>
${partes.map((pt, i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${nomeDe(pt)}"/>
      <metadata key="extruder" value="${idxCor[i] + 1}"/>
    </part>`).join('\n')}
  </object>${projetoBambu ? `
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="${idObj}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="${idObj}"/>
    </model_instance>
  </plate>` : ''}
</config>
`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  zip.file('3D/3dmodel.model', modelo);
  zip.file('Metadata/model_settings.config', config);
  if (projetoBambu) {
    const cfg = JSON.parse(JSON.stringify(CONFIG_A1));
    const nBase = cfg.filament_settings_id.length;
    if (cores.length > nBase) {
      for (const v of Object.values(cfg)) if (Array.isArray(v) && v.length === nBase) while (v.length < cores.length) v.push(v[v.length - 1]);
    }
    if (PERFIS) {                                       // material (filamento oficial da Bambu pra A1) + resistência
      const fil = PERFIS.filamentos[String(material).toUpperCase()] || PERFIS.filamentos.PETG;
      for (const [k, v] of Object.entries(fil)) if (Array.isArray(cfg[k])) cfg[k] = cfg[k].map(() => v);
      const pr = PERFIS.resistencia[resistencia] || PERFIS.resistencia.reforcado;
      for (const [k, v] of Object.entries(pr)) cfg[k] = v;
    }
    const nF = Math.max(nBase, cores.length);
    cfg.filament_colour = Array.from({ length: nF }, (_, i) => cores[i] || '#FFFFFF');
    cfg.filament_self_index = Array.from({ length: nF }, (_, i) => String(i + 1)); // sem isso o Bambu recusa: "Invalid configuration file"
    cfg.layer_height = String(+alturaCamada || 0.2);
    cfg.initial_layer_print_height = String(+primeiraCamada || 0.2);
    zip.file('Metadata/project_settings.config', JSON.stringify(cfg, null, 4));
    const modo = cores.length > 1 ? 'MultiAsSingle' : 'SingleExtruder';
    const camadas = pausas.map(pz => `<layer top_z="${Number(pz.z).toFixed(2)}" type="1" extruder="1" color="" extra="${xmlSeguro(pz.msg || '')}" gcode="M400 U1"/>`).join('\n');
    zip.file('Metadata/custom_gcode_per_layer.xml', `<?xml version="1.0" encoding="utf-8"?>
<custom_gcodes_per_layer>
<plate>
<plate_info id="1"/>
${camadas}
<mode value="${modo}"/>
</plate>
</custom_gcodes_per_layer>
`);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 3 } });
}

// monta o arquivo final a partir do pacote já lido
export async function empacotar(JSZip, CONFIG_A1, meta, partes, PERFIS = null) {
  const nome = String(meta.nome || 'modelo').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  if (meta.formato === '3mf') return { bytes: await gerar3MF(JSZip, CONFIG_A1, partes, nome.replace(/\.3mf$/i, ''), meta.opcoes || {}, PERFIS), tipo: 'model/3mf', nome: nome.endsWith('.3mf') ? nome : nome + '.3mf' };
  if (meta.formato === 'zip') return { bytes: await gerarZipSTL(JSZip, partes), tipo: 'application/zip', nome: nome.endsWith('.zip') ? nome : nome + '.zip' };
  if (meta.formato === 'stl') return { bytes: stlBinario(partes[0].pos, partes[0].idx), tipo: 'model/stl', nome: nome.endsWith('.stl') ? nome : nome + '.stl' };
  throw new Error('Formato inválido.');
}
