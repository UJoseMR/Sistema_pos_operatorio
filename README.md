# Sistema Post-Operatorio — ESP32 + MAX30102 + MLX90614

Monitoreo de signos vitales (frecuencia cardiaca, SpO2 y temperatura) con:

- **ESP32** que lee los sensores y publica los datos por **WebSocket**.
- **App móvil** (React Native / Expo) que muestra los datos en vivo y los guarda en **Firebase Realtime Database**.
- **App web** (React / Vite) que muestra el **historial** y permite activar el **modo tiempo real** (1 lectura/segundo).

---

## Arquitectura / Flujo

```
                 WiFi (misma red)
   ┌──────────┐   WebSocket    ┌────────────────────┐
   │  ESP32   │ ─────────────▶ │  App móvil (Expo)  │
   │ sensores │  ws://IP:81    │  muestra en vivo   │
   └──────────┘                └─────────┬──────────┘
                                         │ escribe
                        cada 30 s ───────┤
                        cada 1 s (*)  ───┤
                                         ▼
                            ┌──────────────────────────┐
                            │ Firebase Realtime DB     │
                            │  /readings   (historial) │
                            │  /live       (1 s)       │
                            │  /streamMode (bandera)   │
                            └────────────┬─────────────┘
                                         │ lee / se suscribe
                                         ▼
                            ┌──────────────────────────┐
                            │  App web (React)         │
                            │  historial + tiempo real │
                            └──────────────────────────┘
   (*) solo cuando la web activa /streamMode = true
```

1. La app móvil se conecta por WebSocket al ESP32 (`ws://IP:81`) y muestra BPM, SpO2 y temperatura en vivo.
2. En paralelo guarda en Firebase:
   - `/readings` → **cada 30 s** (siempre).
   - `/live` → **cada 1 s** (solo si `/streamMode == true`).
3. La app web muestra `/readings` (historial) y, al activar el interruptor, escribe `/streamMode = true`.
4. La app móvil escucha `/streamMode` y cambia su frecuencia a 1 s automáticamente.
5. Al desactivar el interruptor, la web escribe `/streamMode = false` y la app móvil vuelve a 30 s.

---

## Estructura del proyecto

```
sistema_pos_operatorio/
├─ esp32/
│  └─ esp32_sensores/
│     └─ esp32_sensores.ino     # Firmware (WiFi + WebSocket)
├─ mobile-app/                  # App móvil Expo
│  ├─ App.js
│  └─ src/
│     ├─ lib/                   # useEsp32, useFirebaseSync, firebase
│     ├─ components/
│     └─ screens/
└─ web-app/                     # App web React (Vite)
   └─ src/
      ├─ lib/                   # firebase, firebaseConfig
      ├─ components/
      └─ App.jsx
```

---

## 1. Firebase (hacer primero)

1. Entra a <https://console.firebase.google.com> y crea un proyecto.
2. **Build > Realtime Database > Crear base de datos** (elige "modo de prueba" para desarrollo).
3. **Configuración del proyecto > Tus apps > Web (`</>`)** y copia los valores de `firebaseConfig`.
4. Crea los archivos `.env` (copiando los `.env.example` incluidos) y pega ahí los valores.
   Estos archivos están en `.gitignore` y **no** se suben al repositorio:

   `web-app/.env`  (prefijo `VITE_`)
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_DATABASE_URL=https://TU_PROYECTO-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

   `mobile-app/.env`  (prefijo `EXPO_PUBLIC_`)
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://TU_PROYECTO-default-rtdb.firebaseio.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```

   > Ambos apuntan al **mismo** proyecto de Firebase. Los valores solo se leen en
   > `src/lib/firebaseConfig.js` de cada app. Tras editar `.env`, reinicia:
   > web `npm run dev` y móvil `npx expo start -c`.

### Modelo de datos

```
/readings/{autoId}   { timestamp, finger, bpm, spo2, temp, tempAmb }   (cada 30 s)
/live                { timestamp, finger, bpm, spo2, temp, tempAmb }   (cada 1 s)
/streamMode          true | false                                       (bandera web <-> móvil)
```

### Reglas de seguridad (SOLO desarrollo)

En **Realtime Database > Reglas**, pega:

```json
{
  "rules": {
    "readings":   { ".read": true, ".write": true },
    "live":       { ".read": true, ".write": true },
    "streamMode": { ".read": true, ".write": true }
  }
}
```

> Para producción agrega autenticación (Firebase Auth) y restringe lectura/escritura por usuario.
> Estas reglas abiertas permiten que cualquiera lea y escriba.

---

## 2. ESP32

1. Abre `esp32/esp32_sensores/esp32_sensores.ino` en el **Arduino IDE** (con soporte de ESP32).
2. Instala las librerías (**Herramientas > Administrar bibliotecas**):
   - `WebSockets` de Markus Sattler (links2004/arduinoWebSockets)
   - `MAX30105` (SparkFun)
   - `Adafruit MLX90614`
3. Edita las credenciales WiFi al inicio del archivo:

```cpp
const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASS = "TU_PASSWORD";
```

4. Compila y sube. Abre el **Monitor Serie (115200 baudios)**.
5. Anota la IP que aparece:

```
IP del ESP32: 192.168.1.50
--> La app movil debe conectarse a:
    ws://192.168.1.50:81
```

> El ESP32 y el teléfono/PC deben estar en la **misma red WiFi**.

---

## 3. App móvil (Expo)

> El proyecto usa **Expo SDK 57**. Tu app **Expo Go** debe ser de la SDK 57
> (o actualízala desde la Play Store / App Store). Si tu Expo Go es más nuevo
> (p. ej. SDK 58), tendrás que subir el proyecto con
> `npm install expo@latest` y `npx expo install --fix`.

```bash
cd mobile-app
npm install
npx expo start
```

- Escanea el QR con **Expo Go** (Android/iOS).
- En la app, toca **Configuración**, escribe la **IP del ESP32** (ej. `192.168.1.50`) y guarda.
- Vuelve al monitor: verás BPM, SpO2 y temperatura en vivo.
- El estado "Tiempo real (web)" indica si la web activó el modo rápido.

> **Nota Android (build de producción):** `ws://` es tráfico en claro. En Expo Go funciona;
> para APK/AAB agrega el plugin `expo-build-properties` con `android.usesCleartextTraffic: true`
> o usa `wss://`.

---

## 4. App web (React + Vite)

```bash
cd web-app
npm install
npm run dev
```

Abre <http://localhost:5173>.

- **Historial**: tabla de los últimos 200 registros de `/readings`.
- **Interruptor "Tiempo real"**: al activarlo escribe `/streamMode = true`, se suscribe a `/live`
  y muestra las lecturas cada segundo + una gráfica de BPM. Al desactivarlo, `/streamMode = false`.

---

## Notas

- La app móvil guarda el historial **cada 30 s** de forma independiente al modo tiempo real.
- El modo tiempo real **solo** afecta a la frecuencia de escritura hacia `/live`.
- La app web registra un `onDisconnect()` de Firebase: si la pestaña se cierra o
  pierde conexion, `/streamMode` se pone automaticamente en `false` y la app movil
  vuelve a guardar cada 30 s.
