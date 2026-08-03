# gswmind

Organizador pessoal inspirado no Trello, com áreas da vida segregadas (Work, Rotina, Estudos, Metas...), etiquetas coloridas, fundos personalizáveis e sincronização automática entre PC e celular.

---

## 1. Rodar localmente na sua máquina

Requisitos: [Node.js](https://nodejs.org) instalado (versão 18 ou superior).

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente `http://localhost:5173`).

Sem configurar o Firebase, o app funciona normalmente, mas salva os dados só no navegador do aparelho (aparece "💾 salvando só neste aparelho" no canto da sidebar).

---

## 2. Ligar a sincronização entre celular e PC (Firebase — grátis, com login)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e clique em **Adicionar projeto** (pode chamar de `gswmind`). Pode desativar o Google Analytics.
2. Na tela inicial do projeto, clique no ícone **`</>` (Web)** para registrar um app web (qualquer apelido serve).
3. O Firebase vai mostrar um bloco de código com um objeto `firebaseConfig`. **Copie os valores** e cole no arquivo `src/firebase-config.js` deste projeto.
4. **Ative o login:** menu lateral → **Build → Authentication → Get started** → na aba "Sign-in method", clique em **E-mail/senha** → ative a primeira opção → **Salvar**.
5. **Ative o banco:** menu lateral → **Build → Firestore Database → Criar banco de dados** → edição **Standard** → localização `southamerica-east1` (São Paulo) → **"Iniciar no modo de teste"** (vamos trocar a regra no passo 7).
6. **Crie sua conta manualmente (acesso restrito — só você loga):** no Firebase, vá em **Authentication → aba Users → Add user**. Digite seu e-mail e uma senha (mínimo 6 caracteres) → **Add user**. A tela de login do gswmind não tem opção de "criar conta" — só quem você cadastrar aqui consegue entrar.
7. Rode o app (`npm run dev`) e faça login com esse e-mail e senha. Pronto, você está logado e sincronizado (aparece "☁ sync ligado" na sidebar).
8. **Trave o banco só para usuários logados verem seus próprios dados:** no Firebase, vá em **Firestore Database → aba Regras**, apague o conteúdo e cole:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   Clique em **Publicar**. Essa regra não expira, e garante que cada pessoa só acessa os próprios quadros — mesmo sabendo o link do banco, ninguém mais consegue ler ou escrever seus dados.

Para usar no celular ou em outro PC: acesse o mesmo site (local ou publicado) e faça login com o mesmo e-mail e senha — os quadros aparecem sincronizados automaticamente, em tempo real.

---

## 3. Hospedar no GitHub Pages (com deploy automático)

O projeto já vem com um workflow do GitHub Actions: **todo push na branch `main` publica o site automaticamente**.

1. Crie um repositório novo no GitHub (ex.: `gswmind`).
2. Na pasta do projeto, rode:

```bash
git init
git add .
git commit -m "gswmind v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gswmind.git
git push -u origin main
```

3. No GitHub, vá em **Settings → Pages** e, em **Source**, escolha **GitHub Actions**.
4. Aguarde 1–2 minutos (acompanhe na aba **Actions**). Seu site vai ficar em:

```
https://SEU_USUARIO.github.io/gswmind/
```

Abra esse endereço no celular e no PC. Com o Firebase configurado, os dois ficam sempre sincronizados.

> 💡 No celular: abra o site no navegador e use **"Adicionar à tela inicial"** — vira um ícone como se fosse um app.

> ⚠️ Repositório **público** expõe o código (incluindo o `firebase-config.js` — essas chaves do Firebase são feitas para ficar no front-end, então não é um vazamento de senha, mas com as regras em modo de teste qualquer pessoa com o endereço do banco poderia ler/escrever). Para uso pessoal, o mais simples é deixar o **repositório privado** — GitHub Pages funciona em repositório privado nos planos pagos, ou você pode deixar público e depois endurecer as regras do Firestore.

---

## 4. Estrutura do projeto

```
gswmind/
├── index.html                  # página base (título, fonte Inter)
├── package.json
├── vite.config.js
├── .github/workflows/deploy.yml  # deploy automático no Pages
└── src/
    ├── main.jsx                # ponto de entrada
    ├── App.jsx                 # toda a interface, login e lógica
    ├── auth.js                 # autenticação (e-mail/senha) via Firebase
    ├── storage.js              # camada de dados, isolada por usuário
    └── firebase-config.js      # SUA configuração do Firebase (preencher)
```

## Funcionalidades

- Áreas da vida segregadas, cada uma com quadro, listas, etiquetas e fundo próprios
- Arrastar e soltar cartões e listas (no celular, use o menu "mover para" dentro do cartão)
- Etiquetas coloridas por área, datas de entrega com alerta de atraso, descrições, marcar como concluído
- 10 fundos (gradientes e cores sólidas) e 9 cores de lista
- Salvamento automático com indicador de status
