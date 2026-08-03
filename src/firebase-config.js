/* ============================================================
   CONFIGURAÇÃO DO FIREBASE (sincronização entre aparelhos)

   1. Acesse https://console.firebase.google.com e crie um projeto
      (pode chamar de "gswmind").
   2. Dentro do projeto: clique no ícone </> (Web) para registrar um app.
   3. O Firebase vai mostrar um objeto "firebaseConfig" — copie os
      valores e cole aqui embaixo.
   4. No menu lateral, vá em Build > Firestore Database > Create database
      e escolha "Start in test mode".

   ⚠️ Enquanto este arquivo estiver vazio (apiKey: ""), o app funciona
   normalmente, mas salva os dados só no navegador local (sem sync).
   ============================================================ */

export const firebaseConfig = {
   apiKey: "AIzaSyBep2tflB2jZIJsH_zPG9fvDEpOWlg5id0",
  authDomain: "gswmind-84990.firebaseapp.com",
  projectId: "gswmind-84990",
  storageBucket: "gswmind-84990.firebasestorage.app",
  messagingSenderId: "1094850273264",
  appId: "1:1094850273264:web:f8c9e77022b7f119d60735",
};
