# Published containment relationships from Sheppard et al. (2016)

Six plasmid components from four *Klebsiella pneumoniae* isolates illustrate the relationships established in [Sheppard et al., 2016](https://doi.org/10.1128/AAC.00464-16). These records encode selected published relationships, not new sequence annotation or transmission inference. Original GenBank downloads are preserved unchanged in the manuscript review archive.

`structures.json` identifies the evidence for each manually represented relationship. `records/` contains the CellGen component records and their SVG views. `collection.cellgen` groups the selected components into four cells by isolate; these are partial descriptions of those genomes. `query-results.tsv` and `query-results.json` report the results of querying the parsed records.

## Sources and scope

The versioned accessions were downloaded from BioProject [PRJNA246471](https://www.ncbi.nlm.nih.gov/bioproject/PRJNA246471) on 21 October 2026. The paper's Figure 2 establishes the pKPC_UVA01-like grouping and the absence of Tn4401 from pCAV1344-40. Table 1 establishes the positive structures and enclosing Tn2-like contexts. Figure 3 and its accompanying text identify Tn1331 in pKPC_CAV1344 and pKPC_CAV1596-78. Table 1 footnote g and the Discussion link the index pKPC_UVA01 structure to its published group and nested context.

The GenBank files do not annotate complete MGE boundaries. Consequently, the nesting in these examples is curated from the publication, with no nucleotide boundaries added. `blaKPC` denotes the gene family, not an inferred allele. `plasmid_group` preserves the authors' grouping; `singleton` means distinct from the other reported groups and does not assert that the singleton plasmids match one another. Tn1331 is a member of the Tn2-like family. No additional genes, insertion-site sequences or rearrangements are represented.

Absence is recorded only for the plasmid explicitly shown to lack Tn4401 in the paper, using `tn4401_status="absent"`. An empty child list in any other imported record must not be read as biological absence. Likewise, a shared label or containment path does not establish sequence identity or a transmission event.

## Reproduce

Run from the repository root with Python 3.10 or later; no extra packages are required:

```sh
python3 examples/sheppard2016/prepare_examples.py
```

The script builds the six publication-derived records, verifies their parse/serialise round trips, and runs four structural queries. The four-isolate collection can be pasted directly into the [browser visualiser](https://cell-format.vercel.app/).


To regenerate the containment SVGs and composed manuscript Figure 3 with the browser renderer, compile the TypeScript modules and run the composition script:

```sh
webapp/node_modules/.bin/tsc webapp/src/cellgen/parser.ts webapp/src/cellgen/types.ts webapp/src/cellgen/containmentRenderer.ts --outDir /tmp/cellgen-sheppard-parser --module es2022 --target es2022 --moduleResolution bundler --skipLibCheck --strict
printf '{"type":"module"}\n' > /tmp/cellgen-sheppard-parser/package.json
node examples/sheppard2016/render_figure.mjs /tmp/cellgen-sheppard-parser
rsvg-convert -w 2400 -o figures/Figure_3_Sheppard_collection.png figures/Figure_3_Sheppard_collection.svg
rsvg-convert -f pdf -o figures/Figure_3_Sheppard_collection.pdf figures/Figure_3_Sheppard_collection.svg
```

This requires the webapp development dependencies and librsvg. The renderer checks that every named entity is visible in each containment SVG and that the line-broken display records still parse. [Figure 3](../../figures/Figure_3_Sheppard_collection.png) is provided in PNG, SVG and PDF formats.
