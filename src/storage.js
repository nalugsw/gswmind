/* ============================================================
   Armazenamento do gswmind
   - Se o Firebase estiver configurado: salva na nuvem, isolado por
     usuário logado, e sincroniza em tempo real entre aparelhos.
   - Se não: salva no localStorage do navegador (funciona offline,
     mas cada aparelho tem seus próprios dados).
   ============================================================ */

import { firebaseConfig } from "./firebase-config.js";

export const cloudEnabled = Boolean(firebaseConfig && firebaseConfig.apiKey);

const LOCAL_KEY = "gswmind-v1";

let fs = null;
let dbInstance = null;

async function ensureDb() {
  if (dbInstance) return;
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  fs = await import("firebase/firestore");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  dbInstance = fs.getFirestore(app);
}

function docFor(uid) {
  return fs.doc(dbInstance, "users", uid, "gswmind", "data");
}

/** Carrega os dados salvos do usuário (ou null se ainda não existir nada). */
export async function loadData(uid) {
  if (cloudEnabled) {
    await ensureDb();
    const snap = await fs.getDoc(docFor(uid));
    if (snap.exists() && snap.data().json) {
      return JSON.parse(snap.data().json);
    }
    return null;
  }
  const raw = localStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Salva os dados do usuário. Retorna o JSON salvo (lança erro se falhar). */
export async function saveData(uid, data) {
  const json = JSON.stringify(data);
  if (cloudEnabled) {
    await ensureDb();
    await fs.setDoc(docFor(uid), { json, updatedAt: Date.now() });
    return json;
  }
  localStorage.setItem(LOCAL_KEY, json);
  return json;
}

/**
 * Escuta mudanças vindas de OUTROS aparelhos em tempo real, para este usuário.
 * cb recebe (data, json). Retorna função para cancelar a escuta.
 * Sem Firebase, não faz nada.
 */
export function subscribe(uid, cb) {
  if (!cloudEnabled) return () => {};
  let unsub = () => {};
  ensureDb().then(() => {
    unsub = fs.onSnapshot(docFor(uid), (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.exists() && snap.data().json) {
        cb(JSON.parse(snap.data().json), snap.data().json);
      }
    });
  });
  return () => unsub();
}
