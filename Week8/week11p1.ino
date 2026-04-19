const int trigPin = 9;
const int echoPin = 10;

void setup() {
  Serial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
}

void loop() {
  // Trigger the sensor
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Measure the bounce back time
  long duration = pulseIn(echoPin, HIGH);
  
  // Calculate distance
  int distance = duration * 0.034 / 2;

  // Send just the number to p5.js
  Serial.println(distance); 

  delay(50);
}