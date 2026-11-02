// ======================================================
// ESP32 + MAX30102 + MLX90614  ->  WiFi + WebSocket
// ======================================================
// Lee frecuencia cardiaca / SpO2 (MAX30102) y temperatura
// (MLX90614) y publica los datos en tiempo real mediante
// un servidor WebSocket en el puerto 81.
//
// La app movil se conecta a:  ws://<IP_DEL_ESP32>:81
//
// Los datos viajan cifrados con AES-256-GCM (mbedTLS, incluido
// en el core del ESP32). La clave va en secreto.h (copia
// secreto.h.example) y debe ser la misma que
// EXPO_PUBLIC_ESP32_KEY en mobile-app/.env.
//
// Librerias necesarias (Arduino IDE -> Gestor de librerias):
//   - "WebSockets"  de Markus Sattler (links2004/arduinoWebSockets)
//   - "SparkFun MAX3010x Pulse and Proximity Sensor Library"
//   - "Adafruit MLX90614 Library"
// ======================================================

#include <Wire.h>

// ======================================================
// WiFi + WebSocket
// ======================================================
#include <WiFi.h>
#include <WebSocketsServer.h>

// ======================================================
// CIFRADO (AES-256-GCM)
// ======================================================
#include "mbedtls/gcm.h"
#include "mbedtls/base64.h"
#include <esp_random.h>
#include "secreto.h"   // define AES_KEY_HEX

// ======================================================
// MAX30102
// ======================================================
#include "MAX30105.h"
#include "spo2_algorithm.h"
// ======================================================
// MLX90614
// ======================================================
#include <Adafruit_MLX90614.h>

// ======================================================
// CREDENCIALES DE TU RED WIFI  (EDITA ESTO)
// ======================================================
const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASS = "TU_PASSWORD";

// ======================================================
// CONFIGURACION I2C ESP32
// ======================================================
#define SDA_PIN 21
#define SCL_PIN 22

// ======================================================
// SERVIDOR WEBSOCKET
// ======================================================
WebSocketsServer webSocket = WebSocketsServer(81);

// ======================================================
// SESIONES CIFRADAS
// ------------------------------------------------------
// Cada cliente envia al conectarse un saludo con un nonce
// aleatorio de 16 bytes:  {"type":"hello","nonce":"<base64>"}
// Ese nonce se usa como AAD de AES-GCM, asi un mensaje
// grabado de otra sesion no es aceptado por la app. "seq"
// (dentro del JSON cifrado) evita repeticiones en la misma
// sesion. Solo reciben datos los clientes que saludaron.
// ======================================================
#define NONCE_LEN 16
#define IV_LEN    12
#define TAG_LEN   16

struct SesionCliente {
  bool lista;
  uint8_t nonce[NONCE_LEN];
  uint32_t seq;
};

SesionCliente sesiones[WEBSOCKETS_SERVER_CLIENT_MAX];

uint8_t claveAES[32];
mbedtls_gcm_context gcm;

// ======================================================
// OBJETOS DE LOS SENSORES
// ======================================================
MAX30105 max30102;
Adafruit_MLX90614 mlx90614 = Adafruit_MLX90614();

// ======================================================
// BUFFERS PARA MAX30102
// ======================================================

#define BUFFER_SIZE 100

// Muestras nuevas por ciclo de loop() y frecuencia efectiva del sensor
// (sampleRate 100 / sampleAverage 4 = 25 muestras por segundo).
#define MUESTRAS_NUEVAS 25
#define FRECUENCIA_PPG 25

uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

int32_t bufferLength = BUFFER_SIZE;

// ======================================================
// VARIABLES BPM Y SpO2
// ======================================================

int32_t spo2;
int8_t validSPO2;

int32_t heartRate;
int8_t validHeartRate;

// ======================================================
// DETECCION DEL DEDO
// ======================================================

const uint32_t UMBRAL_DEDO = 50000;

// ======================================================
// CIFRADO: UTILIDADES
// ======================================================

// Convierte AES_KEY_HEX (64 caracteres hex) a 32 bytes.
bool cargarClave() {
  const char* hex = AES_KEY_HEX;
  if (strlen(hex) != 64) return false;
  for (int i = 0; i < 32; i++) {
    char par[3] = { hex[i * 2], hex[i * 2 + 1], 0 };
    char* fin;
    claveAES[i] = (uint8_t)strtol(par, &fin, 16);
    if (*fin != 0) return false;
  }
  return true;
}

