// Ofusca o código do site no build de produção (npm run build).
// Só o código do projeto é ofuscado; bibliotecas (three, manifold, supabase...) ficam num arquivo separado,
// porque ofuscá-las deixaria o site lento sem proteger nada seu.
import JavaScriptObfuscator from 'javascript-obfuscator';

const OPCOES = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.3,   // leve: o site faz muita conta, não pode ficar lento
  deadCodeInjection: false,
  numbersToExpressions: true,
  simplify: true,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  selfDefending: true,                    // código formatado/"embelezado" deixa de funcionar
  disableConsoleOutput: true,
  sourceMap: false,
};

export default function pluginOfuscar() {
  return {
    name: 'kap3d-ofuscar',
    apply: (_, env) => env.command === 'build' && env.mode !== 'semofuscar',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const arq of Object.values(bundle)) {
        if (arq.type !== 'chunk' || arq.name === 'libs' || /libs/.test(arq.fileName)) continue;
        arq.code = JavaScriptObfuscator.obfuscate(arq.code, OPCOES).getObfuscatedCode();
      }
    },
  };
}
