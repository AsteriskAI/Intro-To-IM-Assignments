const int redPin = 9;   
const int greenPin = 10;
const int bluePin = 11;

void setup() {
  // Start serial communication at 9600 baud
  Serial.begin(9600);
  
  // Set pins as outputs
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  if (Serial.available() > 0) {
    
    // Read the three integers sent from p5.js
    // parseInt() looks for digits and skips non-digits
    int r = Serial.parseInt();
    int g = Serial.parseInt();
    int b = Serial.parseInt();

    // Look for the newline character to confirm the end of the message
    if (Serial.read() == '\n') {
      // Apply the brightness to each pin
      analogWrite(redPin, r);
      analogWrite(greenPin, g);
      analogWrite(bluePin, b);
    }
  }
}