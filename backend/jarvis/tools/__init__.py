"""Tool registry: aggregates all tool modules."""
from jarvis.tools import (filesystem, applications, browser, terminal,
                          development, cybersecurity, system_info, gmail_tools)

_MODULES = [filesystem, applications, browser, terminal, development,
            cybersecurity, system_info, gmail_tools]

# name -> meta dict {name, category, func, description, input_schema}
ALL_TOOLS: dict[str, dict] = {}
for _m in _MODULES:
    for _t in _m.REGISTRY:
        ALL_TOOLS[_t["name"]] = _t


def anthropic_schemas(enabled_categories: set[str]) -> list[dict]:
    """Return Anthropic tool schemas for tools whose category is enabled."""
    schemas = []
    for t in ALL_TOOLS.values():
        if t["category"] in enabled_categories or t["category"] == "read":
            schemas.append({
                "name": t["name"],
                "description": t["description"],
                "input_schema": t["input_schema"],
            })
    return schemas


def get_tool(name: str) -> dict | None:
    return ALL_TOOLS.get(name)
