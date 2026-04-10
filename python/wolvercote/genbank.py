"""
GenBank and GFF3 → Wolvercote converter.

Requires BioPython for GenBank parsing.
GFF3 parsing is built-in (no extra dependency).

Usage:
    from wolvercote.genbank import from_genbank_file, from_gff_file, from_mobsuite

    cell_set = from_genbank_file("assembly.gbk")
    cell_set = from_gff_file("annotation.gff")
    cell_set = from_mobsuite("mob_recon_results/")
"""

from __future__ import annotations
import re
from pathlib import Path
from .types import Attributes, Cell, CellSet, ChromosomeNode, MGENode, Replicon

# Feature types considered MGEs
_MGE_FEATURE_TYPES = {
    "mobile_element", "transposon", "insertion_sequence",
    "integron", "repeat_region", "misc_feature",
}

# Keywords in /mobile_element_type or /note qualifiers
_TRANSPOSON_KW = {"transposon", "tn", "is", "insertion"}
_INTEGRON_KW = {"integron", "intg", "integrase"}
_PHAGE_KW = {"phage", "prophage", "bacteriophage"}

# MOB-suite chromosome classification
_CHR_MOB_TYPES = {"chromosome", "chromosome,chromosome"}


def _classify_qualifier(qualifier_text: str) -> str:
    """Return a cleaned label from a GenBank qualifier string."""
    # strip mobile_element_type prefix e.g. "transposon:Tn3"
    label = qualifier_text.split(":")[-1]
    label = re.sub(r"[^a-zA-Z0-9_\-. ]", "", label).strip()
    return label


# ── GenBank ───────────────────────────────────────────────────────────────────

def from_genbank_file(path: str | Path) -> CellSet:
    """Parse a GenBank file (may contain multiple records) → CellSet."""
    try:
        from Bio import SeqIO  # type: ignore[import-untyped]
    except ImportError as e:
        raise ImportError("BioPython is required for GenBank parsing: pip install biopython") from e

    replicons: list[Replicon] = []
    for record in SeqIO.parse(str(path), "genbank"):
        rep_type = _classify_gb_record(record)
        mges = _extract_gb_mges(record)
        label = record.name or record.id
        size = len(record.seq) if record.seq else None

        if rep_type == "chromosome":
            replicons.append(ChromosomeNode(label=label, children=mges, size_bp=size))
        else:
            replicons.append(MGENode(label=label, children=mges, size_bp=size))

    return CellSet(cells=[Cell(replicons=replicons)])


def _classify_gb_record(record) -> str:  # type: ignore[no-untyped-def]
    """Chromosome or plasmid based on DEFINITION / keywords."""
    definition = record.description.lower()
    if "plasmid" in definition:
        return "plasmid"
    if "chromosome" in definition:
        return "chromosome"
    # Check source feature
    for feat in record.features:
        if feat.type == "source":
            if "plasmid" in feat.qualifiers:
                return "plasmid"
    return "chromosome"


def _extract_gb_mges(record) -> list[MGENode]:  # type: ignore[no-untyped-def]
    seen: set[str] = set()
    mges: list[MGENode] = []
    for feat in record.features:
        if feat.type.lower() not in _MGE_FEATURE_TYPES:
            continue
        # Get label from qualifiers
        label = ""
        for q in ("mobile_element_type", "note", "gene", "locus_tag"):
            if q in feat.qualifiers:
                label = _classify_qualifier(feat.qualifiers[q][0])
                break
        if not label:
            label = feat.type
        if label not in seen:
            seen.add(label)
            size = len(feat.location) if feat.location else None
            mges.append(MGENode(label=label, size_bp=size))
    return mges


# ── GFF3 ──────────────────────────────────────────────────────────────────────

