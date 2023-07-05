from gpiozero import Servo
from gpiozero.pins.pigpio import PiGPIOFactory
from time import sleep

factory = PiGPIOFactory(host='192.168.137.191')
servo = Servo(17,min_pulse_width=0.8/1000, max_pulse_width=2.2/1000,pin_factory=factory)

while True:
    servo.min()
    sleep(2)
    servo.max()
    sleep(2)
