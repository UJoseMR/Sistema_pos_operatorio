// ============================================================
// CONFIGURACION DE FIREBASE (app movil / Expo)
// ------------------------------------------------------------
// Expo carga automaticamente el archivo .env.
// Las variables DEBEN llevar el prefijo EXPO_PUBLIC_ para estar
// disponibles en el codigo de la app via process.env.
//
// Copia mobile-app/.env.example a mobile-app/.env y rellena los
// valores con los de Firebase (mismo proyecto que la web).
//
// IMPORTANTE: databaseURL es obligatorio para Realtime Database.
// ============================================================

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.databaseURL) {
  console.error(
    "[Firebase] Falta EXPO_PUBLIC_FIREBASE_DATABASE_URL. Revisa el archivo mobile-app/.env"
  );
}
