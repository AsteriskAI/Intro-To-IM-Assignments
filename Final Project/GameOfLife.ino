// Conway's Game of Life - ESP32 Firmware
// Wireless control via WebSocket on port 81
// Hardware: LED Strip (FastLED), LCD 16x2, 8x8 Dot Matrix

// Libraries needed (install via Arduino Library Manager):
// FastLED, MD_MAX72xx, LiquidCrystal, WebSockets by Markus Sattler, WiFi (built-in ESP32)

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <LiquidCrystal.h>
#include <MD_MAX72xx.h>
#include <FastLED.h>

// Wi-Fi credentials
const char* SSID     = "_VelopSetup214";
const char* PASSWORD = "shn7cyi1xt";

WebSocketsServer wsServer(81);

// LED strip
#define NUM_LEDS 64
#define LED_PIN  13
CRGB leds[NUM_LEDS];
uint8_t hue = 0;

// LCD pins (RS, E, D4, D5, D6, D7)
const int rs = 22, en = 25, d4 = 19, d5 = 21, d6 = 26, d7 = 15;
LiquidCrystal lcd(rs, en, d4, d5, d6, d7);

// Dot matrix pins
#define MAX_DEVICES 1
#define DATA_PIN    23
#define CLK_PIN     18
#define CS_PIN      5
MD_MAX72XX mx = MD_MAX72XX(MD_MAX72XX::ICSTATION_HW, DATA_PIN, CLK_PIN, CS_PIN, MAX_DEVICES);

// Game state, all of this gets updated when p5.js sends a message
uint8_t  grid[8][8] = {0};
uint32_t generation  = 0;
int      simSpeed    = 300; // ms, used for LCD display and matrix beat timing
int      themeIdx    = 0;
bool     simRunning  = false;

// Timers to avoid blocking the loop with delays
unsigned long lastLCDUpdate  = 0;
unsigned long lastLEDUpdate  = 0;
unsigned long lastMatrixBeat = 0;
uint8_t       matrixFrame    = 0;

// Each index matches a theme in p5.js, the value is the base hue for the LED strip
const uint8_t THEME_HUES[] = { 96, 32, 192, 64, 144, 0 };

void setup() {
  Serial.begin(115200);

  // LCD boots first so we can use it to show connection status
  lcd.begin(16, 2);
  lcd.clear();
  lcd.print("GAME OF LIFE");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");

  mx.begin();
  mx.clear();
  mx.control(MD_MAX72XX::INTENSITY, 3);
  showMatrixStartup();

  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 700);
  FastLED.setBrightness(100);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  WiFi.begin(SSID, PASSWORD);
  Serial.print("Connecting to WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString()); // Show IP so you know what to put in sketch.js
    delay(2000);
  } else {
    Serial.println("\nWiFi FAILED - check credentials");
    lcd.clear();
    lcd.print("WiFi FAILED");
    lcd.setCursor(0, 1);
    lcd.print("Check settings");
    delay(3000);
  }

  wsServer.begin();
  wsServer.onEvent(onWSEvent);
  Serial.println("WebSocket server on port 81");

  updateLCD();
}

void loop() {
  wsServer.loop(); // Must be called every loop or WebSocket messages get dropped

  unsigned long now = millis();

  if (now - lastLEDUpdate > 20) {
    updateLEDs();
    lastLEDUpdate = now;
  }

  if (now - lastLCDUpdate > 500) {
    updateLCD();
    lastLCDUpdate = now;
  }

  // Matrix beat speed is tied to sim speed so it feels responsive
  if (now - lastMatrixBeat > max(80, simSpeed / 4)) {
    updateMatrix();
    lastMatrixBeat = now;
  }
}

// Beginning of WebSocket handler

void onWSEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case WStype_CONNECTED:
      Serial.printf("[WS] Client #%u connected\n", num);
      wsServer.sendTXT(num, "HELLO:ESP32_READY");
      lcdFlash("p5.js Connected");
      matrixFlash();
      break;

    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client #%u disconnected\n", num);
      lcdFlash("Client Left    ");
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);
      Serial.println("[WS] Received: " + msg);
      parseMessage(msg);
      break;
    }

    default: break;
  }
}

// Beginning of message parser

