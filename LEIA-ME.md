# QR Dinâmico — Kapuzinho 3D

O QR Code da placa aponta para um **link curto seu** (ex.: `https://kqr.vercel.app/k7p2xa`).
Quem escaneia passa pelo seu site, o clique é contado e a pessoa vai para o **destino que você
escolheu no painel**. Você troca o destino, pausa ou coloca validade quando quiser, **sem reimprimir a placa**.

- **Painel**: lista de QRs com nome, cliente, telefone, destino, validade, cliques e situação; busca e filtros
  (ativos, vencem em 30 dias, vencidos, sem destino, desativados); criar um ou **em lote**; baixar QR em PNG/SVG
  ou um .zip com todos; gráfico de leituras por dia, aparelho, sistema e cidade; exportar CSV.
- **Validade**: depois da data o QR mostra "Este QR Code expirou" (com botão do seu WhatsApp) ou manda
  para um link "depois de vencer", se você colocar um. Desmarcar **Ativo** pausa na hora.
- **Sem destino** (estoque): imprima as placas antes; quem escanear vê "QR ainda não ativado". Na venda você
  abre o QR da placa, coloca o link do cliente e salva.
- Não guarda IP de ninguém: só data, tipo de aparelho, sistema, navegador e cidade aproximada.
  Prévias de link (WhatsApp, Facebook etc.) não contam como clique.

## Duas páginas
- **`/` (endereço principal)** → **página do cliente**: tela de entrada com seu WhatsApp. O cliente vê só os QRs dele,
  cria até o limite que você deu, troca nome/link de destino, baixa o QR e vê os cliques.
  Não consegue apagar, mudar validade, código, nem passar do limite (as regras estão no banco).
- **`/admin`** → **seu painel**: tudo de antes + botão **Clientes** (cadastrar, limite, validade do plano, bloquear,
  convite pronto pro WhatsApp) e, em cada QR, o campo **Conta do cliente (dono)** pra passar um QR pro cliente.

Validade do plano do cliente: depois da data, todos os QRs dele param (mostram "QR expirou") e ele não consegue editar.
Desmarcar **Ativo** no cliente bloqueia o acesso e pausa os QRs dele na hora.

### Como o cliente entra
- **Sozinho:** abre o site → **Continuar com o Google** ou **Criar conta** (nome, e-mail, senha) → já entra.
  A conta dele é criada na hora com as regras de **/admin → Clientes → Cadastro pelo site…**
  (cadastro aberto/fechado, limite padrão, dias de validade padrão — ex.: 30 dias de teste).
- **Cadastrado por você:** `/admin` → **Clientes → + Novo cliente** (nome, e-mail, limite, validade) →
  **Enviar convite**. Quando ele entrar com esse e-mail (Google ou criar conta), cai direto na conta que você montou.

## Testar agora (sem instalar nada)

Abra o `admin.html` (seu painel) ou o `index.html` (página do cliente) no navegador. Sem o Supabase configurado
eles abrem em **modo demonstração**, com dados de exemplo salvos só no seu navegador (a página do cliente mostra a
"Pizzaria Bella"). O link curto não redireciona nesse modo: use **Simular leitura**.

## Colocar no ar (grátis: Supabase + Vercel)

### 1. Supabase (banco)
1. Em https://supabase.com → **New project**. Recomendo um projeto **separado** do GestorPrint, por exemplo
   `qr-dinamico` (o plano grátis permite 2). Região: São Paulo.
2. **SQL Editor → New query** → cole todo o `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: deixe **Allow new users to sign up** LIGADO e **Confirm email**
   DESLIGADO (assim quem cria conta já entra direto, sem esperar e-mail).
   Se preferir confirmar o e-mail, deixe ligado: o cliente recebe um link e entra depois de clicar.
   **Authentication → URL Configuration**: em **Site URL** coloque o endereço do site (ex.: `https://kpu-nine.vercel.app`
   ou seu domínio) e em **Redirect URLs** adicione `https://SEU-ENDERECO/**`. É pra onde vão os links de confirmação e de "esqueci a senha".
4. **Authentication → Users → Add user → Create new user**: seu e-mail e senha, com **Auto Confirm User** marcado.
5. De volta ao **SQL Editor**, rode trocando o e-mail:
   ```sql
   insert into public.qr_admins (user_id, email)
   select id, email from auth.users where email = 'SEU-EMAIL@gmail.com'
   on conflict do nothing;
   ```
6. **Project Settings → API** (ou **Data API**): copie a **Project URL** e a chave **anon public**.
   Não use a chave `service_role` em lugar nenhum.

### 2. Arquivo config.js
Abra o `config.js` e preencha:
```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...(chave anon public)',
```

### 3. GitHub
Crie um repositório novo (ex.: `qr-dinamico`) e suba **todos** os arquivos desta pasta
(`index.html`, `painel.js`, `painel.css`, `config.js`, `vercel.json`, `package.json`, `robots.txt`, `api/`, `supabase/`).

### 4. Vercel (site + redirecionamento)
1. https://vercel.com → **Add New… → Project** → importe o repositório.
2. **Project Name**: escolha um nome **curto**, porque ele vira o endereço do QR. Ex.: `kqr` → `https://kqr.vercel.app`.
   Quanto mais curto o link, menos "quadradinhos" o QR tem e melhor ele imprime na placa 3D.
3. **Framework Preset: Other**. Não precisa de comando de build.
4. **Environment Variables**:
   - `SUPABASE_URL` = a mesma Project URL
   - `SUPABASE_ANON_KEY` = a mesma chave anon
   - (opcional) `WHATSAPP` = `5561920069782` (aparece nas páginas de "QR expirou"; vazio = sem botão)
   - (opcional) `MARCA` = `Kapuzinho 3D`
