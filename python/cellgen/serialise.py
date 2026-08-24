"""
Serialise a CellSet back to a CellGen format string.
"""

from __future__ import annotations
from .types import Cell, CellSet, CellularElement, ChromosomeNode, EntityNode


def to_cellgen(cell_set: CellSet) -> str:
    """Convert a CellSet back to a CellGen format string."""
    return " ; ".join(_cell_str(c) for c in cell_set.cells)


def _cell_str(cell: Cell) -> str:
    return ", ".join(_replicon_str(r) for r in cell.replicons)


def _replicon_str(r: CellularElement) -> str:
    if isinstance(r, ChromosomeNode):
        inner = ", ".join(_entity_str(m) for m in r.children)
        attrs = _attrs_str(r.attributes)
        return f"({inner}){r.label}{attrs}"
    else:
        return _entity_str(r)


def _entity_str(m: EntityNode) -> str:
    inner = ", ".join(_entity_str(c) for c in m.children)
    attrs = _attrs_str(m.attributes)
    return f"{{{inner}}}{m.label}{attrs}"


def _attrs_str(attrs: dict[str, str]) -> str:
    if not attrs:
        return ""
    pairs = ", ".join(f'{k}="{v}"' for k, v in attrs.items())
    return f"[{pairs}]"
