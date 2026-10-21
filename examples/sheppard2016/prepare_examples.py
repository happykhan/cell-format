"""Render and query publication-derived containment examples, without sequence inference."""

from collections import defaultdict
import csv
from dataclasses import asdict
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'python'))
from cellgen import parse, to_cellgen
from cellgen.types import Cell, CellSet, EntityNode

DOI = '10.1128/AAC.00464-16'


def walk(node, ancestors=()):
    yield node, ancestors
    for child in node.children:
        yield from walk(child, (*ancestors, node))


def compact(node):
    """Keep labels and explicit published absence for the manuscript display."""
    attributes = {'tn4401_status': 'absent'} if node.attributes.get('tn4401_status') == 'absent' else {}
    return EntityNode(node.label, [compact(child) for child in node.children], attributes)


def main():
    specifications = json.loads((HERE / 'structures.json').read_text())
    records = HERE / 'records'
    records.mkdir(exist_ok=True)
    cells = defaultdict(list)
    contexts, trees = [], []
    for entry in specifications:
        children = []
        if entry['tn4401'] == 'present':
            gene = EntityNode('blaKPC', attributes={'type': 'gene'})
            element = EntityNode('Tn4401', [gene], {'type': 'transposon'})
            if entry['outer_element']:
                element = EntityNode(entry['outer_element'], [element], {'type': 'transposon'})
            children = [element]
        root = EntityNode(entry['plasmid'], children, {
            'type': 'plasmid', 'accession': entry['accession'],
            'isolate': entry['isolate'], 'plasmid_group': entry['plasmid_group'],
            'tn4401_status': entry['tn4401'], 'evidence': 'publication', 'source_doi': DOI,
        })
        cellset = CellSet([Cell([root])])
        text = to_cellgen(cellset)
        parsed = parse(text)
        assert asdict(parsed) == asdict(cellset), entry['record']
        (records / (entry['record'] + '.cellgen')).write_text(text + '\n')
        trees.append({'record': entry['record'], 'cellgen': text, 'tree': asdict(parsed)})
        cells[entry['isolate']].append(root)
        matches = [(node, ancestors) for node, ancestors in walk(parsed.cells[0].replicons[0])
                   if node.attributes.get('type') == 'gene']
        assert len(matches) == (1 if entry['tn4401'] == 'present' else 0)
        ancestors = matches[0][1] if matches else ()
        contexts.append({
            'isolate': entry['isolate'], 'plasmid': root.label, 'accession': entry['accession'],
            'published_group': root.attributes['plasmid_group'],
            'Tn4401': 'represented' if matches else 'published absence',
            'outer_element': next((a.label for a in ancestors
                                   if a.attributes.get('type') == 'transposon'
                                   and a.label != 'Tn4401'), 'not represented'),
            'gene_to_plasmid': ' > '.join([matches[0][0].label] + [a.label for a in reversed(ancestors)])
                               if matches else 'not applicable',
            'cellgen_display': to_cellgen(CellSet([Cell([compact(root)])])),
        })
        assert to_cellgen(parse(contexts[-1]['cellgen_display'])) == contexts[-1]['cellgen_display']
    collection = CellSet([Cell(roots) for roots in cells.values()])
    text = to_cellgen(collection)
    assert asdict(parse(text)) == asdict(collection)
    (HERE / 'collection.cellgen').write_text(text + '\n')
    queries = [
        {'query': 'plasmid_group equals pKPC_UVA01',
         'matches': [r['plasmid'] for r in contexts if r['published_group'] == 'pKPC_UVA01']},
        {'query': 'Tn4401 descendant is represented',
         'matches': [r['plasmid'] for r in contexts if r['Tn4401'] == 'represented']},
        {'query': 'Tn4401 has an enclosing Tn2-like element or Tn1331',
         'matches': [r['plasmid'] for r in contexts if r['outer_element'] != 'not represented']},
        {'query': 'published tn4401_status equals absent',
         'matches': [r['plasmid'] for r in contexts if r['Tn4401'] == 'published absence']},
    ]
    assert [len(q['matches']) for q in queries] == [3, 5, 4, 1]
    result = {'contexts': contexts, 'queries': queries}
    (HERE / 'query-results.json').write_text(json.dumps(result, indent=2) + '\n')
    (HERE / 'validation-trees.json').write_text(json.dumps(trees, indent=2) + '\n')
    with (HERE / 'query-results.tsv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(contexts[0]), delimiter='\t')
        writer.writeheader()
        writer.writerows(contexts)
    print('Verified six component records, one four-isolate collection and four structural queries.')


if __name__ == '__main__':
    main()
