/**
 * =============================================================
 * SIPADAM - ESP32 SENSOR HUB (KODE FINAL v4 - RATE FIX)
 * =============================================================
 * * PERBAIKAN: Cache rate variables sekarang benar
 * */

// --- Library ---
#include <WiFi.h>
#include <DHTesp.h>
#include <math.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <TinyGPSPlus.h> // Tambah: Library GPS

// --- WiFi Credentials ---
const char* ssid = "lelejumbo";
const char* password = "12345678";

// --- Web Server ---
WebServer server(80);

// --- Sensor Pins ---
TinyGPSPlus gps;
HardwareSerial gpsSerial(2); // Gunakan UART2 untuk GPS
#define DHT_PIN 21
#define MQ2_ANALOG_PIN 35
#define LARGE_FIRE_LED 32
#define MEDIUM_FIRE_LED 26
#define SMALL_FIRE_LED 25
#define BUZZER_PIN 18 // Tambah: Pin untuk Buzzer SFM-27

// --- GPS Constants ---
#define GPS_RX_PIN 16 // Connect to NEO-6M TX
#define GPS_TX_PIN 17 // Connect to NEO-6M RX
#define GPS_BAUD_RATE 9600
#define GPS_FIX_TIMEOUT 120000  // 2 menit timeout untuk dapat fix

DHTesp dht;

// --- Variabel Deteksi Webcam ---
float webcamFireArea = 0;
float webcamConfidence = 0;

// --- Variabel Blinking ---
unsigned long previousBlinkTimeLarge = 0;
unsigned long previousBlinkTimeMedium = 0;
unsigned long previousBlinkTimeSmall = 0;

const unsigned long BLINK_INTERVAL_LARGE = 100;
const unsigned long BLINK_INTERVAL_MEDIUM = 300;
const unsigned long BLINK_INTERVAL_SMALL = 600;

bool ledSmallState = false;
bool ledLargeState = false;
bool ledMediumState = false;
bool shouldBlinkLarge = false;
bool shouldBlinkMedium = false;
bool shouldBlinkSmall = false;
bool buzzerActive = false;

// --- MQ-2 Constants ---
#define RL_VALUE 10
#define RO_CLEAN_AIR_FACTOR 9.83
#define CALIBARAION_SAMPLE_TIMES 50
#define CALIBRATION_SAMPLE_INTERVAL 500
#define READ_SAMPLE_INTERVAL 50
#define READ_SAMPLE_TIMES 5

#define GAS_LPG   0
#define GAS_CO    1
#define GAS_SMOKE 2

float LPGCurve[3] = { 2.3, 0.21, -0.47 };
float COCurve[3] = { 2.3, 0.72, -0.34 };
float SmokeCurve[3] = { 2.3, 0.53, -0.44 };

float Ro = 10.2;

// --- EEPROM ---
#include <Preferences.h>
Preferences preferences;

// --- Moving Average ---
static float last_smoke_ppm = 0;
static float last_co_ppm = 0;

// --- Rate of Change Detection ---
static float lastTemp = 0;
static float lastSmoke = 0;
static float lastCO = 0;
static unsigned long lastChangeTime = 0;

// --- Temporal Confidence ---
static unsigned long fireConfirmStart = 0;
static String lastRiskLevel = "NORMAL";
const unsigned long CRITICAL_CONFIRM_TIME = 0;  // 1 detik
const unsigned long HIGH_CONFIRM_TIME = 0;      // 2 detik
const unsigned long MEDIUM_CONFIRM_TIME = 0;    // 3 detik
const unsigned long SMALL_CONFIRM_TIME = 0;        // Langsung

// --- Hysteresis Thresholds ---
const float CRITICAL_UP = 0.92;
const float CRITICAL_DOWN = 0.85;
const float HIGH_UP = 0.72;
const float HIGH_DOWN = 0.65;
const float MEDIUM_UP = 0.42;
const float MEDIUM_DOWN = 0.35;

// --- Watchdog ---
#include <esp_task_wdt.h>
#define WDT_TIMEOUT 30