/***
Two message formats come in from p5.js:

GRID:<64 bits>,GEN:<n>,SPEED:<ms>,THEME:<idx>
  Full state snapshot sent every time the grid changes or a generation steps.
  The 64-bit string is row-major, so position r*8+c maps to grid[c][r].

CMD:PLAY | CMD:PAUSE | CMD:SPEED:<ms> | CMD:THEME:<idx>
  Lightweight command sent when a button is pressed without a grid change.
***/
void parseMessage(String msg) {

  if (msg.startsWith("GRID:")) {
    int gridEnd  = msg.indexOf(',');
    String cells = msg.substring(5, gridEnd);

    int genStart = msg.indexOf("GEN:") + 4;
    int genEnd   = msg.indexOf(',', genStart);
    generation   = msg.substring(genStart, genEnd).toInt();

    int spStart = msg.indexOf("SPEED:") + 6;
    int spEnd   = msg.indexOf(',', spStart);
    simSpeed    = msg.substring(spStart, spEnd == -1 ? msg.length() : spEnd).toInt();

    int thStart = msg.indexOf("THEME:") + 6;
    if (thStart > 5) {
      themeIdx = constrain(msg.substring(thStart).toInt(), 0, 5);
    }

    // Decode the 64-char string into the grid array
    if (cells.length() == 64) {
      for (int r = 0; r < 8; r++)
        for (int c = 0; c < 8; c++)
          grid[c][r] = (cells[r * 8 + c] == '1') ? 1 : 0;
    }

    renderGridToLEDs();

  } else if (msg.startsWith("CMD:")) {
    String cmd = msg.substring(4);

    if (cmd == "PLAY") {
      simRunning = true;
      lcdFlash(">> RUNNING     ");
      matrixFlash();
    } else if (cmd == "PAUSE") {
      simRunning = false;
      lcdFlash("|| PAUSED      ");
    } else if (cmd.startsWith("SPEED:")) {
      simSpeed = cmd.substring(6).toInt();
    } else if (cmd.startsWith("THEME:")) {
      themeIdx = constrain(cmd.substring(6).toInt(), 0, 5);
    }
  }
}

// Beginning of LED functions

/***
renderGridToLEDs() maps each LED to its matching grid cell.
Alive cells get full brightness at the theme hue, dead cells get a very dim version
of the same hue so the strip still glows faintly instead of going fully dark.
The hue variable keeps cycling so the colors shift over time even between grid updates.
***/
void renderGridToLEDs() {
  uint8_t baseHue = THEME_HUES[themeIdx];
  for (int i = 0; i < NUM_LEDS; i++) {
    int c = i % 8;
    int r = i / 8;
    if (grid[c][r]) {
      leds[i] = CHSV(baseHue + hue + (i * 6), 255, 255);
    } else {
      leds[i] = CHSV(baseHue + hue + (i * 6), 200, 18); // dim glow on dead cells
    }
  }
  FastLED.show();
}

void updateLEDs() {
  hue++; // Increment hue every 20ms for smooth color cycling
  renderGridToLEDs();
}

// Beginning of LCD functions

/***
LCD layout:
  Line 1: "GEN 000042  RUN"  or  "GEN 000042  PSE"
  Line 2: "SPD [######  ]"   - 8-character bar that fills with # based on speed
***/
void updateLCD() {
  lcd.setCursor(0, 0);
  lcd.print("GEN ");
  char genBuf[7];
  sprintf(genBuf, "%06lu", generation % 1000000UL);
  lcd.print(genBuf);
  lcd.print(simRunning ? "  RUN" : "  PSE");

  lcd.setCursor(0, 1);
  int bars = constrain(map(simSpeed, 900, 30, 0, 8), 0, 8);
  lcd.print("SPD [");
  for (int i = 0; i < 8; i++) lcd.print(i < bars ? '#' : ' ');
  lcd.print("]");
}

// Briefly shows a message on line 1 then restores the normal display
void lcdFlash(const char* msg) {
  lcd.setCursor(0, 0);
  lcd.print(msg);
  delay(600);
  updateLCD();
}

// Beginning of dot matrix functions

/***
When the sim is running the matrix mirrors the live game grid exactly, so you
get a small 8x8 preview of what's happening on the LED strip.
When paused it falls back to a border pulse animation so it doesn't just go blank.
***/
void updateMatrix() {
  mx.clear();

  if (simRunning) {
    for (int r = 0; r < 8; r++) {
      uint8_t rowByte = 0;
      for (int c = 0; c < 8; c++) {
        if (grid[c][r]) rowByte |= (1 << (7 - c));
      }
      mx.setRow(0, r, rowByte);
    }

  } else {
    // Idle border animation with a pulsing center block
    matrixFrame++;
    uint8_t f = matrixFrame % 16;
    mx.setRow(0, 0, 0xFF);
    mx.setRow(0, 7, 0xFF);
    for (int r = 1; r < 7; r++) {
      mx.setPoint(r, 0, true);
      mx.setPoint(r, 7, true);
    }
    if (f < 8) {
      mx.setPoint(3, 3, true);
      mx.setPoint(3, 4, true);
      mx.setPoint(4, 3, true);
      mx.setPoint(4, 4, true);
    }
  }
}

// Wipes columns on then off as a startup animation
void showMatrixStartup() {
  for (int c = 0; c < 8; c++) { mx.setColumn(c, 0xFF); delay(60); }
  delay(200);
  for (int c = 0; c < 8; c++) { mx.setColumn(c, 0x00); delay(60); }
}

// Slams the matrix to full brightness for 120ms, used on connect and play
void matrixFlash() {
  mx.control(MD_MAX72XX::INTENSITY, 15);
  for (int r = 0; r < 8; r++) mx.setRow(0, r, 0xFF);
  delay(120);
  mx.control(MD_MAX72XX::INTENSITY, 3);
  mx.clear();
}

// You have reached the end!
