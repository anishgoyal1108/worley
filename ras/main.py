import json
import logging
import re
from functools import partial
from pathlib import Path
from time import sleep

import yaml
from jsonschema import validate
from typing import Literal
from rich import print
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
    assert re.match(r"v0\.0\..*", config["version"]), "Invalid version"
    return config["config"]


class ServoController:
    """Controls the servos."""

    def __init__(self, config, type: Literal["adafruit", "gpiozero"] = "gpiozero"):
        log.info("Initializing controller...")
        self.config = config

        self.word = None
        self._transitions = self._load_transitions()
        if type == "adafruit":
            self._servos = self._load_adafruit_servos()
        else:
            self._servos = self._load_gpiozero_servos()
        self._words = self.config["words"]

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
                log.warning(f'Servo {name} is not supported')

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

    def _load_adafruit_servos(self):
        from adafruit_servokit import ServoKit
                
        log.info("Initializing servos...")
        self._kit = ServoKit(channels=16)
        return {
            name: self._kit.servo[pin] for name, pin in self.config["servos"].items()
            if pin in range(0, 15) # support omitted servos
        }
    
    def _load_gpiozero_servos(self):
        from gpiozero import AngularServo
        from gpiozero.pins.pigpio import PiGPIOFactory
        
        log.info("Initializing servos...")
        self._factory = PiGPIOFactory()
        make_servo = partial(
            AngularServo,
            min_angle=0,
            max_angle=180,
            min_pulse_width=0.0005,
            max_pulse_width=0.0025,
            pin_factory=self._factory,
        )
        return {name: make_servo(pin) for name, pin in self.config["servos"].items()}

config = load_config()
controller = ServoController(config)
controller.act("A")
