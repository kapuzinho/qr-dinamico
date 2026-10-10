// Configuração do painel. Os dois valores do Supabase ficam em:
// Supabase → Project Settings → API  (Project URL e a chave "anon public").
// A chave anon é pública por natureza (a segurança vem das regras do banco), pode ficar aqui.
// Deixando SUPABASE_URL vazio o painel abre em MODO DEMONSTRAÇÃO (dados só no seu navegador).
window.QR_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // endereço que vai dentro do QR (vazio = o próprio endereço do site, ex.: https://qr-kapu.vercel.app)
  DOMINIO: '',
  MARCA: 'Kapuzinho 3D',
  // seu WhatsApp (botões de contato na página do cliente)
  WHATSAPP: '5561920069782',
};
