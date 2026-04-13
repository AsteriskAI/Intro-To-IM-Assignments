import serial
import keyboard
import time

try:
    arduino = serial.Serial('COM11', 9600, timeout=1)
    time.sleep(2) # Wait for connection to stabilize
    print("Piano Connected! Press A-L to play.")
except:
    print("Error: Could not connect to COM11. Check your port!")
    exit()

while True:
    if keyboard.is_pressed('a'):
        arduino.write(b'A')
        time.sleep(0.15) 
    elif keyboard.is_pressed('s'):
        arduino.write(b'S')
        time.sleep(0.15)
    elif keyboard.is_pressed('d'):
        arduino.write(b'D')
        time.sleep(0.15)
    elif keyboard.is_pressed('f'):
        arduino.write(b'F')
        time.sleep(0.15)
    elif keyboard.is_pressed('g'): 
        arduino.write(b'G')
        time.sleep(0.15)
    elif keyboard.is_pressed('h'):
        arduino.write(b'H')
        time.sleep(0.15)
    elif keyboard.is_pressed('j'):
        arduino.write(b'J')
        time.sleep(0.15)
    elif keyboard.is_pressed('k'):
        arduino.write(b'K')
        time.sleep(0.15)
    elif keyboard.is_pressed('l'):
        arduino.write(b'L')
        time.sleep(0.15)

    if keyboard.is_pressed('esc'):
        print("Closing...")
        break

arduino.close()