// --- Thresholds ---
const float TEMP_THRESHOLD_LARGE = 60.0;
const float TEMP_THRESHOLD_MEDIUM = 50.0;
const float TEMP_THRESHOLD_SMALL = 40.0;
const float HUMIDITY_THRESHOLD_LARGE = 10.0;
const float HUMIDITY_THRESHOLD_MEDIUM = 15.0;
const float HUMIDITY_THRESHOLD_SMALL = 20.0;
const int SMOKE_PPM_THRESHOLD_LARGE = 1500;
const int SMOKE_PPM_THRESHOLD_MEDIUM = 800;
const int SMOKE_PPM_THRESHOLD_SMALL = 400;
const int SMOKE_PPM_BASE = 100;
const int CO_PPM_THRESHOLD_LARGE = 600;
const int CO_PPM_THRESHOLD_MEDIUM = 300;
const int CO_PPM_THRESHOLD_SMALL = 100;
const int CO_PPM_BASE = 50;

// --- Cache Data Sensor ---
float cachedTemperature = -999;
float cachedHumidity = -999;
float cached_smoke_ppm = 0;
float cached_lpg_ppm = 0;
float cached_co_ppm = 0;
bool cachedDhtValid = false;
String currentRiskLevel = "NORMAL";
float currentRiskScore = 0;

// ✅ PERBAIKAN: Ganti nama variabel dengan prefix 'cached'
float cachedTempRate = 0;
float cachedSmokeRate = 0;
float cachedCoRate = 0;

// ===== FIXED GPS MODE =====
float fixedLatitude = 0.0;
float fixedLongitude = 0.0;
bool gpsFixed = false;
bool gpsReadAttempted = false;

// --- Timer ---
unsigned long previousSensorReadTime = 0;
const unsigned long SENSOR_READ_INTERVAL = 2000;

// --- Function Prototypes ---
void initializeHardware();
void testLEDBlinking();
void connectToWiFi();
void setupWebServer();
void handleApiData();
void handleFireDetection();
void updateSensorReadings();
void getFixedGPSLocation(); // Fungsi untuk baca GPS sekali
void updateLEDBlinking();
String calculateRiskLevelWithHysteresis(float score, String prevLevel);
String applyTemporalConfidence(String detectedLevel);
float calculateRiskScore(float temp, float humidity, float smoke_ppm, float co_ppm, bool dhtValid);
void controlLEDBlinking(String riskLevel);
void controlBuzzer(String riskLevel); // Tambah
float mapFloat(float x, float in_min, float in_max, float out_min, float out_max);
float MQResistanceCalculation(int raw_adc);
float MQCalibration(int mq_pin);
float MQRead(int mq_pin);
float MQGetGasPercentage(float rs_ro_ratio, int gas_id);
float MQGetPercentage(float rs_ro_ratio, float* pcurve);

void setup() {
  Serial.begin(115200);

  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);

  initializeHardware();
  connectToWiFi();
  setupWebServer();

  Serial.println("✅ Sistem SIPADAM v4 (Rate Fix) telah dimulai!");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("📡 Sistem berjalan di IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("📡 Cek API data di: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/api/data");
  }
}

void loop() {
  esp_task_wdt_reset();
  server.handleClient();
  updateSensorReadings();
  updateLEDBlinking();
}

