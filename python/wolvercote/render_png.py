"""
Publication-quality PNG renderer using matplotlib.
Matches the Wolvercote spec sample image style.
Features: legend, nested containment visualisation, 2-column MGE grid.
"""

from __future__ import annotations
import math
import io
from pathlib import Path
from .types import Cell, CellSet, ChromosomeNode, MGENode

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    HAS_MPL = True
except ImportError:
    HAS_MPL = False

CHR_COLOUR = "#3a6fba"
CHR_FILL   = "#dde8f8"
MGE_COLOUR = "#3a9943"
MGE_FILL   = "#e6f5e6"

ELEMENT_COLOURS = {
    "transposon": "#e05252",
    "tn":         "#e05252",
    "integron":   "#9b59b6",
    "int":        "#9b59b6",
    "phage":      "#f39c12",
    "prophage":   "#f39c12",
    "is":         "#f39c12",
    "insertion":  "#f39c12",
    "blakpc":     "#16a085",
    "bla":        "#16a085",
}
FALLBACK_COLOURS = ["#e05252", "#9b59b6", "#f39c12", "#16a085", "#2980b9"]


def _elem_colour(label: str, idx: int) -> str:
    l = label.lower()
    for k, c in ELEMENT_COLOURS.items():
        if k in l:
            return c
    return FALLBACK_COLOURS[idx % len(FALLBACK_COLOURS)]


def _draw_nested(ax, elements: list[MGENode], cx: float, cy: float, r: float,
                 depth: int = 0) -> None:
    """Draw nested MGE elements on the border of a circle.

    depth > 0 means these are children of a border element (shown as small
    stripes inside their parent rectangle rather than additional border marks).
    """
    n = len(elements)
    start = math.pi / 4  # avoid top where label sits
    for i, el in enumerate(elements):
        angle = start + (2 * math.pi * i / n)
        bx = cx + r * math.cos(angle)
        by = cy + r * math.sin(angle)
        colour = _elem_colour(el.label, i)
        deg = math.degrees(angle) + 90

        w, h = (0.11, 0.07) if depth == 0 else (0.07, 0.045)
        rect = mpatches.FancyBboxPatch(
            (-w / 2, -h / 2), w, h,
            boxstyle="round,pad=0.004",
            facecolor=colour, edgecolor="white", linewidth=0.5,
            transform=ax.transData, zorder=5 + depth,
        )
        t = matplotlib.transforms.Affine2D().rotate_deg(deg).translate(bx, by) + ax.transData
        rect.set_transform(t)
        ax.add_patch(rect)

        # Show nested children as small stripes inside the parent rect
        if el.children:
            for j, child in enumerate(el.children):
                child_colour = _elem_colour(child.label, j)
                offset = (j - (len(el.children) - 1) / 2) * (w * 0.55)
                cr = mpatches.FancyBboxPatch(
                    (-0.025, -0.015), 0.05, 0.03,
                    boxstyle="round,pad=0.002",
                    facecolor=child_colour, edgecolor="white", linewidth=0.3,
                    transform=ax.transData, zorder=7,
                )
                ct = (matplotlib.transforms.Affine2D()
                      .rotate_deg(deg)
                      .translate(bx + offset * math.cos(angle + math.pi / 2),
                                 by + offset * math.sin(angle + math.pi / 2))
                      + ax.transData)
                cr.set_transform(ct)
                ax.add_patch(cr)

        # Label outward
        lx = cx + (r + 0.19) * math.cos(angle)
        ly = cy + (r + 0.19) * math.sin(angle)
        if el.label:
            ax.text(lx, ly, el.label,
                    ha="center", va="center",
                    fontsize=7.5, color="#333",
                    fontfamily="sans-serif", zorder=6)


def _draw_chromosome(ax, ch: ChromosomeNode, cx: float, cy: float, r: float) -> None:
    circle = plt.Circle((cx, cy), r, facecolor=CHR_FILL, edgecolor=CHR_COLOUR,
                         linewidth=5, zorder=2)
    ax.add_patch(circle)
    if ch.label:
        ax.text(cx, cy, ch.label, ha="center", va="center",
                fontsize=11, color="#333", fontfamily="sans-serif", zorder=3)
    _draw_nested(ax, ch.children, cx, cy, r)


def _draw_mge(ax, mge: MGENode, cx: float, cy: float, r: float) -> None:
    circle = plt.Circle((cx, cy), r, facecolor=MGE_FILL, edgecolor=MGE_COLOUR,
                         linewidth=3.5, zorder=2)
    ax.add_patch(circle)
    if mge.label:
        ax.text(cx, cy + r + 0.10, mge.label, ha="center", va="bottom",
                fontsize=8.5, color="#333", fontfamily="sans-serif", zorder=3)
    _draw_nested(ax, mge.children, cx, cy, r)


