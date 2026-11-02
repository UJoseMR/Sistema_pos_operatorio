// ============================================================
// CONFIGURACION DE FIREBASE (version web / Vite)
// ------------------------------------------------------------
// Los valores se leen de variables de entorno (archivo .env,
// que NO se sube al repositorio). Prefijo obligatorio: VITE_
//
// Copia .env.example a .env y rellena los valores con los de
// Firebase Console > Configuracion del proyecto > Tus apps > Web.
// ============================================================

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.databaseURL) {
  console.error(
    "[Firebase] Falta VITE_FIREBASE_DATABASE_URL. Revisa el archivo web-app/.env"
  );
}
