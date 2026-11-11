"""
NativeEmailEngine: Fallback wrapper delegating directly to EmailComponents.
Ensures consistency and zero image slices across all rendering pipelines.
"""

import importlib

class NativeEmailEngine:
    @classmethod
    def render(cls, clinic: dict, step: str = "01-welcome") -> str:
        comp_mod = importlib.import_module("agents.3_copywriter.components")
        return comp_mod.EmailComponents.assemble(clinic, step=step)
