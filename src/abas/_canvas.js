// utilidades de desenho 2D pra etiquetas (300 DPI)
export const DPI = 300;
export const px = mm => Math.round((mm / 25.4) * DPI);

export function quebrarTexto(g, texto, largura) {
  const linhas = [];
  for (const par of String(texto).split('\n')) {
    let atual = '';
    for (const p of par.split(/\s+/)) {
      const teste = atual ? `${atual} ${p}` : p;
      if (g.measureText(teste).width > largura && atual) { linhas.push(atual); atual = p; } else atual = teste;
    }
    linhas.push(atual);
  }
  return linhas;
}

// escreve uma linha diminuindo a fonte até caber na largura
export function textoCabendo(g, texto, x, y, largura, tamanhoMax, peso = 600, familia = 'Barlow, Arial, sans-serif') {
  let t = tamanhoMax;
  do { g.font = `${peso} ${t}px ${familia}`; t -= 2; } while (g.measureText(texto).width > largura && t > 8);
  g.fillText(texto, x, y);
  return t + 2;
}

export function baixarCanvas(canvas, nome) {
  canvas.toBlob(b => {
    const url = URL.createObjectURL(b);
    const a = Object.assign(document.createElement('a'), { href: url, download: nome });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

export function imprimirCanvas(canvas, larguraMm, alturaMm) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Imprimir</title><style>@page{size:${larguraMm}mm ${alturaMm}mm;margin:0}body{margin:0}img{width:${larguraMm}mm;height:${alturaMm}mm;display:block}</style></head><body><img src="${canvas.toDataURL('image/png')}" onload="setTimeout(()=>print(),200)"></body></html>`);
  w.document.close();
}
