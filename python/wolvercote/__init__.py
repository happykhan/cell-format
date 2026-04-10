"""
wolvercote — Python library for the Wolvercote bacterial genome organisation format.

Quick start::

    from wolvercote import parse, validate, is_valid, render_svg, to_wolvercote

    cell_set = parse("()chr1, {}pBAD")
    print(to_wolvercote(cell_set))   # round-trip

    svg = render_svg(cell_set)
    with open("diagram.svg", "w") as f:
        f.write(svg)

    errors = validate("()unclosed")
    print(errors)   # ["Position 10: Unclosed '(' — missing ')'"]

GenBank / GFF3 import::

    from wolvercote.genbank import from_genbank_file, from_gff_file, from_mobsuite

    cell_set = from_genbank_file("assembly.gbk")
    cell_set = from_gff_file("annotation.gff3")
    cell_set = from_mobsuite("mob_recon_output/")
"""

from .parser import ParseError, is_valid, parse, validate
from .renderer import render_svg
from .serialise import to_wolvercote

__version__ = "0.1.0"
__all__ = [
    "parse",
    "validate",
    "is_valid",
    "render_svg",
    "to_wolvercote",
    "ParseError",
    "__version__",
]
