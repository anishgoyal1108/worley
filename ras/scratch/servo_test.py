from time import sleep

from adafruit_servokit import ServoKit
from rich import print

kit = ServoKit(channels=16)


while True:
    print("MIN")
    for i in range(0, 16):
        kit.servo[i].angle = 0
    sleep(1)
    print("MAX")
    for i in range(0, 16):
        kit.servo[i].angle = 180
    sleep(1)