// Configuração do painel. Os dois valores do Supabase ficam em:
// Supabase → Project Settings → API  (Project URL e a chave "anon public").
// A chave anon é pública por natureza (a segurança vem das regras do banco), pode ficar aqui.
// Deixando SUPABASE_URL vazio o painel abre em MODO DEMONSTRAÇÃO (dados só no seu navegador).
window.QR_CONFIG = {
  SUPABASE_URL: 'https://xraoqlwewywwazvffrbu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYW9xbHdld3l3d2F6dmZmcmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDkwNDcsImV4cCI6MjEwNzEyNTA0N30.j1yqsbW35T80_dDlocVUqJve2Ns6GyMjbwPl8P8oJOg',
  // endereço que vai dentro do QR (vazio = o próprio endereço do site, ex.: https://qr-kapu.vercel.app)
  DOMINIO: '',
  MARCA: 'Kapuzinho 3D',
};
