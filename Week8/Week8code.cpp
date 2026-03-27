#include <SPI.h>
#include <MFRC522.h>
#include <LedControl.h> 

// RFID Pins
#define SS_PIN 10
#define RST_PIN 9

// Matrix Pins
#define DIN_PIN 4
#define CS_PIN  3
#define CLK_PIN 2

// LED Pins
#define RED_LED_PIN 5   
#define GREEN_LED_PIN 6 

MFRC522 mfrc522(SS_PIN, RST_PIN);
LedControl lc = LedControl(DIN_PIN, CLK_PIN, CS_PIN, 1);

byte authorizedUID[] = {0x2E, 0x67, 0xEB, 0x18}; 

void setup() {
  Serial.begin(9600);
  SPI.begin();
  mfrc522.PCD_Init();
  
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  
  lc.shutdown(0, false);
  lc.setIntensity(0, 8);
  lc.clearDisplay(0);
  
  // Standby: Single dot corner
  lc.setLed(0, 0, 0, true);
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  bool match = true;
  for (byte i = 0; i < 4; i++) {
    if (mfrc522.uid.uidByte[i] != authorizedUID[i]) {
      match = false;
      break;
    }
  }

  // Long green flash when correct card and show smile.
  if (match) {
    Serial.println("ACCESS GRANTED");
    digitalWrite(GREEN_LED_PIN, HIGH);
    showSmile();
    delay(3000); 
    digitalWrite(GREEN_LED_PIN, LOW);
  } 
  else {
    Serial.println("ACCESS DENIED - ALARM");
    showX();
    
    // Repeated red flashing
    for(int i = 0; i < 5; i++) {
      digitalWrite(RED_LED_PIN, HIGH);
      delay(100);
      digitalWrite(RED_LED_PIN, LOW);
      delay(100);
    }
  }

  // Reset visuals
  lc.clearDisplay(0);
  lc.setLed(0, 0, 0, true); 
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

void showSmile() {
  // Draw the smile by turning on the respective leds of the dot matrix.
  lc.clearDisplay(0);
  lc.setLed(0,2,2,true); lc.setLed(0,2,5,true); 
  lc.setLed(0,5,1,true); lc.setLed(0,6,2,true); 
  lc.setLed(0,6,3,true); lc.setLed(0,6,4,true); 
  lc.setLed(0,6,5,true); lc.setLed(0,5,6,true);
}

void showX() {
  lc.clearDisplay(0);
  for(int i=0; i<8; i++) {
    lc.setLed(0, i, i, true);
    lc.setLed(0, i, 7-i, true);
  }
}