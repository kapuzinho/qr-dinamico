# Controle de acesso — como colocar no ar

O site tem **login** (e-mail/senha ou **Google**), **cadastro pela tela inicial**, **"esqueci a senha"**, **uma sessão por conta** (se a conta já está aberta num computador, outro não entra),
**limite de downloads** por usuário (padrão 5) e um **painel de administrador** (`/admin.html`).

Tudo roda no **Supabase** (gratuito) e o site pode ficar na **Vercel** (gratuita), igual ao cardápio da Rota do Churrasco.

> Sem configurar nada (sem `.env`), o site continua funcionando em **modo local**: sem login e sem limite.
> Serve só pra você desenvolver no seu PC (`npm run dev`).

---

## 1. Criar o projeto no Supabase
1. Entre em https://supabase.com e crie um projeto (anote a senha do banco).
2. **SQL Editor** → *New query* → cole o conteúdo de `supabase/schema.sql` → **Run**.
   (Pode rodar de novo quando eu mandar atualização: ele não apaga nada.)
3. **Authentication → Sign In / Providers → Email**:
   - **"Allow new users to sign up" LIGADO** → a pessoa cria a conta na tela inicial (aba *Criar conta*) ou entra com o Google.
     Desligado → só você cria contas, pelo admin (e o Google também deixa de criar contas novas).
   - **"Confirm email" LIGADO** (recomendado): a pessoa precisa clicar no link que chega no e-mail antes de entrar.
4. **Authentication → URL Configuration**:
   - *Site URL*: `https://seu-site.vercel.app`
   - *Redirect URLs*: adicione `https://seu-site.vercel.app/**` e `http://localhost:5173/**`
   (é pra onde o Google, a confirmação de e-mail e o "esqueci a senha" mandam a pessoa de volta).
5. No **admin** do site você escolhe se quem se cadastra sozinho **já entra liberado** ou **fica aguardando você aprovar**
   (aparece com o selo *aguardando* e o botão **Aprovar**).

### Login com Google (opcional)
1. https://console.cloud.google.com → crie um projeto → **APIs e serviços → Tela de consentimento OAuth**:
   tipo *Externo*, nome do app (ex.: Kapuzinho 3D), seu e-mail de suporte → publique.
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
   Em *URIs de redirecionamento autorizados* coloque: `https://SEU-PROJETO.supabase.co/auth/v1/callback`
3. Copie o **ID do cliente** e a **Chave secreta**.
4. Supabase → **Authentication → Sign In / Providers → Google** → ative e cole os dois → Save.
   Pronto: o botão *Continuar com o Google* da tela de login passa a funcionar.

### E-mails (confirmação e "esqueci a senha")
O servidor de e-mail grátis do Supabase manda **poucos e-mails por hora** (serve pra testar).
Pra uso de verdade, ligue um SMTP grátis em **Project Settings → Authentication → SMTP Settings**
(ex.: Brevo ou Resend, que têm plano gratuito).

## 2. Criar o seu usuário administrador
1. **Authentication → Users → Add user → Create new user**: seu e-mail e senha, marque **Auto Confirm User**.
2. No **SQL Editor**, rode (trocando o e-mail):
   ```sql
   update public.perfis set papel = 'admin', limite_downloads = 100000 where email = 'seu@email.com';
   ```

## 3. Publicar as funções do servidor (montam os arquivos e contam os downloads)
No PowerShell, dentro da pasta do projeto:
```powershell
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF      # aparece na URL do painel: supabase.com/dashboard/project/SEU_PROJECT_REF
supabase functions deploy exportar --no-verify-jwt
supabase functions deploy admin-usuarios --no-verify-jwt
```
Opcional (mais seguro): só aceitar pedidos do seu site:
```powershell
supabase secrets set SITE_ORIGEM=https://seu-site.vercel.app
```

## 4. Configurar o site
1. Copie `.env.exemplo` para `.env` e preencha com **Project Settings → API**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chave **anon public** (NUNCA a service_role)
2. `npm install`
3. `npm run build` → gera a pasta `dist/` já **ofuscada**.
   (`npm run build:sem-ofuscar` gera sem ofuscar, se precisar investigar algum erro.)

## 5. Colocar na Vercel
- Pelo site da Vercel: *Add New → Project*, importe o repositório, **Framework: Vite**, e em
  *Environment Variables* coloque as duas variáveis do `.env`. Build: `npm run build`, saída: `dist`.
- Ou pelo terminal: `npm i -g vercel` → `vercel` (na primeira vez) → `vercel --prod`.

---

## Como funciona
| O quê | Como |
|---|---|
| Login | e-mail + senha ou Google (Supabase Auth). Conta criada pela própria pessoa (se o cadastro estiver aberto) ou pelo admin. |
| Cadastro novo | entra com o **limite padrão**. Pode já sair liberado ou ficar **aguardando aprovação** (configurável no admin). |
| Esqueci a senha | manda um link por e-mail; ao abrir, o site pede a senha nova. |
| 1 sessão por conta | ao entrar, o banco grava a sessão. Outro computador tentando entrar recebe *"Essa conta já está aberta em outro computador"*. O mesmo navegador recarregando a página continua normal. |
| Sessão "presa" | o site manda um sinal a cada 1 min. Fechou o navegador sem clicar em **Sair**? A conta fica livre depois de **3 min** (ajustável no admin). O admin também pode **Derrubar sessão**. |
| Limite de downloads | todo download (.3mf, .zip e .stl) passa pelo servidor, que confere sessão e limite **antes** de entregar o arquivo. Editar, gerar e visualizar é livre. |
| Arquivo final | o **.3mf com cores e pausa pro Bambu é montado no servidor** — esse código não vai mais pro navegador. |
| Ofuscação | o código do site sai ofuscado no build (as bibliotecas ficam num arquivo à parte, sem ofuscar, pra não pesar). |
| Admin | criar usuário (com senha gerada), limite, papel, validade, ativar/desativar, +5, zerar usados, trocar senha, derrubar sessão, excluir, histórico de downloads/logins/bloqueios. |

## Recomendações
- **Desativar** (em vez de excluir) quem parou de pagar: o histórico fica guardado.
- Use a **validade** pra planos mensais: a conta para de entrar sozinha depois da data.
- Troque a senha de quem pedir pelo botão **Senha** no admin (ela aparece na tela pra você mandar).
- O Supabase gratuito pausa o projeto depois de 7 dias **sem nenhum acesso**; com uso normal não pausa.
- Limite técnico: o servidor tem ~2 s de processamento por download. Modelos muito grandes
  (mais de ~250 mil triângulos, ex.: "Multiplicar" com muitas cópias) podem falhar — aí baixe em partes.

## Sobre segurança (sendo honesto)
Nada que roda no navegador é 100% inquebrável. O que este esquema garante:
- quem não tem login **não baixa nada**;
- o **limite e a sessão única são conferidos no servidor** (não dá pra burlar mexendo no site);
- o **gerador do .3mf pronto pro Bambu** (cores, pausa, perfil da A1) fica só no servidor;
- o resto do código vai ofuscado, o que dificulta bastante copiar.

Os modelos-base em `public/modelos/` (kettlebell, abridor) continuam acessíveis por quem souber o endereço.
E alguém muito técnico ainda poderia copiar a malha 3D da memória do navegador — isso nenhum site evita.
