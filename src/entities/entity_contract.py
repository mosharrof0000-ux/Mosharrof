"""Entity contract used by every future Mosharrof component."""

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class EntityContract:
    entity_id: str
    name: str
    responsibility: str
    scope: str
    brain_adapter: str = "runtime-selected"
    permissions: List[str] = field(default_factory=list)
    policy: str = "policies/CORE_POLICY.md"
    tools: List[str] = field(default_factory=list)
    state: Dict[str, Any] = field(default_factory=dict)
    version: str = "0.1.0"

    def summary(self) -> Dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "name": self.name,
            "responsibility": self.responsibility,
            "scope": self.scope,
            "brain_adapter": self.brain_adapter,
            "permissions": list(self.permissions),
            "policy": self.policy,
            "tools": list(self.tools),
            "version": self.version,
        }
