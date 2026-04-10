"""
Serialise a CellSet back to a Wolvercote format string.
"""

from __future__ import annotations
from .types import Cell, CellSet, ChromosomeNode, MGENode, Replicon


def to_wolvercote(cell_set: CellSet) -> str:
    """Convert a CellSet back to a Wolvercote format string."""
    return " ; ".join(_cell_str(c) for c in cell_set.cells)


def _cell_str(cell: Cell) -> str:
    return ", ".join(_replicon_str(r) for r in cell.replicons)


def _replicon_str(r: Replicon) -> str:
    if isinstance(r, ChromosomeNode):
        inner = ", ".join(_mge_str(m) for m in r.children)
        attrs = _attrs_str(r.attributes)
        return f"({inner}){r.label}{attrs}"
    else:
        return _mge_str(r)


def _mge_str(m: MGENode) -> str:
    inner = ", ".join(_mge_str(c) for c in m.children)
    attrs = _attrs_str(m.attributes)
    return f"{{{inner}}}{m.label}{attrs}"


def _attrs_str(attrs: dict[str, str]) -> str:
    if not attrs:
        return ""
    pairs = ", ".join(f'{k}="{v}"' for k, v in attrs.items())
    return f"[{pairs}]"