String aBase64(const uint8_t* datos, size_t len) {
  size_t cap = 4 * ((len + 2) / 3) + 1;
  char* buf = (char*)malloc(cap);
  if (!buf) return "";
  size_t olen = 0;
  mbedtls_base64_encode((unsigned char*)buf, cap, &olen, datos, len);
  buf[olen] = 0;
  String s(buf);
  free(buf);
  return s;
}

// Lee el nonce del saludo {"type":"hello","nonce":"<base64>"}.
bool leerSaludo(const uint8_t* payload, size_t length, uint8_t* nonce) {
  String msg = String((const char*)payload).substring(0, length);
  if (msg.indexOf("\"hello\"") < 0) return false;
  int ini = msg.indexOf("\"nonce\":\"");
  if (ini < 0) return false;
  ini += 9;
  int fin = msg.indexOf('"', ini);
  if (fin < 0) return false;
  String b64 = msg.substring(ini, fin);

  uint8_t buf[32];
  size_t olen = 0;
  int r = mbedtls_base64_decode(buf, sizeof(buf), &olen,
                                (const unsigned char*)b64.c_str(), b64.length());
  if (r != 0 || olen != NONCE_LEN) return false;
  memcpy(nonce, buf, NONCE_LEN);
  return true;
}

// Cifra la lectura para un cliente y se la envia:
//   {"iv":"<base64>","ct":"<base64 cifrado + tag>"}
void enviarCifrado(uint8_t cliente, const String& json) {
  SesionCliente& s = sesiones[cliente];
  s.seq++;

  // Se agrega el contador al inicio del JSON: {"seq":N,...}
  String plano = "{\"seq\":" + String(s.seq) + "," + json.substring(1);
  size_t n = plano.length();

  uint8_t* salida = (uint8_t*)malloc(n + TAG_LEN);  // cifrado || tag
  if (!salida) return;

  uint8_t iv[IV_LEN];
  esp_fill_random(iv, IV_LEN);  // RNG por hardware (WiFi activo)

  int r = mbedtls_gcm_crypt_and_tag(
    &gcm, MBEDTLS_GCM_ENCRYPT, n,
    iv, IV_LEN,
    s.nonce, NONCE_LEN,
    (const uint8_t*)plano.c_str(), salida,
    TAG_LEN, salida + n
  );

  if (r == 0) {
    String frame = "{\"iv\":\"" + aBase64(iv, IV_LEN) +
                   "\",\"ct\":\"" + aBase64(salida, n + TAG_LEN) + "\"}";
    webSocket.sendTXT(cliente, frame);
  } else {
    Serial.printf("[AES] Error al cifrar (%d)\n", r);
  }
  free(salida);
}

// ======================================================
// WEBSOCKET: EVENTOS
// ======================================================
void onWebSocketEvent(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      sesiones[client].lista = false;
      IPAddress ip = webSocket.remoteIP(client);
      Serial.printf("[WS] Cliente #%u conectado desde %u.%u.%u.%u\n",
                    client, ip[0], ip[1], ip[2], ip[3]);
      break;
    }
    case WStype_DISCONNECTED:
      sesiones[client].lista = false;
      Serial.printf("[WS] Cliente #%u desconectado\n", client);
      break;
    case WStype_TEXT:
      if (leerSaludo(payload, length, sesiones[client].nonce)) {
        sesiones[client].seq = 0;
        sesiones[client].lista = true;
        Serial.printf("[WS] Cliente #%u inicio sesion cifrada\n", client);
      }
      break;
    default:
      break;
  }
}

// ======================================================
// CONEXION WIFI
// ======================================================
void conectarWiFi() {
  Serial.println();
  Serial.print("Conectando a WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - inicio > 20000) {
      Serial.println();
      Serial.println("No se pudo conectar. Reintentando...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      inicio = millis();
    }
  }

  Serial.println();
  Serial.println("WiFi conectado.");
  Serial.print("IP del ESP32: ");
  Serial.println(WiFi.localIP());
  Serial.println("--> La app movil debe conectarse a:");
  Serial.print("    ws://");
  Serial.print(WiFi.localIP());
  Serial.println(":81");
}

