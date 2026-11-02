import { gcm } from "@noble/ciphers/aes.js";
import { getRandomBytes } from "expo-crypto";

// ============================================================
// CANAL CIFRADO ESP32 <-> APP (AES-256-GCM)
// ------------------------------------------------------------
// 1. Al abrir el WebSocket la app envia un saludo con un nonce
//    aleatorio de sesion:   {"type":"hello","nonce":"<base64>"}
// 2. El ESP32 cifra cada lectura solo para ese cliente:
//      {"iv":"<base64 12 B>","ct":"<base64 cifrado + tag 16 B>"}
//    usando el nonce de sesion como AAD. Un mensaje grabado de
//    otra sesion no pasa la verificacion del tag.
// 3. Dentro del JSON descifrado viaja "seq" (contador); la app
//    descarta cualquier mensaje con seq repetido o anterior.
//
// La clave (32 bytes en hex) se lee de EXPO_PUBLIC_ESP32_KEY y
// debe ser la misma que AES_KEY_HEX en esp32/.../secreto.h.
// ============================================================

const KEY_HEX = process.env.EXPO_PUBLIC_ESP32_KEY || "";

function hexToBytes(hex) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const KEY = hexToBytes(KEY_HEX);

if (!KEY) {
  console.error(
    "[Cifrado] Falta o es invalida EXPO_PUBLIC_ESP32_KEY (64 caracteres hex). Revisa mobile-app/.env"
  );
}

export const hasKey = !!KEY;

export class DecryptError extends Error {}
export class PlaintextError extends Error {}

// Crea el estado de una sesion: nonce aleatorio + ultimo seq aceptado.
export function createSession() {
  return { nonce: getRandomBytes(16), lastSeq: 0 };
}

export function helloMessage(session) {
  return JSON.stringify({ type: "hello", nonce: toBase64(session.nonce) });
}

// Descifra y valida un frame del ESP32. Devuelve la lectura o lanza error.
export function openFrame(session, text) {
  let frame;
  try {
    frame = JSON.parse(text);
  } catch (e) {
    throw new DecryptError("Frame no es JSON");
  }
  if (!frame || typeof frame.iv !== "string" || typeof frame.ct !== "string") {
    throw new PlaintextError("El ESP32 envio datos sin cifrar");
  }

  let plain;
  try {
    const iv = fromBase64(frame.iv);
    const ct = fromBase64(frame.ct);
    plain = gcm(KEY, iv, session.nonce).decrypt(ct);
  } catch (e) {
    throw new DecryptError("No se pudo verificar el mensaje (clave incorrecta?)");
  }

  // El JSON del ESP32 es ASCII; se evita TextDecoder (no siempre existe en Hermes).
  let json = "";
  for (let i = 0; i < plain.length; i++) json += String.fromCharCode(plain[i]);
  const data = JSON.parse(json);
  if (typeof data.seq !== "number" || data.seq <= session.lastSeq) {
    throw new DecryptError("Mensaje repetido o fuera de orden");
  }
  session.lastSeq = data.seq;
  return data;
}