void initializeHardware() {
  dht.setup(DHT_PIN, DHTesp::DHT22);
  pinMode(SMALL_FIRE_LED, OUTPUT);
  pinMode(LARGE_FIRE_LED, OUTPUT);
  pinMode(MEDIUM_FIRE_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT); // Tambah: Inisialisasi pin Buzzer

  analogReadResolution(12);
  analogSetPinAttenuation(MQ2_ANALOG_PIN, ADC_11db);

  // Tambah: Inisialisasi Serial GPS
  gpsSerial.begin(GPS_BAUD_RATE, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN); 
  Serial.println("📡 GPS Neo-6M initialized on UART2.");

  Serial.println("💡 Testing LED Blinking...");
  testLEDBlinking();

  preferences.begin("sipadam", false);
  Ro = preferences.getFloat("ro_value", 0);
  
  if (Ro == 0 || Ro > 50) {
    Serial.println("🔧 Calibrating MQ-2...");
    Ro = MQCalibration(MQ2_ANALOG_PIN);
    preferences.putFloat("ro_value", Ro);
    Serial.println("✅ Calibration done and saved.");
  } else {
    Serial.println("✅ Loaded Ro from EEPROM.");
  }
  
  Serial.print("Ro = ");
  Serial.print(Ro);
  Serial.println(" kΩ\n");
  preferences.end();

  // ===== CEK GPS TERSIMPAN DI EEPROM =====
  fixedLatitude = preferences.getFloat("gps_lat", 0.0);
  fixedLongitude = preferences.getFloat("gps_lng", 0.0);

  if (fixedLatitude != 0.0 && fixedLongitude != 0.0) {
    gpsFixed = true;
    Serial.println("✅ GPS location loaded from EEPROM:");
    Serial.print("   Latitude: "); Serial.println(fixedLatitude, 6);
    Serial.print("   Longitude: "); Serial.println(fixedLongitude, 6);
  } else {
    Serial.println("⚠️ No GPS location saved. Attempting to get GPS fix...");
    getFixedGPSLocation();
  }

  preferences.end();
}

void testLEDBlinking() {
  for (int i = 0; i < 6; i++) {
    digitalWrite(LARGE_FIRE_LED, !digitalRead(LARGE_FIRE_LED));
    digitalWrite(MEDIUM_FIRE_LED, !digitalRead(MEDIUM_FIRE_LED));
    digitalWrite(SMALL_FIRE_LED, !digitalRead(SMALL_FIRE_LED));
    delay(150);
  }
  digitalWrite(LARGE_FIRE_LED, LOW);
  digitalWrite(MEDIUM_FIRE_LED, LOW);
  digitalWrite(SMALL_FIRE_LED, LOW);
  // Tambah: Tes Buzzer
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  delay(100);
  Serial.println("✅ LED & Buzzer test complete");
}

void connectToWiFi() {
  Serial.println();
  Serial.println("📶 Connecting to WiFi: " + String(ssid));
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.println("📱 IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n❌ WiFi failed! Standalone mode.");
  }
}

void setupWebServer() {
  server.on("/api/data", HTTP_GET, handleApiData);
  server.on("/api/fire", HTTP_POST, handleFireDetection);
  server.on("/", HTTP_GET, []() {
    server.send(200, "text/plain", "ESP32 SIPADAM Online!");
  });

  server.on("/api/calibrate", HTTP_POST, []() {
    Serial.println("🔧 Manual calibration...");
    Ro = MQCalibration(MQ2_ANALOG_PIN);
    preferences.begin("sipadam", false);
    preferences.putFloat("ro_value", Ro);
    preferences.end();
    
    String response = "{\"status\":\"OK\",\"ro\":" + String(Ro, 2) + "}";
    server.send(200, "application/json", response);
  });

  server.on("/api/set_gps", HTTP_POST, []() {
    if (server.hasArg("lat") && server.hasArg("lng")) {
      float newLat = server.arg("lat").toFloat();
      float newLng = server.arg("lng").toFloat();

      if (newLat >= -90 && newLat <= 90 && newLng >= -180 && newLng <= 180) {
        fixedLatitude = newLat;
        fixedLongitude = newLng;
        gpsFixed = true;

        preferences.begin("sipadam", false);
        preferences.putFloat("gps_lat", fixedLatitude);
        preferences.putFloat("gps_lng", fixedLongitude);
        preferences.end();

        String response = "{\"status\":\"OK\",\"latitude\":" + String(fixedLatitude, 6) + 
                         ",\"longitude\":" + String(fixedLongitude, 6) + "}";
        server.send(200, "application/json", response);

        Serial.println("📍 GPS location updated manually");
      } else {
        server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Invalid coordinates\"}");
      }
    } else {
      server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Missing parameters\"}");
    }
  });

  server.on("/api/reset", HTTP_POST, []() {
    server.send(200, "text/plain", "Rebooting...");
    delay(500);
    ESP.restart();
  });

  server.begin();
  Serial.println("🌐 HTTP server started");
}