// ======================================================
// CONSTRUIR JSON CON LOS DATOS
// ======================================================
String construirJSON(bool dedo, int32_t hr, bool hrValido,
                     int32_t sp, bool spValido,
                     float tempObjeto, float tempAmbiente,
                     uint32_t ir, uint32_t red) {
  String json = "{";
  json += "\"finger\":" + String(dedo ? "true" : "false");
  json += ",\"bpm\":" + String(hrValido ? String(hr) : String(0));
  json += ",\"spo2\":" + String(spValido ? String(sp) : String(0));
  json += ",\"validBpm\":" + String(hrValido ? "true" : "false");
  json += ",\"validSpo2\":" + String(spValido ? "true" : "false");
  json += ",\"temp\":" + String(tempObjeto, 2);
  json += ",\"tempAmb\":" + String(tempAmbiente, 2);
  json += ",\"ir\":" + String(ir);
  json += ",\"red\":" + String(red);
  json += ",\"ms\":" + String(millis());

  // Onda de pulso (PPG): las MUESTRAS_NUEVAS lecturas IR de este ciclo,
  // para que la app dibuje la senal real del sensor.
  json += ",\"fs\":" + String(FRECUENCIA_PPG);
  json += ",\"ppg\":[";
  for (int i = BUFFER_SIZE - MUESTRAS_NUEVAS; i < BUFFER_SIZE; i++) {
    if (i > BUFFER_SIZE - MUESTRAS_NUEVAS) json += ",";
    json += String(irBuffer[i]);
  }
  json += "]";

  json += "}";
  return json;
}

// ======================================================
// SETUP
// ======================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("==============================================");
  Serial.println("   ESP32 + MAX30102 + MLX90614");
  Serial.println("==============================================");
  Serial.println();

  // ====================================================
  // CARGAR CLAVE DE CIFRADO
  // ====================================================
  if (!cargarClave()) {
    Serial.println("ERROR: AES_KEY_HEX en secreto.h debe tener 64 caracteres hex.");
    while (true) {
      delay(1000);
    }
  }
  mbedtls_gcm_init(&gcm);
  mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES, claveAES, 256);
  Serial.println("Cifrado AES-256-GCM listo.");

  // ====================================================
  // CONECTAR WIFI + INICIAR WEBSOCKET
  // ====================================================
  conectarWiFi();

  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
  Serial.println("[WS] Servidor WebSocket escuchando en puerto 81.");
  Serial.println();

  // ====================================================
  // INICIAR BUS I2C
  // ====================================================

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  Serial.println("Bus I2C iniciado:");
  Serial.println("SDA -> GPIO 21");
  Serial.println("SCL -> GPIO 22");
  Serial.println();

  // ====================================================
  // INICIAR MAX30102
  // ====================================================

  Serial.println("Buscando MAX30102...");

  if (!max30102.begin(Wire, I2C_SPEED_STANDARD)) {

    Serial.println();
    Serial.println("ERROR: MAX30102 no encontrado.");
    Serial.println();
    Serial.println("Revise:");
    Serial.println("VIN -> 3.3V");
    Serial.println("GND -> GND");
    Serial.println("SDA -> GPIO 21");
    Serial.println("SCL -> GPIO 22");

    while (true) {
      delay(1000);
    }
  }

  Serial.println("MAX30102 detectado correctamente.");
  Serial.println();

  // ====================================================
  // CONFIGURAR MAX30102
  // ====================================================

  byte ledBrightness = 60;
  byte sampleAverage = 4;
  byte ledMode = 2;
  int sampleRate = 100;
  int pulseWidth = 411;
  int adcRange = 4096;

  max30102.setup(
    ledBrightness,
    sampleAverage,
    ledMode,
    sampleRate,
    pulseWidth,
    adcRange
  );

  Serial.println("MAX30102 configurado.");
  Serial.println();

  // ====================================================
  // INICIAR MLX90614
  // ====================================================

  Serial.println("Buscando MLX90614...");

  if (!mlx90614.begin(0x5A, &Wire)) {

    Serial.println();
    Serial.println("ERROR: MLX90614 no encontrado.");
    Serial.println();
    Serial.println("Revise:");
    Serial.println("VIN -> 3.3V");
    Serial.println("GND -> GND");
    Serial.println("SDA -> GPIO 21");
    Serial.println("SCL -> GPIO 22");

    while (true) {
      delay(1000);
    }
  }

  Serial.println("MLX90614 detectado correctamente.");
  Serial.println();

  // ====================================================
  // LLENAR BUFFER INICIAL
  // ====================================================

  Serial.println("Coloque el dedo en el MAX30102.");
  Serial.println("Llenando buffer inicial...");

  for (int i = 0; i < BUFFER_SIZE; i++) {
    while (!max30102.available()) {
      max30102.check();
      webSocket.loop();
    }
    redBuffer[i] = max30102.getRed();
    irBuffer[i] = max30102.getIR();
    max30102.nextSample();
  }

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, bufferLength, redBuffer,
    &spo2, &validSPO2, &heartRate, &validHeartRate
  );

  Serial.println("Medicion inicial completada.");
  Serial.println();
}

