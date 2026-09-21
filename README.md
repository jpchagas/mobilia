# MobílIA

PWA em React onde o usuário desenha seu próprio móvel conversando com uma IA
(texto + foto do ambiente) e, ao final, pode enviar o projeto para fabricação
via Cortecloud.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com suas credenciais do Firebase
npm run dev
```

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
- **Cartão de design + handoff Cortecloud** — quando a IA retorna um
  `designSpec`, aparece um cartão com o botão "Enviar para fabricação",
  que chama `src/services/cortecloud.js`.

## O que falta decidir/implementar antes de ir pra produção

1. **Backend de IA** (`VITE_AI_ENDPOINT`): uma Cloud Function (ou API
   própria) que recebe `{ history, attachment }`, chama o provedor
   escolhido (Gemini, GPT-4o etc.) com a imagem + o histórico, e devolve
   `{ reply, designSpec }`. O `designSpec` deve conter o que a integração
   ERP da Cortecloud espera: dimensões, material (chapa), fita de borda e
   furação.
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
