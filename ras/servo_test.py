from gpiozero import Servo
from gpiozero.pins.pigpio import PiGPIOFactory
from time import sleep
from guizero import App, Slider, Text
import numpy as np


factory = PiGPIOFactory(host="192.168.137.191")
servo = Servo(
    17,
    min_pulse_width=1.0 / 1000,
    max_pulse_width=2.0 / 1000,
    pin_factory=factory,
)


for i in np.arange(-1, 1, 0.1):
    servo.value = i
    sleep(0.2)
