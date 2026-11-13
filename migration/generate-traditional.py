"""Refresh compact Traditional UI copy using OpenCC s2t; never processes user data.

Requires the build-time package opencc-python-reimplemented. The generated JSON
is checked in locally, so normal apply-ui.py builds do not need this package.
"""
from pathlib import Path
import ast, json
from opencc import OpenCC

ui = Path(__file__).parent / 'ui'
texts = [line.split('|')[0] for line in (ui / 'translations.tsv').read_text(encoding='utf-8').splitlines() if line.strip()]
def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, list):
        for child in value: yield from strings(child)
    elif isinstance(value, dict):
        for child in value.values(): yield from strings(child)
texts += list(strings(json.loads((ui / 'user-guide.json').read_text(encoding='utf-8'))))
texts += [node.value for node in ast.walk(ast.parse((ui.parent / 'user-guide-ui.py').read_text(encoding='utf-8'))) if isinstance(node, ast.Constant) and isinstance(node.value, str)]
converter = OpenCC('s2t')
mapping = {char: converter.convert(char) for char in sorted(set(''.join(texts))) if converter.convert(char) != char}
assert all(len(value) == 1 for value in mapping.values())
phrases = {text: converter.convert(text) for text in texts if ''.join(mapping.get(char, char) for char in text) != converter.convert(text)}
data = {'pairs': ''.join(char + value for char, value in mapping.items()), 'phrases': phrases}
(ui / 'traditional-data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'characters': len(mapping), 'contextualPhrases': len(phrases)}, ensure_ascii=False))
