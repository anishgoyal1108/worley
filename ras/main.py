import json
import logging
import re
from pathlib import Path
from time import sleep

import yaml
from jsonschema import validate
from typing import Literal
from rich.logging import RichHandler

log = logging.getLogger()
log.setLevel(logging.DEBUG)
log.addHandler(RichHandler())


def load_config():
    log.info("Loading config...")
    schema_path = Path(__file__).parent / "schema.json"
    config_path = Path(__file__).parent / "config.yaml"
    with open(schema_path, encoding="utf-8") as f:
        schema = json.load(f)
    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)
    validate(instance=config, schema=schema)
    assert re.match(r"v0\.1\..*", config["version"]), "Invalid version"
    return config["config"]


class Servo:
    def __init__(
        self,
        pin: int,
        min: int = 0,
        max: int = 180,
        default: int = 0,
        inverted: bool = False,
        backend: Literal["adafruit", "gpiozero"] = "gpiozero",
        host: str = "192.168.137.60",
    ):
        self.pin = pin
        self.min = min
        self.max = max
        self.default = default
        self.inverted = inverted
        self.host = host
        self.backend = backend

        if backend == "adafruit":
            if host != "localhost":
                raise ValueError("Adafruit backend does not support remote hosts")
            self._servo = self.__load_adafruit_servo()
        else:
            self._servo = self.__load_gpiozero_servo()
        self.angle = default

    @property
    def angle(self):
        return self._servo.angle

    @angle.setter
    def angle(self, value):
        if self.inverted:
            value = self.max - value + self.min
        if self.backend == "gpiozero":
            log.debug(f"Setting {self.pin} to {value}")
            self._servo.angle = value
        else:
            angle = (value - self.min) / (self.max - self.min) * 180
            angle = self.max - angle
            angle = max(self.min, min(self.max, angle))
            log.debug(f"Setting {self.pin} to {angle}")
            self._servo.angle = angle

    def __load_adafruit_servo(self):
        from adafruit_servokit import ServoKit

        kit = ServoKit(channels=16)
        return kit.servo[self.pin]

    def __load_gpiozero_servo(self):
        from gpiozero import AngularServo
        from gpiozero.pins.pigpio import PiGPIOFactory

        factory = PiGPIOFactory(host=self.host)
        return AngularServo(
            pin=self.pin,
            min_angle=self.min,
            max_angle=self.max,
            min_pulse_width=0.0005,
            max_pulse_width=0.0025,
            pin_factory=factory,
        )


class ServoController:
    """Controls the servos."""

    def __init__(
        self,
        config,
        type: Literal["adafruit", "gpiozero"] = "gpiozero",
        host: str = "192.168.137.60",
    ):
        log.info("Initializing controller...")
        self.config = config

        self.word = None
        self._host = host
        self._transitions = self._load_transitions()

        log.info("Loading servos...")
        self._servos = {
            name: Servo(
                **servo_config,
                backend=type,
                host=host,
            )
            if isinstance(servo_config, dict)
            else Servo(pin=servo_config, backend=type, host=host)
            for name, servo_config in self.config["servos"].items()
        }
        self._words = self.config["words"]

    def __getattr__(self, name):
        if name in self._servos:
            return self._servos[name]
        raise AttributeError(f"Invalid attribute: {name}")

    def act(self, word: str):
        log.debug(f"Acting out {word}...")
        try:
            self._transition(self.word, word)
        except ValueError:
            ...
        try:
            self._act_raw(self._words[word])
        except KeyError:
            raise ValueError(f"Invalid word: {word}")
        self.word = word

    def _act_raw(self, servo_config: dict[str, int]):
        for name, angle in servo_config.items():
            if servo := self._servos.get(name):
                servo.angle = angle
            else:
                log.warning(f"Servo {name} is not supported")

    def _transition(self, from_: str, to: str, dt=0.05):
        log.debug(f"Transitioning from {from_} to {to}...")
        transition = self._transitions.get(
            (from_, to),
            self._transitions.get((to, from_)),
        )
        if transition is None:
            raise ValueError(f"Invalid transition: {from_} -> {to}")
        for step in transition["steps"]:
            self._act_raw(step)
            sleep(dt)

    def _load_transitions(self):
        log.info("Loading transitions...")
        return {
            (transition["from"], transition["to"]): transition
            for transition in self.config.get("transitions", [])
        }


config = load_config()
controller = ServoController(config)
# for i in ascii_uppercase:
#     controller.act(i)
#     sleep(1)
# controller.act("MIN")