// ======================================================
// LOOP
// ======================================================

void loop() {

  // ====================================================
  // MANTENER WIFI Y WEBSOCKET
  // ====================================================
  webSocket.loop();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdido. Reconectando...");
    conectarWiFi();
  }

  // ====================================================
  // CONSERVAR LAS ULTIMAS 75 MUESTRAS
  // ====================================================

  for (int i = MUESTRAS_NUEVAS; i < BUFFER_SIZE; i++) {
    redBuffer[i - MUESTRAS_NUEVAS] = redBuffer[i];
    irBuffer[i - MUESTRAS_NUEVAS] = irBuffer[i];
  }

  // ====================================================
  // OBTENER 25 NUEVAS MUESTRAS
  // ====================================================

  for (int i = BUFFER_SIZE - MUESTRAS_NUEVAS; i < BUFFER_SIZE; i++) {
    while (!max30102.available()) {
      max30102.check();
      webSocket.loop();
    }
    redBuffer[i] = max30102.getRed();
    irBuffer[i] = max30102.getIR();
    max30102.nextSample();
  }

  // ====================================================
  // DATOS
  // ====================================================

  uint32_t valorIR = irBuffer[BUFFER_SIZE - 1];
  uint32_t valorRojo = redBuffer[BUFFER_SIZE - 1];

  bool dedoDetectado = (valorIR > UMBRAL_DEDO);

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, bufferLength, redBuffer,
    &spo2, &validSPO2, &heartRate, &validHeartRate
  );

  float temperaturaAmbiente = mlx90614.readAmbientTempC();
  float temperaturaObjeto = mlx90614.readObjectTempC();

  bool hrValido = (validHeartRate == 1 && heartRate >= 30 && heartRate <= 220);
  bool spValido = (validSPO2 == 1 && spo2 > 0 && spo2 <= 100);

  // ====================================================
  // MOSTRAR RESULTADOS
  // ====================================================

  Serial.println();
  Serial.println("==============================================");
  Serial.println("             DATOS DEL PACIENTE");
  Serial.println("==============================================");

  Serial.print("Temperatura objeto : ");
  Serial.print(temperaturaObjeto, 2);
  Serial.println(" C");

  Serial.print("Temperatura ambiente: ");
  Serial.print(temperaturaAmbiente, 2);
  Serial.println(" C");

  Serial.println("----------------------------------------------");
  Serial.print("IR   : ");
  Serial.println(valorIR);
  Serial.print("ROJO : ");
  Serial.println(valorRojo);
  Serial.println("----------------------------------------------");

  if (!dedoDetectado) {
    Serial.println("Dedo : NO DETECTADO");
    Serial.println("BPM  : --");
    Serial.println("SpO2 : --");
  } else {
    Serial.println("Dedo : DETECTADO");
    if (hrValido) {
      Serial.print("BPM  : ");
      Serial.print(heartRate);
      Serial.println(" lat/min");
    } else {
      Serial.println("BPM  : Calculando...");
    }
    if (spValido) {
      Serial.print("SpO2 : ");
      Serial.print(spo2);
      Serial.println(" %");
    } else {
      Serial.println("SpO2 : Calculando...");
    }
  }
  Serial.println("==============================================");

  // ====================================================
  // ENVIAR CIFRADO A CADA CLIENTE CON SESION
  // ====================================================

  String json = construirJSON(
    dedoDetectado,
    heartRate, hrValido && dedoDetectado,
    spo2, spValido && dedoDetectado,
    temperaturaObjeto, temperaturaAmbiente,
    valorIR, valorRojo
  );

  for (uint8_t c = 0; c < WEBSOCKETS_SERVER_CLIENT_MAX; c++) {
    if (sesiones[c].lista) enviarCifrado(c, json);
  }
}
