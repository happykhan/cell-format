"""
SVG renderer for Wolvercote CellSet objects.

Produces circular diagrams:
  - Chromosomes: large blue circles
  - Plasmids / other MGEs: smaller green circles
  - Nested MGEs: coloured rectangles positioned on the parent circle border
  - Labels: text near each element
"""

from __future__ import annotations
import math
import xml.etree.ElementTree as ET
from .types import Cell, CellSet, ChromosomeNode, MGENode

# Colours
CHR_FILL = "#dde8f8"
CHR_STROKE = "#3a6fba"
CHR_STROKE_W = 8

MGE_FILL = "#e6f5e6"
MGE_STROKE = "#3a9943"
MGE_STROKE_W = 5

ELEMENT_COLOURS = ["#e05252", "#9b59b6", "#f39c12", "#16a085", "#2980b9", "#e74c3c"]


def _element_colour(label: str, index: int) -> str:
    l = label.lower()
    if any(k in l for k in ("transposon", "tn")):
        return "#e05252"
    if any(k in l for k in ("integron", "int")):
        return "#9b59b6"
    if any(k in l for k in ("phage", "prophage")):
        return "#f39c12"
    return ELEMENT_COLOURS[index % len(ELEMENT_COLOURS)]


def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


class _SVGBuilder:
    """Minimal SVG builder using xml.etree."""

    def __init__(self, width: int, height: int) -> None:
        self.root = ET.Element(
            "svg",
            xmlns="http://www.w3.org/2000/svg",
            width=str(width),
            height=str(height),
            viewBox=f"0 0 {width} {height}",
        )

    def circle(self, cx: float, cy: float, r: float, fill: str, stroke: str, stroke_width: int) -> None:
        ET.SubElement(
            self.root, "circle",
            cx=f"{cx:.1f}", cy=f"{cy:.1f}", r=f"{r:.1f}",
            fill=fill, stroke=stroke, **{"stroke-width": str(stroke_width)},
        )

    def rect(self, x: float, y: float, w: float, h: float, fill: str, transform: str = "") -> None:
        el = ET.SubElement(
            self.root, "rect",
            x=f"{x:.1f}", y=f"{y:.1f}",
            width=f"{w:.1f}", height=f"{h:.1f}",
            fill=fill, rx="2",
        )
        if transform:
            el.set("transform", transform)

    def text(self, x: float, y: float, content: str, font_size: int = 13,
             anchor: str = "middle", fill: str = "#333") -> None:
        el = ET.SubElement(
            self.root, "text",
            x=f"{x:.1f}", y=f"{y:.1f}",
            **{"text-anchor": anchor, "font-size": str(font_size),
               "fill": fill, "font-family": "Inter, sans-serif"},
        )
        el.text = content

    def line(self, x1: float, y1: float, x2: float, y2: float,
             stroke: str = "#ccc", stroke_width: float = 1.5, dasharray: str = "") -> None:
        el = ET.SubElement(
            self.root, "line",
            x1=f"{x1:.1f}", y1=f"{y1:.1f}", x2=f"{x2:.1f}", y2=f"{y2:.1f}",
            stroke=stroke, **{"stroke-width": str(stroke_width)},
        )
        if dasharray:
            el.set("stroke-dasharray", dasharray)

    def to_string(self) -> str:
        ET.indent(self.root, space="  ")
        return ET.tostring(self.root, encoding="unicode", xml_declaration=False)


def _render_nested(
    elements: list[MGENode],
    parent_x: float,
    parent_y: float,
    parent_r: float,
    svg: _SVGBuilder,
) -> None:
    n = len(elements)
    for i, el in enumerate(elements):
        angle = (2 * math.pi * i / n) - math.pi / 2
        bx = parent_x + parent_r * math.cos(angle)
        by = parent_y + parent_r * math.sin(angle)
        colour = _element_colour(el.label, i)
        w, h = 16.0, 10.0
        deg = math.degrees(angle) + 90
        svg.rect(
            bx - w / 2, by - h / 2, w, h, colour,
            transform=f"rotate({deg:.1f},{bx:.1f},{by:.1f})",
        )
        if el.label:
            lx = parent_x + (parent_r + 22) * math.cos(angle)
            ly = parent_y + (parent_r + 22) * math.sin(angle)
            svg.text(lx, ly, el.label, font_size=12)


def _render_chromosome(ch: ChromosomeNode, x: float, y: float, r: float, svg: _SVGBuilder) -> None:
    svg.circle(x, y, r, CHR_FILL, CHR_STROKE, CHR_STROKE_W)
    if ch.label:
        svg.text(x, y + r * 0.55, ch.label, font_size=14)
    _render_nested(ch.children, x, y, r, svg)


def _render_mge_circle(mge: MGENode, x: float, y: float, r: float, svg: _SVGBuilder) -> None:
    svg.circle(x, y, r, MGE_FILL, MGE_STROKE, MGE_STROKE_W)
    if mge.label:
        svg.text(x, y - r - 8, mge.label, font_size=13)
    _render_nested(mge.children, x, y, r, svg)


def _render_cell(cell: Cell, offset_x: float, svg: _SVGBuilder) -> float:
    chromosomes = [r for r in cell.replicons if isinstance(r, ChromosomeNode)]
    mges = [r for r in cell.replicons if isinstance(r, MGENode)]

    chr_r = 90.0
    mge_r = 42.0
    pad = 20.0
    cur_y = chr_r + pad + 30

    max_x = offset_x

    for ch in chromosomes:
        _render_chromosome(ch, offset_x + chr_r + pad, cur_y, chr_r, svg)
        cur_y += chr_r * 2 + pad
        max_x = max(max_x, offset_x + chr_r * 2 + pad * 2)

    mge_x = offset_x + chr_r * 2 + pad * 3 + mge_r
    mge_y = mge_r + pad + 30

    for mge in mges:
        _render_mge_circle(mge, mge_x, mge_y, mge_r, svg)
        mge_y += mge_r * 2 + pad + 30
        max_x = max(max_x, mge_x + mge_r + pad * 2 + 40)

    return max_x


def render_svg(cell_set: CellSet, width: int = 800, height: int = 320) -> str:
    """Render a CellSet to an SVG string."""
    svg = _SVGBuilder(width, height)
    x = 10.0

    for i, cell in enumerate(cell_set.cells):
        x = _render_cell(cell, x, svg)
        if i < len(cell_set.cells) - 1:
            svg.line(x, 10, x, height - 10, dasharray="6,4")
            x += 20

    return svg.to_string()
