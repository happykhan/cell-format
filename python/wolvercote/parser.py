"""
Wolvercote format parser.

Grammar:
  CellSet     → Cell (';' Cell)*
  Cell        → Replicon (',' Replicon)*
  Replicon    → Chromosome | MGE
  Chromosome  → '(' MGE* ')' Label AttributeSet?
  MGE         → '{' MGE* '}' Label AttributeSet?
  Label       → string | empty
  AttributeSet→ '[' KeyValue (',' KeyValue)* ']'
  KeyValue    → Key '=' '"' Value '"'
"""

from __future__ import annotations
from .types import Attributes, Cell, CellSet, ChromosomeNode, MGENode, Replicon


class ParseError(Exception):
    def __init__(self, message: str, position: int, found: str = ""):
        super().__init__(message)
        self.position = position
        self.found = found

    def __str__(self) -> str:
        loc = f" (at position {self.position})" if self.position else ""
        return f"{self.args[0]}{loc}"


class _Parser:
    def __init__(self, text: str) -> None:
        self._text = text
        self._pos = 0

    def _peek(self) -> str:
        self._skip_ws()
        return self._text[self._pos] if self._pos < len(self._text) else ""

    def _consume(self) -> str:
        self._skip_ws()
        if self._pos >= len(self._text):
            return ""
        ch = self._text[self._pos]
        self._pos += 1
        return ch

    def _skip_ws(self) -> None:
        while self._pos < len(self._text) and self._text[self._pos].isspace():
            self._pos += 1

    def _expect(self, ch: str) -> None:
        got = self._consume()
        if got != ch:
            raise ParseError(
                f"Expected '{ch}' but found '{got or 'end of input'}'",
                self._pos,
                got,
            )

    def parse_cell_set(self) -> CellSet:
        cells = [self._parse_cell()]
        while self._peek() == ";":
            self._consume()
            if not self._peek():
                break
            cells.append(self._parse_cell())
        if self._peek():
            raise ParseError(
                f"Unexpected character '{self._peek()}' after end of expression",
                self._pos,
                self._peek(),
            )
        return CellSet(cells=cells)

    def _parse_cell(self) -> Cell:
        replicons = [self._parse_replicon()]
        while self._peek() == ",":
            self._consume()
            nxt = self._peek()
            if nxt not in ("(", "{"):
                raise ParseError(
                    f"Expected '(' or '{{' after ',' but found '{nxt or 'end of input'}'",
                    self._pos,
                )
            replicons.append(self._parse_replicon())
        return Cell(replicons=replicons)

    def _parse_replicon(self) -> Replicon:
        nxt = self._peek()
        if nxt == "(":
            return self._parse_chromosome()
        elif nxt == "{":
            return self._parse_mge()
        else:
            raise ParseError(
                f"Expected '(' for chromosome or '{{' for MGE but found '{nxt or 'end of input'}'",
                self._pos,
            )

    def _parse_chromosome(self) -> ChromosomeNode:
        self._expect("(")
        children: list[MGENode] = []
        while self._peek() != ")":
            if not self._peek():
                raise ParseError("Unclosed '(' — missing ')'", self._pos)
            children.append(self._parse_mge())
            if self._peek() == ",":
                self._consume()
        self._expect(")")
        label = self._parse_label()
        attributes = self._parse_attributes()
        return ChromosomeNode(label=label, children=children, attributes=attributes)

    def _parse_mge(self) -> MGENode:
        self._expect("{")
        children: list[MGENode] = []
        while self._peek() != "}":
            if not self._peek():
                raise ParseError("Unclosed '{' — missing '}'", self._pos)
            children.append(self._parse_mge())
            if self._peek() == ",":
                self._consume()
        self._expect("}")
        label = self._parse_label()
        attributes = self._parse_attributes()
        return MGENode(label=label, children=children, attributes=attributes)

    def _parse_label(self) -> str:
        self._skip_ws()
        label = []
        special = set("(){}[],;=\"")
        while self._pos < len(self._text) and self._text[self._pos] not in special:
            label.append(self._text[self._pos])
            self._pos += 1
        return "".join(label).strip()

    def _parse_attributes(self) -> Attributes:
        self._skip_ws()
        if self._peek() != "[":
            return {}
        self._consume()
        attrs: Attributes = {}
        while self._peek() != "]":
            if not self._peek():
                raise ParseError("Unclosed '[' — missing ']'", self._pos)
            key = self._parse_attr_key()
            self._skip_ws()
            self._expect("=")
            self._skip_ws()
            self._expect('"')
            value = self._parse_attr_value()
            self._expect('"')
            attrs[key] = value
            self._skip_ws()
            if self._peek() == ",":
                self._consume()
        self._expect("]")
        return attrs

    def _parse_attr_key(self) -> str:
        self._skip_ws()
        key = []
        while self._pos < len(self._text) and self._text[self._pos] not in ("=", '"', "]"):
            key.append(self._text[self._pos])
            self._pos += 1
        return "".join(key).strip()

    def _parse_attr_value(self) -> str:
        value = []
        while self._pos < len(self._text) and self._text[self._pos] != '"':
            value.append(self._text[self._pos])
            self._pos += 1
        return "".join(value)


def parse(text: str) -> CellSet:
    """Parse a Wolvercote format string into a CellSet.

    Raises ParseError with a descriptive message if the string is invalid.
    """
    stripped = text.strip()
    if not stripped:
        raise ParseError("Input is empty", 0)
    return _Parser(stripped).parse_cell_set()


def validate(text: str) -> list[str]:
    """Return a list of error messages. Empty list means valid."""
    try:
        parse(text)
        return []
    except ParseError as e:
        return [str(e)]


def is_valid(text: str) -> bool:
    """Return True if the string is a valid Wolvercote format."""
    return len(validate(text)) == 0
