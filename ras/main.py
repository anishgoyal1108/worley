from gpiozero import AngularServo
from gpiozero.pins.pigpio import PiGPIOFactory
from time import sleep
import json_schema
import logging
from pathlib import Path

log = logging.getLogger()


def load_config():
    ...


factory = PiGPIOFactory()
servo = AngularServo(
    3,
    min_angle=0,
    max_angle=180,
    min_pulse_width=0.0005,
    max_pulse_width=0.0025,
    pin_factory=factory,
)
