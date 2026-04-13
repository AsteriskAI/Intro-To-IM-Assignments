#include <LiquidCrystal.h>

// Initialize LCD pins: RS, E, D4, D5, D6, D7
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

const int buzzerPin = 9; // Connect Piezo buzzer to Pin 9

void setup() {
  Serial.begin(9600);
  
  // Set up the buzzer pin
  pinMode(buzzerPin, OUTPUT);
  
  // Initialize the LCD
  lcd.begin(16, 2);
  lcd.print("Piano Ready...");
}

void loop() {
  // Check if data has been sent from Python
  if (Serial.available() > 0) {
    char key = Serial.read(); // Read the incoming byte
    
    int frequency = 0;
    String noteName = "";

    // Map the characters from Python script to notes
    switch (key) {
      case 'A': frequency = 262; noteName = "C4"; break;
      case 'S': frequency = 294; noteName = "D4"; break;
      case 'D': frequency = 330; noteName = "E4"; break;
      case 'F': frequency = 349; noteName = "F4"; break;
      case 'G': frequency = 392; noteName = "G4"; break;
      case 'H': frequency = 440; noteName = "A4"; break;
      case 'J': frequency = 494; noteName = "B4"; break;
      case 'K': frequency = 523; noteName = "C5"; break;
      case 'L': frequency = 587; noteName = "D5"; break;
      default: return; // Ignore any other keys
    }

    // Play the note
    if (frequency > 0) {
      updateDisplay(noteName, frequency);
      tone(buzzerPin, frequency, 150); // Play for 150ms
    }
  }
}

// Function to handle LCD updates
void updateDisplay(String note, int freq) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Note: ");
  lcd.print(note);
  lcd.setCursor(0, 1);
  lcd.print("Freq: ");
  lcd.print(freq);
  lcd.print(" Hz");
}