5. **Deploy**. Abra o endereço: aparece o login do painel.

> ⚠️ **Não troque o endereço depois de imprimir placas.** O QR impresso tem o endereço gravado.
> Se quiser um domínio próprio (ex.: `qr.kapuzinho3d.com.br`, ~R$ 40/ano no registro.br), configure **antes**
> de vender, em Vercel → Settings → Domains, e coloque esse endereço em `DOMINIO` no `config.js`.

## Como usar na venda das placas
1. **Criar em lote** → "Placa Google", quantidade 10 → **Baixar os QRs (.zip)** (vem PNG, SVG e uma lista .csv).
2. No GestorPrint (**Placa Avaliação Google v2**), cole o **link curto** da placa no campo do link e imprima.
3. Na venda: abra a placa no painel → coloque **cliente**, **telefone**, o **link do Google do cliente**
   e a **validade** (ex.: +1 ano) → **Salvar**. Escaneie com o celular pra conferir.
4. Pra acompanhar: filtro **Vencem em 30 dias** pra oferecer renovação. A aba **Cliques** avisa quando alguém
   escaneou um QR vencido (bom motivo pra chamar o cliente).

## Arquivos
| Arquivo | O que é |
|---|---|
| `index.html`, `painel.js`, `painel.css` | o painel |
| `config.js` | endereço/chave do Supabase e domínio do QR |
| `api/r.js` | o redirecionamento (`/codigo` → destino), páginas de expirado/pausado |
| `vercel.json` | faz `/codigo` cair no redirecionamento |
| `supabase/schema.sql` | tabelas, segurança e a função que registra o clique |

## Atualizando uma instalação que já estava no ar
1. **Supabase → SQL Editor**: cole o `supabase/schema.sql` inteiro de novo e **Run** (só adiciona o que falta, não apaga nada).
2. **Supabase → Authentication**: faça o passo 3 acima (ligar cadastro + confirmar e-mail + URL Configuration).
3. **GitHub**: substitua `index.html`, `painel.js`, `painel.css`, `vercel.json`, `LEIA-ME.md`, `supabase/schema.sql` e
   adicione `admin.html`. **Não substitua o seu `config.js`** (ele tem sua URL e chave): só acrescente a linha
   `WHATSAPP: '5561920069782',` dentro dele.
4. Seu painel passa a ser **https://SEU-ENDERECO/admin** (o endereço principal agora é a página do cliente).

> E-mails (confirmação e "esqueci a senha"): o envio que vem pronto no Supabase manda poucos por hora.
> Se tiver muitos clientes entrando no mesmo dia, configure um SMTP grátis (Brevo/Resend) em
> Authentication → Emails → SMTP Settings.

## Login com Google (opcional, recomendado)
1. https://console.cloud.google.com → o mesmo projeto que você usou no GestorPrint (ou um novo) →
   **APIs e serviços → Credenciais** → abra o seu **ID do cliente OAuth** (tipo "Aplicativo da Web").
2. Em **URIs de redirecionamento autorizados** → **Adicionar URI**:
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`
   (o endereço do Supabase do QR Dinâmico — o mesmo da `SUPABASE_URL`) → **Salvar**.
3. Supabase do QR Dinâmico → **Authentication → Sign In / Providers → Google** → ligue, cole o
   **Client ID** e o **Client Secret** do Google → **Save**.
4. Confira **Authentication → URL Configuration** (Site URL e Redirect URLs com o endereço do site).

## Pix (links de pagamento)
Na aba **Pix** (cliente e admin):
- **Chaves Pix**: CPF, CNPJ, e-mail, telefone ou aleatória (o sistema confere CPF/CNPJ e o formato).
  O "nome de quem recebe" aparece na página e no app do banco de quem paga.
- **Links de pagamento** com endereço fácil: `https://SEU-ENDERECO/p/nome-da-loja`, valor fixo ou livre,
  descrição, ativar/pausar. A página mostra nome, valor, QR Code, **Pix copia e cola** com botão de copiar,
  a chave mascarada, aviso pra conferir o recebedor e o botão "Quero meu link Pix" (seu WhatsApp).
- Em cada link: **QR do link** (abre a página), **QR Pix direto** (o banco lê na hora, bom pra placa no balcão),
  código copia e cola e o contador de **acessos** (por dia, aparelho, cidade).
- **Limites**: cada cliente tem "Limite de links Pix" (padrão 10, você muda em Clientes; o padrão de contas novas
  fica em Clientes → Cadastro pelo site). Plano vencido ou cliente bloqueado = página mostra "link desativado".
- O sistema **não recebe nem confirma pagamentos**: o Pix vai direto pra conta da chave. O contador mostra quem
  abriu a página, não quem pagou.

### Atualizando pra ter o Pix
1. **Supabase → SQL Editor**: rode o `supabase/schema.sql` inteiro de novo.
2. **GitHub**: suba os arquivos novos/alterados: `pix-lib.js` (novo), `api/p.js` (novo), `package.json`,
   `vercel.json`, `index.html`, `admin.html`, `painel.js`, `painel.css`, `LEIA-ME.md`, `supabase/schema.sql`.
   **Não troque o seu `config.js`.**
3. A Vercel publica sozinha (ela instala o `qrcode-generator` do `package.json`). Teste criando uma chave e um
   link e abrindo `https://SEU-ENDERECO/p/o-nome-do-link`.
