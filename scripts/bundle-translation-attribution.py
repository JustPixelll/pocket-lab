"""Bundle an original attribution badge from Google's official badge archive."""
from pathlib import Path
import hashlib
import struct
import sys
import zipfile

archive_path, output_path = map(Path, sys.argv[1:])
choices = []
with zipfile.ZipFile(archive_path) as archive:
    print('Official badge archive:', ', '.join(archive.namelist()))
    for item in archive.infolist():
        name = item.filename.lower()
        if item.is_dir() or not name.endswith('.png') or '__macosx' in name or item.file_size > 2_000_000:
            continue
        content = archive.read(item)
        if not content.startswith(bytes.fromhex('89504e470d0a1a0a')):
            continue
        width, height = struct.unpack('>II', content[16:24])
        if height < 8 or width < 80 or width / height < 3:
            continue
        # Prefer the full-color, powered-by variant. Keep original image bytes.
        score = 8 * ('powered' in name) + 4 * ('color' in name or 'colour' in name)
        score += 2 * ('translate' in name)
        score -= 6 * any(part in name for part in ('gray', 'grey', 'mono', 'white', 'dark'))
        choices.append((score, item.filename, content, width, height))
if not choices:
    raise SystemExit('The official archive contained no standalone PNG attribution badge')
choices.sort(key=lambda entry: (-entry[0], entry[1]))
_, name, content, width, height = choices[0]
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_bytes(content)
print(f'Bundled unmodified badge {name}: {width}×{height}, SHA-256 {hashlib.sha256(content).hexdigest()}')