def from_gff_file(path: str | Path) -> CellSet:
    """Parse a GFF3 file → CellSet."""
    seq_info: dict[str, dict] = {}  # seq_id → {type, label, mges, size}

    with open(path) as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("##FASTA"):
                break
            if line.startswith("##sequence-region"):
                parts = line.split()
                seq_id = parts[1]
                if seq_id not in seq_info:
                    seq_info[seq_id] = {
                        "type": _guess_type_from_id(seq_id),
                        "label": seq_id,
                        "mges": [],
                        "seen_mges": set(),
                        "size": int(parts[3]) if len(parts) > 3 else None,
                    }
                continue
            if line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) < 9:
                continue
            seq_id, _, feat_type, start, end, _, _, _, attrs_str = cols[:9]
            feat_type = feat_type.lower()

            if seq_id not in seq_info:
                seq_info[seq_id] = {
                    "type": _guess_type_from_id(seq_id),
                    "label": seq_id,
                    "mges": [],
                    "seen_mges": set(),
                    "size": None,
                }
            info = seq_info[seq_id]

            if feat_type == "chromosome":
                info["type"] = "chromosome"
            elif feat_type in ("plasmid", "mobile_genetic_element"):
                info["type"] = "plasmid"

            _MGE_GFF_TYPES = {
                "mobile_genetic_element", "transposable_element", "transposon",
                "insertion_sequence", "integron", "repeat_region",
            }
            if feat_type in _MGE_GFF_TYPES:
                attrs = _parse_gff_attrs(attrs_str)
                label = attrs.get("Name") or attrs.get("ID") or feat_type
                label = label.split(":")[-1]
                label = re.sub(r"[^a-zA-Z0-9_\-. ]", "", label).strip()
                size = int(end) - int(start) + 1 if start.isdigit() and end.isdigit() else None
                if label and label not in info["seen_mges"]:
                    info["seen_mges"].add(label)
                    info["mges"].append(MGENode(label=label, size_bp=size))

    replicons: list[Replicon] = []
    for info in seq_info.values():
        label = info["label"]
        mges = info["mges"]
        size = info["size"]
        if info["type"] == "chromosome":
            replicons.append(ChromosomeNode(label=label, children=mges, size_bp=size))
        else:
            replicons.append(MGENode(label=label, children=mges, size_bp=size))

    return CellSet(cells=[Cell(replicons=replicons)])


def _parse_gff_attrs(s: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for part in s.split(";"):
        if "=" in part:
            k, _, v = part.partition("=")
            attrs[k.strip()] = v.strip()
    return attrs


def _guess_type_from_id(seq_id: str) -> str:
    l = seq_id.lower()
    if any(k in l for k in ("plasmid", "pbad", "plas")):
        return "plasmid"
    if any(k in l for k in ("chromosome", "chr", "genome")):
        return "chromosome"
    return "chromosome"


# ── MOB-suite ─────────────────────────────────────────────────────────────────

def from_mobsuite(results_dir: str | Path) -> CellSet:
    """
    Parse MOB-suite (mob_recon) output directory → CellSet.

    Expected files:
      chromosome.fasta / chromosome.gbk  — chromosomal contigs
      plasmid_*.fasta / plasmid_*.gbk    — plasmid contigs
      mobtyper_results.txt               — replicon type classifications
    """
    results_dir = Path(results_dir)
    replicons: list[Replicon] = []

    # Read contig report if present
    contig_report = results_dir / "contig_report.txt"
    mob_results: dict[str, dict] = {}
    if contig_report.exists():
        with open(contig_report) as fh:
            headers = fh.readline().strip().split("\t")
            for line in fh:
                row = dict(zip(headers, line.strip().split("\t")))
                mob_results[row.get("contig_id", "")] = row

    # chromosome.fasta → ChromosomeNode
    chr_fasta = results_dir / "chromosome.fasta"
    if chr_fasta.exists():
        from .utils import parse_fasta_headers
        for header, size in parse_fasta_headers(chr_fasta):
            replicons.append(ChromosomeNode(label=header, size_bp=size))

    # plasmid_*.fasta → MGENode
    for plas_file in sorted(results_dir.glob("plasmid_*.fasta")):
        from .utils import parse_fasta_headers
        for header, size in parse_fasta_headers(plas_file):
            label = plas_file.stem  # e.g. plasmid_1
            # Get replicon type from mob_results if available
            attrs: Attributes = {}
            if header in mob_results:
                row = mob_results[header]
                if row.get("rep_type(s)"):
                    attrs["rep_type"] = row["rep_type(s)"]
                if row.get("mob_type(s)"):
                    attrs["mob_type"] = row["mob_type(s)"]
            replicons.append(MGENode(label=label, size_bp=size, attributes=attrs))

    if not replicons:
        raise ValueError(
            f"No MOB-suite output files found in {results_dir}. "
            "Expected chromosome.fasta and/or plasmid_*.fasta."
        )

    return CellSet(cells=[Cell(replicons=replicons)])
