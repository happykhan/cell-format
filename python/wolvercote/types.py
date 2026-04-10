from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


Attributes = dict[str, str]


@dataclass
class MGENode:
    label: str
    children: list[MGENode] = field(default_factory=list)
    attributes: Attributes = field(default_factory=dict)
    size_bp: Optional[int] = None  # genomic size, if known


@dataclass
class ChromosomeNode:
    label: str
    children: list[MGENode] = field(default_factory=list)
    attributes: Attributes = field(default_factory=dict)
    size_bp: Optional[int] = None


Replicon = ChromosomeNode | MGENode


@dataclass
class Cell:
    replicons: list[Replicon]


@dataclass
class CellSet:
    cells: list[Cell]
