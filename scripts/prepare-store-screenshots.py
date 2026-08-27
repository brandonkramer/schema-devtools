from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

assets_dir = Path(__file__).parent.parent / 'assets'
store_dir = assets_dir / 'store'
raw_dir = assets_dir / 'raw'
icons_dir = Path(__file__).parent.parent / 'icons'
store_dir.mkdir(parents=True, exist_ok=True)
raw_dir.mkdir(parents=True, exist_ok=True)

# 1. 1280x800 Screenshot Assets
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

# 2. 440x280 Small Promo Tile
pw, ph = 440, 280
promo = Image.new('RGB', (pw, ph), (24, 25, 28))
pdraw = ImageDraw.Draw(promo)
pdraw.rounded_rectangle([10, 10, pw - 10, ph - 10], radius=16, fill=(32, 33, 36), outline=(60, 64, 67), width=1)

icon_path = icons_dir / 'icon-512.png'
if icon_path.exists():
    icon = Image.open(icon_path).convert('RGBA')
    icon_resized = icon.resize((96, 96), Image.Resampling.LANCZOS)
    promo.paste(icon_resized, ((pw - 96) // 2, 38), icon_resized)

pdraw.text(((pw - 130) // 2, 150), 'Schema DevTools', fill=(241, 243, 244))
pdraw.text(((pw - 250) // 2, 178), 'Inspect, Validate & Score Structured Data', fill=(154, 160, 166))
pdraw.text(((pw - 180) // 2, 215), 'JSON-LD • Microdata • RDFa', fill=(138, 180, 248))

promo_path = store_dir / 'promo-small-440x280.png'
promo.save(promo_path, quality=95)
print(f'Generated {promo_path.name} ({promo.size[0]}x{promo.size[1]})')
