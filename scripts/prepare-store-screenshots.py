from pathlib import Path
from PIL import Image, ImageOps

assets_dir = Path(__file__).parent.parent / 'assets'
store_dir = assets_dir / 'store'
raw_dir = assets_dir / 'raw'
store_dir.mkdir(parents=True, exist_ok=True)
raw_dir.mkdir(parents=True, exist_ok=True)

screenshots = [
    ('screenshot-1-1280x800.png', raw_dir / 'screenshot.png'),
    ('screenshot-2-1280x800.png', raw_dir / 'screenshot-findings.png'),
    ('screenshot-3-1280x800.png', raw_dir / 'screenshot-graph.png')
]

for out_name, in_path in screenshots:
    if not in_path.exists():
        continue
    img = Image.open(in_path).convert('RGB')
    
    # Chrome Web Store standard resolution: 1280x800 (16:10)
    w_target, h_target = 1280, 800
    
    img_fitted = ImageOps.contain(img, (1200, 740), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (w_target, h_target), (32, 33, 36))
    
    x = (w_target - img_fitted.width) // 2
    y = (h_target - img_fitted.height) // 2
    canvas.paste(img_fitted, (x, y))
    
    out_path = store_dir / out_name
    canvas.save(out_path, quality=95)
    print(f'Generated {out_path.name} ({canvas.size[0]}x{canvas.size[1]})')
