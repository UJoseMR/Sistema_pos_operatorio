// ======================================================
// ESP32 + MAX30102 + MLX90614  ->  WiFi + WebSocket
// ======================================================
// Lee frecuencia cardiaca / SpO2 (MAX30102) y temperatura
// (MLX90614) y publica los datos en tiempo real mediante
// un servidor WebSocket en el puerto 81.
//
// La app movil se conecta a:  ws://<IP_DEL_ESP32>:81
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
// OBJETOS DE LOS SENSORES
// ======================================================
MAX30105 max30102;
Adafruit_MLX90614 mlx90614 = Adafruit_MLX90614();

// ======================================================
// BUFFERS PARA MAX30102
// ======================================================

#define BUFFER_SIZE 100

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
// WEBSOCKET: EVENTOS
// ======================================================
void onWebSocketEvent(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(client);
      Serial.printf("[WS] Cliente #%u conectado desde %u.%u.%u.%u\n",
                    client, ip[0], ip[1], ip[2], ip[3]);
      break;
    }
    case WStype_DISCONNECTED:
      Serial.printf("[WS] Cliente #%u desconectado\n", client);
      break;
    case WStype_TEXT:
      // La app movil puede enviar un "ping" simple; no hace falta responder.
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

  for (int i = 25; i < BUFFER_SIZE; i++) {
    redBuffer[i - 25] = redBuffer[i];
    irBuffer[i - 25] = irBuffer[i];
  }

  // ====================================================
  // OBTENER 25 NUEVAS MUESTRAS
  // ====================================================

  for (int i = 75; i < BUFFER_SIZE; i++) {
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
  // DIFUNDIR POR WEBSOCKET
  // ====================================================

  String json = construirJSON(
    dedoDetectado,
    heartRate, hrValido && dedoDetectado,
    spo2, spValido && dedoDetectado,
    temperaturaObjeto, temperaturaAmbiente,
    valorIR, valorRojo
  );

  webSocket.broadcastTXT(json);
}
