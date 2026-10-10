// Copia o motor WebAssembly do manifold pra pasta public (o Vite serve como /manifold.wasm)
const fs = require('fs');
const path = require('path');
const origem = path.join(__dirname, '..', 'node_modules', 'manifold-3d', 'manifold.wasm');
const destino = path.join(__dirname, '..', 'public', 'manifold.wasm');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.copyFileSync(origem, destino);
console.log('manifold.wasm copiado para public/');
