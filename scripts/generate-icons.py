#!/usr/bin/env python3
"""
Generate crisp flat/vectorized multi-resolution icons (16px, 32px, 48px, 128px, 512px)
for Schema DevTools.
"""

from pathlib import Path
from PIL import Image

def main():
    root = Path(__file__).resolve().parent.parent
    icons_dir = root / 'assets' / 'icons'
    icons_dir.mkdir(parents=True, exist_ok=True)
    
    # Base high-res flat vector master
    master_path = icons_dir / 'icon-512.png'
    if not master_path.exists():
        print(f'Master icon {master_path} not found.')
        return
        
    master = Image.open(master_path).convert('RGBA')
    for size in [16, 32, 48, 128, 512]:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        out_file = icons_dir / f'icon-{size}.png'
        resized.save(out_file)
        print(f'Rendered {out_file} ({size}x{size})')

if __name__ == '__main__':
    main()
