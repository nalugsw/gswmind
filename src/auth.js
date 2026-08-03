/* ============================================================
   Autenticação do gswmind (Firebase Auth — e-mail e senha)
   ============================================================ */

import { firebaseConfig } from "./firebase-config.js";

export const cloudEnabled = Boolean(firebaseConfig && firebaseConfig.apiKey);

let authMod = null;
let authInstance = null;

async function ensureAuth() {
  if (authInstance) return;
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  authMod = await import("firebase/auth");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  authInstance = authMod.getAuth(app);
}

/** Chama cb(user | null) sempre que o estado de login mudar. Retorna função para cancelar. */
export function onAuthChange(cb) {
  if (!cloudEnabled) {
    cb(null);
    return () => {};
  }
  let unsub = () => {};
  ensureAuth().then(() => {
    unsub = authMod.onAuthStateChanged(authInstance, cb);
  });
  return () => unsub();
}

export async function signUp(email, password) {
  await ensureAuth();
  await authMod.createUserWithEmailAndPassword(authInstance, email, password);
}

export async function signIn(email, password) {
  await ensureAuth();
  await authMod.signInWithEmailAndPassword(authInstance, email, password);
}

export async function signOutUser() {
  await ensureAuth();
  await authMod.signOut(authInstance);
}

export async function resetPassword(email) {
  await ensureAuth();
  await authMod.sendPasswordResetEmail(authInstance, email);
}

/** Traduz códigos de erro comuns do Firebase Auth para mensagens em português. */
export function authErrorMessage(err) {
  const code = err && err.code;
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-password": "Digite uma senha.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Tente entrar em vez de criar conta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Não existe conta com esse e-mail. Crie uma conta primeiro.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um momento e tente de novo.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
  };
  return map[code] || "Algo deu errado. Tente novamente.";
}
