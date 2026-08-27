from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont

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

# 2. 440x280 Small Promo Tile (4x Supersampled for ultra-crisp typography)
scale = 4
W, H = 440 * scale, 280 * scale

canvas = Image.new('RGB', (W, H), (11, 15, 25))
draw = ImageDraw.Draw(canvas)

# Radial blue glow behind emblem
cx, cy_glow = W // 2, int(H * 0.32)
for r in range(int(W * 0.45), 0, -8):
    alpha = int(35 * (1 - r / (W * 0.45))**1.8)
    col = (11 + int(24 * alpha / 35), 15 + int(58 * alpha / 35), 25 + int(130 * alpha / 35))
    draw.ellipse([cx - r, cy_glow - int(r * 0.7), cx + r, cy_glow + int(r * 0.7)], fill=col)

# Outer glass card border
draw.rounded_rectangle([16 * scale, 16 * scale, W - 16 * scale, H - 16 * scale], radius=16 * scale, outline=(30, 41, 59), width=2 * scale)

# Vector emblem
icon_path = icons_dir / 'icon-512.png'
if icon_path.exists():
    icon = Image.open(icon_path).convert('RGBA')
    icon_size = 88 * scale
    icon_resized = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    canvas.paste(icon_resized, ((W - icon_size) // 2, int(H * 0.12)), icon_resized)

# Typography fonts
font_candidates_bold = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf']
font_candidates_reg = ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf']

def load_font(candidates, size):
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

font_bold = load_font(font_candidates_bold, 23 * scale)
font_regular = load_font(font_candidates_reg, 13 * scale)
font_chip = load_font(font_candidates_bold, 10 * scale)

# Title
title = 'Schema DevTools'
tb = draw.textbbox((0, 0), title, font=font_bold)
draw.text(((W - (tb[2] - tb[0])) // 2, int(H * 0.50)), title, fill=(248, 250, 252), font=font_bold)

# Subtitle
sub = 'Structured Data & Rich-Results Inspector'
sb = draw.textbbox((0, 0), sub, font=font_regular)
draw.text(((W - (sb[2] - sb[0])) // 2, int(H * 0.63)), sub, fill=(148, 163, 184), font=font_regular)

# Pill Chips
chips = ['JSON-LD', 'Microdata', 'RDFa']
chip_colors = [
    ((56, 189, 248), (14, 116, 144, 60)),
    ((96, 165, 250), (30, 58, 138, 60)),
    ((167, 139, 250), (88, 28, 135, 60)),
]

chip_y = int(H * 0.77)
chip_h = 22 * scale
chip_widths = []

for text in chips:
    cb = draw.textbbox((0, 0), text, font=font_chip)
    cw = (cb[2] - cb[0]) + 20 * scale
    chip_widths.append((text, cw, cb[2] - cb[0]))

gap = 10 * scale
total_w = sum(cw for _, cw, _ in chip_widths) + gap * (len(chips) - 1)
curr_x = (W - total_w) // 2

for idx, (text, cw, text_w) in enumerate(chip_widths):
    fg, _ = chip_colors[idx]
    draw.rounded_rectangle([curr_x, chip_y, curr_x + cw, chip_y + chip_h], radius=chip_h // 2, fill=(30, 41, 59), outline=(51, 65, 85), width=1 * scale)
    draw.text((curr_x + (cw - text_w) // 2, chip_y + int(4.5 * scale)), text, fill=fg, font=font_chip)
    curr_x += cw + gap

final_promo = canvas.resize((440, 280), Image.Resampling.LANCZOS)
promo_dest = store_dir / 'promo-small-440x280.png'
final_promo.save(promo_dest, quality=98)
print(f'Generated {promo_dest.name} ({final_promo.size[0]}x{final_promo.size[1]})')
