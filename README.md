# MobílIA

PWA em React onde o usuário desenha seu próprio móvel conversando com uma IA
(texto + foto do ambiente) e, ao final, pode enviar o projeto para fabricação
via Cortecloud.

## Rodando localmente

```bash
npm install
npm run dev
```

Em desenvolvimento, as chamadas para `/api/*` são encaminhadas para o site
publicado (`https://mobilia-99550.web.app`), ou seja, para a Cloud Function já
implantada. Para usar o emulador local, rode `firebase emulators:start` e
inicie o Vite com `API_PROXY_TARGET=http://127.0.0.1:5000 npm run dev`.

## Backend de IA (Gemini + Claude)

A conversa é processada pela Cloud Function `chat` (`functions/`), servida em
`/api/chat` pelo Firebase Hosting. Ela valida o token do Firebase Auth, lê as
fotos do ambiente direto do Storage (apenas de `rooms/{uid}/`) e chama:

1. **Gemini** (`gemini-3.8-flash`) como provedor principal;
2. **Claude** (`claude-opus-5-5`) como reserva, se o Gemini falhar, demorar
   demais ou devolver uma resposta inválida.

Os dois respondem no mesmo formato JSON (`{ reply, designSpec? }`), definido
em `functions/src/prompt.js` junto com o prompt de sistema.

Para implantar (requer o plano **Blaze** no Firebase):

```bash
firebase functions:secrets:set GEMINI_API_KEY      # chave do Google AI Studio
firebase functions:secrets:set ANTHROPIC_API_KEY   # chave do Claude Console
cd functions && npm install && cd ..
npm run build
firebase deploy --only functions,hosting
```

Para o emulador local, crie `functions/.secret.local` com
`GEMINI_API_KEY=...` e `ANTHROPIC_API_KEY=...` (o arquivo é ignorado pelo git).

## O que já está implementado

- **Splash** → aguarda o Firebase Auth resolver e redireciona para `/chat`
  ou `/login`, sem piscar a tela de login para quem já está autenticado.
- **Login** (`src/components/Login.jsx`) — e-mail/senha via Firebase Auth.
  Cadastro (`createUserWithEmailAndPassword`) já está em `AuthContext`,
  falta só a tela.
- **Chat** (`src/components/ChatScreen.jsx`) — histórico de mensagens
  persistido no Firestore por projeto, upload de foto para Firebase
  Storage, chamada à IA através de `src/services/aiClient.js`.
- **Drawer de projetos** — lista os projetos do usuário em tempo real
  (`useProjects`, ordenado por `updatedAt`).
- **Cartão de design + exportação Cortecloud** — quando a IA finaliza um
  projeto (`designSpec`), o cartão permite copiar a lista de peças para colar
  no Cortecloud (*Importar peças → Colar dados da planilha ou Excel*) ou
  baixar uma planilha `.xlsx` no modelo de importação do Cortecloud, com
  abas de chapas, fitas, componentes e cliente
  (`src/services/cortecloudExport.js`).

## O que falta decidir/implementar antes de ir pra produção

1. **Integração direta com o Cortecloud** — hoje a lista de peças é
   exportada e colada manualmente; `src/services/cortecloud.js` é o ponto de
   partida para uma integração via API (https://cortecloud.com/api-docs/).
2. **Backend Cortecloud** (`VITE_BACKEND_BASE_URL`): rotas que criam o
   serviço na Cortecloud a partir do `designSpec` e implementam o fluxo de
   checkout (Cortecloud chama seu endpoint pedindo a URL de pagamento;
   depois de pago, você avisa a Cortecloud). Ver a documentação deles em
   https://cortecloud.com/api-docs/.
3. **Tela de cadastro** — falta só a UI; a função já existe em
   `AuthContext.register`.
4. **Ícones do PWA** — troque os placeholders em `public/icons/` pelo
   logo em 192×192 e 512×512 (fundo sólido, sem transparência, para o
   ícone "maskable").

## Regras de segurança do Firestore (ponto de partida)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, update: if request.auth != null && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerId;
    }
  }
}
```

E no Storage, restrinja `rooms/{uid}/**` para que só o próprio usuário
possa escrever nesse caminho.
