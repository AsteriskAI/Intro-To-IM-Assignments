// Left LED Pins
const int L_red = 3, L_green = 5, L_blue = 6;
// Right LED Pins
const int R_red = 9, R_green = 10, R_blue = 11;
const int sensorPin = A0;

void setup() {
  Serial.begin(9600);
  pinMode(L_red, OUTPUT); pinMode(L_green, OUTPUT); pinMode(L_blue, OUTPUT);
  pinMode(R_red, OUTPUT); pinMode(R_green, OUTPUT); pinMode(R_blue, OUTPUT);
}

void loop() {
  // Send Wind Data
  Serial.println(analogRead(sensorPin));

  if (Serial.available() > 0) {
    char side = Serial.read(); // Read 'L' or 'R'
    
    if (side == 'L' || side == 'R') {
      Serial.read(); // Skip the comma
      int r = Serial.parseInt();
      int g = Serial.parseInt();
      int b = Serial.parseInt();

      if (side == 'L') {
        flash(L_red, L_green, L_blue, r, g, b);
      } else {
        flash(R_red, R_green, R_blue, r, g, b);
      }
    }
  }
}

void flash(int rp, int gp, int bp, int r, int g, int b) {
  analogWrite(rp, r); analogWrite(gp, g); analogWrite(bp, b);
  delay(100);
  analogWrite(rp, 0); analogWrite(gp, 0); analogWrite(bp, 0);
}