void handleApiData() {
  StaticJsonDocument<512> doc;

  doc["temperature"] = cachedTemperature;
  doc["humidity"] = cachedHumidity;
  doc["smoke_ppm"] = cached_smoke_ppm;
  doc["lpg_ppm"] = cached_lpg_ppm;
  doc["co_ppm"] = cached_co_ppm;
  doc["riskLevel"] = currentRiskLevel;
  doc["riskScore"] = currentRiskScore;
  doc["timestamp"] = millis();
  doc["calibration_ro"] = Ro;
  doc["webcam_area"] = webcamFireArea;
  doc["webcam_confidence"] = webcamConfidence;

  // Tambah: Data GPS
  doc["latitude"] = fixedLatitude;
  doc["longitude"] = fixedLongitude;
  doc["gpsValid"] = gpsFixed;
  doc["gpsSource"] = gpsFixed ? "fixed" : "default";
  
  // ✅ PERBAIKAN: Pakai cached variables
  doc["tempRate"] = cachedTempRate;
  doc["smokeRate"] = cachedSmokeRate;
  doc["coRate"] = cachedCoRate;

  doc["ledLarge"] = digitalRead(LARGE_FIRE_LED);
  doc["ledMedium"] = digitalRead(MEDIUM_FIRE_LED);
  doc["ledSmall"] = digitalRead(SMALL_FIRE_LED);
  doc["blinkingLarge"] = shouldBlinkLarge;
  doc["blinkingMedium"] = shouldBlinkMedium;
  doc["blinkingSmall"] = shouldBlinkSmall;
  
  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

void handleFireDetection() {
  if (server.hasArg("fire_area")) {
    webcamFireArea = server.arg("fire_area").toFloat();
    
    if (server.hasArg("confidence")) {
      webcamConfidence = server.arg("confidence").toFloat();
    }
    
    Serial.print("📸 Webcam: Area=");
    Serial.print(webcamFireArea);
    Serial.print("px, Conf=");
    Serial.println(webcamConfidence);
    
    previousSensorReadTime = 0;
    server.send(200, "text/plain", "OK");
  } else {
    server.send(400, "text/plain", "Missing fire_area");
  }
}

void updateSensorReadings() {
  unsigned long currentTime = millis();

  if (currentTime - previousSensorReadTime >= SENSOR_READ_INTERVAL) {
    previousSensorReadTime = currentTime;

    // 1. Baca DHT22
    TempAndHumidity dhtValues = dht.getTempAndHumidity();
    cachedDhtValid = (dht.getStatus() == DHTesp::ERROR_NONE);
    cachedTemperature = cachedDhtValid ? dhtValues.temperature : -999;
    cachedHumidity = cachedDhtValid ? dhtValues.humidity : -999;

    // 2. Baca MQ-2
    float rs = MQRead(MQ2_ANALOG_PIN);
    float ratio = rs / Ro;
    cached_lpg_ppm = MQGetGasPercentage(ratio, GAS_LPG);
    
    // Moving Average untuk CO
    float raw_co_ppm = MQGetGasPercentage(ratio, GAS_CO);
    if (last_co_ppm == 0) last_co_ppm = raw_co_ppm;
    cached_co_ppm = (last_co_ppm * 0.7) + (raw_co_ppm * 0.3);
    last_co_ppm = cached_co_ppm;
    
    // Moving Average untuk Smoke
    float raw_smoke_ppm = MQGetGasPercentage(ratio, GAS_SMOKE);
    if (last_smoke_ppm == 0) last_smoke_ppm = raw_smoke_ppm;
    cached_smoke_ppm = (last_smoke_ppm * 0.7) + (raw_smoke_ppm * 0.3);
    last_smoke_ppm = cached_smoke_ppm;

    // ✅ PERBAIKAN: Rate of Change - LANGSUNG ke cached variables
    cachedTempRate = 0;
    cachedSmokeRate = 0;
    cachedCoRate = 0;
    
    if (lastChangeTime > 0) {
      float deltaTime = (currentTime - lastChangeTime) / 1000.0;
      if (deltaTime > 0) {
        cachedTempRate = (cachedTemperature - lastTemp) / deltaTime;
        cachedSmokeRate = (cached_smoke_ppm - lastSmoke) / deltaTime;
        cachedCoRate = (cached_co_ppm - lastCO) / deltaTime;
      }
    }
    
    lastTemp = cachedTemperature;
    lastSmoke = cached_smoke_ppm;
    lastCO = cached_co_ppm;
    lastChangeTime = currentTime;
    
    bool rapidChange = (cachedTempRate > 2.0 || cachedSmokeRate > 100) || cachedCoRate > 100;

    // 3. Hitung Risk Level
    float rawRiskScore = calculateRiskScore(cachedTemperature, cachedHumidity, cached_smoke_ppm, cached_co_ppm, cachedDhtValid);
    if (rapidChange) {
      rawRiskScore = min(1.0f, rawRiskScore + 0.2f);
    }
    currentRiskScore = rawRiskScore;
    currentRiskLevel = calculateRiskLevelWithHysteresis(rawRiskScore, lastRiskLevel);
    currentRiskLevel = applyTemporalConfidence(currentRiskLevel);
    lastRiskLevel = currentRiskLevel;

    // 4. Update LED
    controlLEDBlinking(currentRiskLevel);
    controlBuzzer(currentRiskLevel); // Tambah: Kontrol Buzzer
    
    // 5. Serial Output
    Serial.println("\n--- [ Sensor Update ] ---");
    Serial.print("DHT Valid: "); Serial.println(cachedDhtValid ? "YES" : "NO");
    Serial.print("Temperature: "); Serial.print(cachedTemperature); Serial.println(" °C");
    Serial.print("Humidity: "); Serial.print(cachedHumidity); Serial.println(" %");
    Serial.print("Smoke PPM: "); Serial.println(cached_smoke_ppm);
    Serial.print("CO PPM: "); Serial.println(cached_co_ppm);
    Serial.print("Risk Level: "); Serial.println(currentRiskLevel);
    Serial.print("Risk Score: "); Serial.println(currentRiskScore);
    Serial.print("Temp Rate: "); Serial.print(cachedTempRate, 2); Serial.println(" °C/s");
    Serial.print("Smoke Rate: "); Serial.print(cachedSmokeRate, 2); Serial.println(" ppm/s");
    Serial.print("CO Rate: "); Serial.print(cachedCoRate, 2); Serial.println(" ppm/s");
    Serial.print("Buzzer Active: "); Serial.println(buzzerActive ? "YES" : "NO");
Serial.print("Buzzer Pin State: "); Serial.println(digitalRead(BUZZER_PIN) ? "HIGH" : "LOW");
    Serial.println("-------------------------");
  }
}

void updateLEDBlinking() {
  unsigned long currentTime = millis();

  // LED LARGE (CRITICAL) - Kedip cepat
  if (shouldBlinkLarge && currentTime - previousBlinkTimeLarge >= BLINK_INTERVAL_LARGE) {
    previousBlinkTimeLarge = currentTime;
    ledLargeState = !ledLargeState;
    digitalWrite(LARGE_FIRE_LED, ledLargeState);
  }

  // LED MEDIUM (HIGH) - Kedip sedang
  if (shouldBlinkMedium && currentTime - previousBlinkTimeMedium >= BLINK_INTERVAL_MEDIUM) {
    previousBlinkTimeMedium = currentTime;
    ledMediumState = !ledMediumState;
    digitalWrite(MEDIUM_FIRE_LED, ledMediumState);
  }

  // LED SMALL (MEDIUM) - Kedip lambat
  if (shouldBlinkSmall && currentTime - previousBlinkTimeSmall >= BLINK_INTERVAL_SMALL) {
    previousBlinkTimeSmall = currentTime;
    ledSmallState = !ledSmallState;
    digitalWrite(SMALL_FIRE_LED, ledSmallState);
  }
  
  // ✅ BUZZER LOGIC - Ikuti kedipan LED yang aktif
  if (buzzerActive) {
    if (shouldBlinkLarge) {
      // Buzzer ikuti LED LARGE (kedip cepat)
      digitalWrite(BUZZER_PIN, ledLargeState ? HIGH : LOW);
    } else if (shouldBlinkMedium) {
      // Buzzer ikuti LED MEDIUM (kedip sedang)
      digitalWrite(BUZZER_PIN, ledMediumState ? HIGH : LOW);
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void getFixedGPSLocation() {
  Serial.println("\n🛰️ Waiting for GPS fix...");
  Serial.println("   (This may take 30-120 seconds for cold start)");
  Serial.println("   Make sure GPS module has clear view of sky!");
  
  unsigned long startTime = millis();
  bool gotFix = false;
  int dotCount = 0;
  
  while (millis() - startTime < GPS_FIX_TIMEOUT) {
    esp_task_wdt_reset();
    
    while (gpsSerial.available() > 0) {
      if (gps.encode(gpsSerial.read())) {
        if (gps.location.isValid() && gps.location.lat() != 0.0 && gps.location.lng() != 0.0) {
          fixedLatitude = gps.location.lat();
          fixedLongitude = gps.location.lng();
          gpsFixed = true;
          gotFix = true;
          
          Serial.println("\n✅ GPS FIX ACQUIRED!");
          Serial.print("   Latitude: "); Serial.println(fixedLatitude, 6);
          Serial.print("   Longitude: "); Serial.println(fixedLongitude, 6);
          Serial.print("   Satellites: "); Serial.println(gps.satellites.value());
          
          // Simpan ke EEPROM
          preferences.begin("sipadam", false);
          preferences.putFloat("gps_lat", fixedLatitude);
          preferences.putFloat("gps_lng", fixedLongitude);
          preferences.end();
          Serial.println("✅ GPS location saved to EEPROM");
          
          return;
        }
      }
    }
    
    if (millis() - startTime > dotCount * 2000) {
      Serial.print(".");
      dotCount++;
    }
    
    delay(100);
  }
  
  // Timeout - gunakan default
  Serial.println("\n⚠️ GPS FIX TIMEOUT!");
  Serial.println("   Using default location (Semarang)");
  fixedLatitude = -6.9820;
  fixedLongitude = 110.4153;
  gpsFixed = false;
  gpsReadAttempted = true;
}

float calculateRiskScore(float temp, float humidity, float smoke_ppm, float co_ppm, bool dhtValid) {
  if (!dhtValid) return 0;
  float tempScore = 0, humidityScore = 0, smokeScore = 0, coScore = 0;

  if (temp > TEMP_THRESHOLD_LARGE) tempScore = 1.0;
  else if (temp > TEMP_THRESHOLD_MEDIUM) tempScore = mapFloat(temp, TEMP_THRESHOLD_MEDIUM, TEMP_THRESHOLD_LARGE, 0.6, 0.9);
  else if (temp > TEMP_THRESHOLD_SMALL) tempScore = mapFloat(temp, TEMP_THRESHOLD_SMALL, TEMP_THRESHOLD_MEDIUM, 0.3, 0.6);
  else tempScore = mapFloat(temp, 20, TEMP_THRESHOLD_SMALL, 0, 0.3);

  if (humidity < HUMIDITY_THRESHOLD_LARGE) humidityScore = 1.0;
  else if (humidity < HUMIDITY_THRESHOLD_MEDIUM) humidityScore = mapFloat(humidity, HUMIDITY_THRESHOLD_LARGE, HUMIDITY_THRESHOLD_MEDIUM, 1.0, 0.6);
  else if (humidity < HUMIDITY_THRESHOLD_SMALL) humidityScore = mapFloat(humidity, HUMIDITY_THRESHOLD_MEDIUM, HUMIDITY_THRESHOLD_SMALL, 0.6, 0.3);
  else humidityScore = mapFloat(humidity, HUMIDITY_THRESHOLD_SMALL, 80, 0.3, 0);

  if (smoke_ppm > SMOKE_PPM_THRESHOLD_LARGE) smokeScore = 1.0;
  else if (smoke_ppm > SMOKE_PPM_THRESHOLD_MEDIUM) smokeScore = mapFloat(smoke_ppm, SMOKE_PPM_THRESHOLD_MEDIUM, SMOKE_PPM_THRESHOLD_LARGE, 0.6, 0.9);
  else if (smoke_ppm > SMOKE_PPM_THRESHOLD_SMALL) smokeScore = mapFloat(smoke_ppm, SMOKE_PPM_THRESHOLD_SMALL, SMOKE_PPM_THRESHOLD_MEDIUM, 0.3, 0.6);
  else smokeScore = mapFloat(smoke_ppm, SMOKE_PPM_BASE, SMOKE_PPM_THRESHOLD_SMALL, 0, 0.3);

  if (co_ppm > CO_PPM_THRESHOLD_LARGE) coScore = 1.0;
  else if (co_ppm > CO_PPM_THRESHOLD_MEDIUM) coScore = mapFloat(co_ppm, CO_PPM_THRESHOLD_MEDIUM, CO_PPM_THRESHOLD_LARGE, 0.6, 0.9);
  else if (co_ppm > CO_PPM_THRESHOLD_SMALL) coScore = mapFloat(co_ppm, CO_PPM_THRESHOLD_SMALL, CO_PPM_THRESHOLD_MEDIUM, 0.3, 0.6);
  else coScore = mapFloat(co_ppm, CO_PPM_BASE, CO_PPM_THRESHOLD_SMALL, 0, 0.3);

  tempScore = constrain(tempScore, 0, 1);
  humidityScore = constrain(humidityScore, 0, 1);
  smokeScore = constrain(smokeScore, 0, 1);
  coScore = constrain(coScore, 0, 1);
  float riskScore = (tempScore * 0.3) + (humidityScore * 0.1) + (coScore * 0.3) + (smokeScore * 0.3);

  float webcamScore = 0;
  if (webcamFireArea > 15000) webcamScore = 0.95f;
  else if (webcamFireArea > 5000) webcamScore = 0.75f;
  else if (webcamFireArea > 1000) webcamScore = 0.55f;
  
  riskScore = max(riskScore, webcamScore);
  
  return constrain(riskScore, 0, 1);
}

String calculateRiskLevelWithHysteresis(float score, String prevLevel) {
  if (prevLevel == "CRITICAL") {
    if (score > CRITICAL_DOWN) return "CRITICAL";
    else if (score > HIGH_DOWN) return "HIGH";
    else if (score > MEDIUM_DOWN) return "MEDIUM";
    else return "NORMAL";
  }
  else if (prevLevel == "HIGH") {
    if (score > CRITICAL_UP) return "CRITICAL";
    else if (score > HIGH_DOWN) return "HIGH";
    else if (score > MEDIUM_DOWN) return "MEDIUM";
    else return "NORMAL";
  }
  else if (prevLevel == "MEDIUM") {
    if (score > CRITICAL_UP) return "CRITICAL";
    else if (score > HIGH_UP) return "HIGH";
    else if (score > MEDIUM_DOWN) return "MEDIUM";
    else return "NORMAL";
  }
  else {
    if (score > CRITICAL_UP) return "CRITICAL";
    else if (score > HIGH_UP) return "HIGH";
    else if (score > MEDIUM_UP) return "MEDIUM";
    else return "NORMAL";
  }
}

String applyTemporalConfidence(String detectedLevel) {
  unsigned long confirmTime = 0;
  
  if (detectedLevel == "CRITICAL" || detectedLevel == "CRITICAL_CAMERA")  
    confirmTime = CRITICAL_CONFIRM_TIME;
  else if (detectedLevel == "HIGH" || detectedLevel == "HIGH_CAMERA")  
    confirmTime = HIGH_CONFIRM_TIME;
  else if (detectedLevel == "MEDIUM" || detectedLevel == "MEDIUM_CAMERA") 
    confirmTime = MEDIUM_CONFIRM_TIME;
  else {
    fireConfirmStart = 0;
    return "NORMAL";
  }
  
  if (fireConfirmStart == 0) {
    fireConfirmStart = millis();
    Serial.println("⏳ Fire detected, waiting...");
    return "NORMAL";
  }
  
  if (millis() - fireConfirmStart >= confirmTime) {
    Serial.println("✅ Fire CONFIRMED!");
    return detectedLevel;
  } else {
    return "NORMAL";
  }
}

void controlLEDBlinking(String riskLevel) {
  if (riskLevel == "CRITICAL" || riskLevel == "CRITICAL_CAMERA") {
    shouldBlinkLarge = true;
    shouldBlinkMedium = false;
    shouldBlinkSmall = false;
    digitalWrite(MEDIUM_FIRE_LED, LOW);
    digitalWrite(SMALL_FIRE_LED, LOW);
  } else if (riskLevel == "HIGH" || riskLevel == "HIGH_CAMERA") {
    shouldBlinkMedium = true;
    shouldBlinkLarge = false;
    shouldBlinkSmall = false;
    digitalWrite(LARGE_FIRE_LED, LOW);
    digitalWrite(SMALL_FIRE_LED, LOW);
  } else if (riskLevel == "MEDIUM" || riskLevel == "MEDIUM_CAMERA") {
    shouldBlinkSmall = true;
    shouldBlinkLarge = false;
    shouldBlinkMedium = false;
    digitalWrite(MEDIUM_FIRE_LED, LOW);
    digitalWrite(LARGE_FIRE_LED, LOW);
  } else {
    shouldBlinkLarge = false;
    shouldBlinkMedium = false;
    shouldBlinkSmall = false;
    digitalWrite(LARGE_FIRE_LED, LOW);
    digitalWrite(MEDIUM_FIRE_LED, LOW);
    digitalWrite(SMALL_FIRE_LED, LOW);
  }
}

// ✅ TAMBAHKAN FUNGSI INI:
void controlBuzzer(String riskLevel) {
  if (riskLevel == "CRITICAL" || riskLevel == "CRITICAL_CAMERA" || 
      riskLevel == "HIGH" || riskLevel == "HIGH_CAMERA") {
    buzzerActive = true;
  } else {
    buzzerActive = false;
    digitalWrite(BUZZER_PIN, LOW); // Pastikan mati untuk MEDIUM/NORMAL
  }
}

float mapFloat(float x, float in_min, float in_max, float out_min, float out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

float MQResistanceCalculation(int raw_adc) {
  if (raw_adc == 0) raw_adc = 1;
  return ((float)RL_VALUE * (4095 - raw_adc) / raw_adc);
}

float MQCalibration(int mq_pin) {
  float val = 0;
  for (int i = 0; i < CALIBARAION_SAMPLE_TIMES; i++) {
    val += MQResistanceCalculation(analogRead(mq_pin));
    delay(CALIBRATION_SAMPLE_INTERVAL);
    esp_task_wdt_reset();
    if (i % 10 == 0) Serial.print(".");
  }
  Serial.println();
  val = val / CALIBARAION_SAMPLE_TIMES;
  val = val / RO_CLEAN_AIR_FACTOR;
  return val;
}

float MQRead(int mq_pin) {
  float rs = 0;
  for (int i = 0; i < READ_SAMPLE_TIMES; i++) {
    rs += MQResistanceCalculation(analogRead(mq_pin));
    delay(READ_SAMPLE_INTERVAL);
  }
  rs = rs / READ_SAMPLE_TIMES;
  return rs;
}

float MQGetGasPercentage(float rs_ro_ratio, int gas_id) {
  if (gas_id == GAS_LPG) return MQGetPercentage(rs_ro_ratio, LPGCurve);
  if (gas_id == GAS_CO) return MQGetPercentage(rs_ro_ratio, COCurve);
  if (gas_id == GAS_SMOKE) return MQGetPercentage(rs_ro_ratio, SmokeCurve);
  return 0;
}

float MQGetPercentage(float rs_ro_ratio, float* pcurve) {
  return pow(10, (((log10(rs_ro_ratio) - pcurve[1]) / pcurve[2]) + pcurve[0]));
}