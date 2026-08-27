from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont

assets_dir = Path(__file__).parent.parent / 'assets'
store_dir = assets_dir / 'store'
raw_dir = assets_dir / 'raw'
icons_dir = assets_dir / 'icons'
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

# 2. 440x280 Small Promo Tile (Split Preview)
scale = 4
W, H = 440 * scale, 280 * scale

v1 = Image.new('RGB', (W, H), (15, 23, 42))
d1 = ImageDraw.Draw(v1)

# Subtle background glow
for r in range(int(W * 0.4), 0, -8):
    alpha = int(25 * (1 - r / (W * 0.4)))
    d1.ellipse([int(W * 0.25) - r, int(H * 0.4) - r, int(W * 0.25) + r, int(H * 0.4) + r], fill=(15 + alpha, 23 + alpha * 2, 42 + alpha * 4))

font_bold = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 24 * scale)
font_title = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22 * scale)
font_med = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 13 * scale)
font_reg = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13 * scale)
font_sm = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 10 * scale)

icon_512 = Image.open(icons_dir / 'icon-512.png').convert('RGBA')

# Left: Logo & Title
logo_size = 72 * scale
logo_res = icon_512.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
v1.paste(logo_res, (28 * scale, 32 * scale), logo_res)

d1.text((28 * scale, 115 * scale), 'Schema DevTools', fill=(248, 250, 252), font=font_title)
d1.text((28 * scale, 145 * scale), 'Structured Data Inspector', fill=(148, 163, 184), font=font_reg)

chips = ['JSON-LD', 'Microdata', 'RDFa']
cx = 28 * scale
cy = 185 * scale
for c_idx, c_text in enumerate(chips):
    cb = d1.textbbox((0, 0), c_text, font=font_sm)
    cw = (cb[2] - cb[0]) + 16 * scale
    d1.rounded_rectangle([cx, cy, cx + cw, cy + 22 * scale], radius=6 * scale, fill=(30, 41, 59), outline=(51, 65, 85), width=1 * scale)
    d1.text((cx + 8 * scale, cy + int(4.5 * scale)), c_text, fill=(56, 189, 248) if c_idx == 0 else (148, 163, 184), font=font_sm)
    cx += cw + 8 * scale

# Right: Floating UI Card
card_x, card_y, card_w, card_h = int(W * 0.54), int(H * 0.12), int(W * 0.42), int(H * 0.76)
d1.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=12 * scale, fill=(24, 25, 28), outline=(60, 64, 67), width=2 * scale)

d1.rounded_rectangle([card_x + 14 * scale, card_y + 14 * scale, card_x + 48 * scale, card_y + 48 * scale], radius=17 * scale, fill=(16, 185, 129))
d1.rounded_rectangle([card_x + 17 * scale, card_y + 17 * scale, card_x + 45 * scale, card_y + 45 * scale], radius=14 * scale, fill=(24, 25, 28))
d1.text((card_x + 23 * scale, card_y + 24 * scale), '91', fill=(248, 250, 252), font=font_sm)

d1.text((card_x + 56 * scale, card_y + 16 * scale), 'Excellent', fill=(52, 211, 153), font=font_med)
d1.text((card_x + 56 * scale, card_y + 32 * scale), '0 errors • 0 warnings', fill=(154, 160, 166), font=font_sm)

d1.line([card_x + 14 * scale, card_y + 60 * scale, card_x + card_w - 14 * scale, card_y + 60 * scale], fill=(41, 42, 45), width=1 * scale)

lines = [
    ('@context: \"schema.org\"', (138, 180, 248)),
    ('@type: \"Product\"', (244, 114, 182)),
    ('name: \"Acme Widget\"', (251, 191, 36)),
    ('offers: Offer', (52, 211, 153)),
    ('price: 49.99', (251, 191, 36)),
]
ly = card_y + 70 * scale
for l_text, l_col in lines:
    d1.text((card_x + 16 * scale, ly), l_text, fill=l_col, font=font_sm)
    ly += 16 * scale

v1_res = v1.resize((440, 280), Image.Resampling.LANCZOS)
promo_dest = store_dir / 'promo-small-440x280.png'
v1_res.save(promo_dest, quality=98)
print(f'Generated {promo_dest.name} ({v1_res.size[0]}x{v1_res.size[1]})')