def _draw_legend(ax, x: float, y: float) -> None:
    """Draw a small legend at (x, y) in data units."""
    items = [
        (CHR_COLOUR, CHR_FILL, "circle", "Chromosome"),
        (MGE_COLOUR, MGE_FILL, "circle", "Plasmid / replicon"),
        ("#e05252", "#e05252", "rect",   "Transposon"),
        ("#9b59b6", "#9b59b6", "rect",   "Integron"),
        ("#f39c12", "#f39c12", "rect",   "IS element / phage"),
        ("#16a085", "#16a085", "rect",   "Resistance gene"),
    ]
    ax.text(x, y + 0.05, "Legend", fontsize=7, fontfamily="sans-serif",
            color="#666", va="bottom", fontweight="bold")
    for i, (edge, fill, shape, label) in enumerate(items):
        iy = y - i * 0.14
        if shape == "circle":
            p = plt.Circle((x + 0.055, iy), 0.05,
                            facecolor=fill, edgecolor=edge, linewidth=1.5, zorder=8)
            ax.add_patch(p)
        else:
            p = mpatches.FancyBboxPatch((x + 0.01, iy - 0.03), 0.09, 0.06,
                                        boxstyle="round,pad=0.005",
                                        facecolor=fill, edgecolor="white",
                                        linewidth=0.5, zorder=8)
            ax.add_patch(p)
        ax.text(x + 0.14, iy, label, fontsize=7, fontfamily="sans-serif",
                color="#444", va="center", zorder=9)


def _cell_dimensions(chrs: list, mges: list,
                      CHR_R: float, MGE_R: float, PAD: float) -> tuple[float, float]:
    n_mge = len(mges)
    mge_cols = 2 if n_mge > 2 else 1
    mge_rows = math.ceil(n_mge / mge_cols) if n_mge else 0

    col_w = MGE_R * 2 + PAD + 0.15
    col_h = MGE_R * 2 + PAD + 0.55

    chr_w = (CHR_R * 2 + PAD * 2) if chrs else 0
    mge_w = mge_cols * col_w + PAD if n_mge else 0
    width = chr_w + mge_w + PAD

    chr_h = max(len(chrs), 1) * (CHR_R * 2 + PAD)
    mge_h = mge_rows * col_h + PAD
    height = max(chr_h, mge_h, CHR_R * 2 + PAD * 2)
    return width, height


def render_png(
    cell_set: CellSet,
    dpi: int = 150,
    legend: bool = True,
    out_path: str | Path | None = None,
) -> bytes:
    """
    Render a CellSet to a PNG image.

    Parameters
    ----------
    cell_set : CellSet
    dpi : int
        Output resolution (default 150; use 300 for publication).
    legend : bool
        Whether to include a colour legend (default True).
    out_path : str or Path, optional
        If given, write PNG to this file path. Always returns bytes too.

    Returns
    -------
    bytes  PNG image data.
    """
    if not HAS_MPL:
        raise ImportError("matplotlib is required for PNG rendering: pip install matplotlib")

    CHR_R = 0.80
    MGE_R = 0.37
    PAD   = 0.22
    CELL_SEP = 0.45
    LEGEND_W = 1.1  # width reserved for legend

    cells = cell_set.cells
    n_cells = len(cells)

    cell_data = []
    for cell in cells:
        chrs = [r for r in cell.replicons if isinstance(r, ChromosomeNode)]
        mges = [r for r in cell.replicons if isinstance(r, MGENode)]
        w, h = _cell_dimensions(chrs, mges, CHR_R, MGE_R, PAD)
        cell_data.append((chrs, mges, w, h))

    total_w = sum(w for _, _, w, _ in cell_data) + (n_cells - 1) * CELL_SEP + PAD * 2
    if legend:
        total_w += LEGEND_W
    total_h = max(h for _, _, _, h in cell_data) + PAD * 2

    fig_w = max(total_w * 1.5, 4.0)
    fig_h = max(total_h * 1.5, 2.5)
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    ax.set_aspect("equal")
    ax.set_xlim(0, total_w)
    ax.set_ylim(0, total_h)
    ax.axis("off")
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    x = PAD
    mid_y = total_h / 2

    for ci, (chrs, mges, cw, ch) in enumerate(cell_data):
        n_mge = len(mges)
        mge_cols = 2 if n_mge > 2 else 1
        col_w = MGE_R * 2 + PAD + 0.15
        col_h = MGE_R * 2 + PAD + 0.55

        if chrs:
            total_chr_h = len(chrs) * (CHR_R * 2 + PAD) - PAD
            start_y = mid_y - total_chr_h / 2
            for i, chromo in enumerate(chrs):
                cx = x + CHR_R + PAD
                cy = start_y + i * (CHR_R * 2 + PAD) + CHR_R
                _draw_chromosome(ax, chromo, cx, cy, CHR_R)
            x += CHR_R * 2 + PAD * 2

        if mges:
            mge_rows = math.ceil(n_mge / mge_cols)
            grid_h = mge_rows * col_h
            start_gy = mid_y - grid_h / 2

            for i, mge in enumerate(mges):
                row, col = divmod(i, mge_cols)
                mx = x + col * col_w + MGE_R + PAD * 0.3
                my = start_gy + row * col_h + MGE_R + 0.40
                _draw_mge(ax, mge, mx, my, MGE_R)

            x += mge_cols * col_w + PAD

        x += PAD * 0.5

        if ci < n_cells - 1:
            sep_x = x + CELL_SEP / 2
            ax.axvline(sep_x, color="#cccccc", linestyle="--", linewidth=1, zorder=1)
            x += CELL_SEP

    if legend:
        _draw_legend(ax, x + PAD * 0.5, mid_y + 0.70)

    plt.tight_layout(pad=0.3)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    data = buf.read()

    if out_path:
        Path(out_path).write_bytes(data)

    return data
