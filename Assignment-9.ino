#include <LiquidCrystal.h>

// RS, E, D4, D5, D6, D7
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

const int ldrPin = A0;
const int btnPin = 7;     // Button
const int ledAnalog = 9;  // The fading LED
const int ledA = 13;      // Light show LED
const int ledB = 10;      // Light show LED
const int ledC = 8;       // Light show LED

int threshold = 600;
unsigned long startMs = 0;
bool charging = false;
bool done = false;

void setup() {
  lcd.begin(16, 2);
  pinMode(btnPin, INPUT_PULLUP);
  pinMode(ledAnalog, OUTPUT);
  pinMode(ledA, OUTPUT);
  pinMode(ledB, OUTPUT);
  pinMode(ledC, OUTPUT);
}

void loop() {
  int light = analogRead(ldrPin);
  
  // Reset logic
  if (digitalRead(btnPin) == LOW) {
    // Set variables to original values
    startMs = 0;
    charging = false;
    done = false;
    // Turn off everything
    digitalWrite(ledA, LOW);
    digitalWrite(ledB, LOW);
    digitalWrite(ledC, LOW);
    analogWrite(ledAnalog, 0);
    lcd.clear();
    lcd.print("System Reset");
    delay(500);
  }

  if (!done) {
    // When light above threshold start counting
    if (light > threshold) {
      if (!charging) {
        startMs = millis();
        charging = true;
      }
  

      long elapsed = (millis() - startMs) / 1000;
      int progress = map(elapsed, 0, 10, 0, 100);
      progress = constrain(progress, 0, 100);

      // Analog LED gets brighter as time passes
      analogWrite(ledAnalog, map(progress, 0, 100, 0, 255));

      // Print out contents to the LCD
      lcd.setCursor(0, 0);
      lcd.print("Light:   "); lcd.print(light);
      lcd.setCursor(0, 1);
      lcd.print("Charge: "); lcd.print(progress); lcd.print("%     ");
      // Once 10+ seconds of continuous charging has been done set done to true.
      if (elapsed >= 10) done = true;
    } 
    else {
      // If light drops, stop charging
      charging = false;
      startMs = 0;
      analogWrite(ledAnalog, 0);
      lcd.setCursor(0, 1);
      lcd.print("Need More Light ");
    }
  } 
  else {
    // Light show time
    lcd.setCursor(0, 0);
    lcd.print("FULLY CHARGED!  ");
    lcd.setCursor(0, 1);
    lcd.print("   100 PERCENT  ");
    
    // Blink Pattern
    digitalWrite(ledA, HIGH); delay(100);
    digitalWrite(ledB, HIGH); delay(100);
    digitalWrite(ledC, HIGH); delay(100);
    digitalWrite(ledA, LOW);  digitalWrite(ledB, LOW); digitalWrite(ledC, LOW);
    delay(100);
  }
}