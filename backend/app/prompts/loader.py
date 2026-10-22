from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

PROMPTS_DIR = Path(__file__).parent


@lru_cache(maxsize=None)
def _load_file(name: str) -> dict:
    with (PROMPTS_DIR / f"{name}.yml").open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _node(name: str, section: Optional[str]):
    data = _load_file(name)
    return data[section] if section else data


@lru_cache(maxsize=None)
def get_system_prompt(name: str, section: Optional[str] = None) -> str:
    node = _node(name, section)
    return node["system_prompt"] if isinstance(node, dict) else node


def get_tools(name: str, section: Optional[str] = None) -> list[dict]:
    node = _node(name, section)
    return (node.get("tools") if isinstance(node, dict) else None) or []


def render_prompt(template: str, values: dict[str, str]) -> str:
    # Literal replace keeps unknown placeholders visible instead of raising like str.format would.
    for key, value in values.items():
        template = template.replace(f"{{{key}}}", value)
    return template
