#!/usr/bin/env python3
"""
Generate cosmetic sprite assets: headwear, trail particles, slap FX.

Output: /home/z/my-project/arena-slaps/public/sprites/*.png
"""

from PIL import Image, ImageDraw, ImageFilter
import os
import math

OUTPUT_DIR = "/home/z/my-project/arena-slaps/public/sprites"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ─── Headwear ────────────────────────────────────────────────────────────
# All headwear uses a 48×48 canvas with transparent background.

def make_headwear_cap():
    """Blue baseball cap with a red brim."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([6, 14, 42, 38], fill=(50, 90, 160, 255), outline=(20, 40, 80, 255), width=2)
    d.ellipse([10, 26, 44, 36], fill=(200, 50, 50, 255), outline=(120, 20, 20, 255), width=1)
    d.ellipse([22, 14, 26, 18], fill=(20, 40, 80, 255))
    img.save(os.path.join(OUTPUT_DIR, "headwear-cap.png"))


def make_headwear_crown():
    """Golden crown with red jewels."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([8, 24, 40, 36], fill=(240, 200, 60, 255), outline=(160, 120, 20, 255), width=2)
    for cx in [12, 24, 36]:
        d.polygon([(cx - 4, 24), (cx + 4, 24), (cx, 12)], fill=(240, 200, 60, 255), outline=(160, 120, 20, 255))
    d.ellipse([10, 16, 14, 20], fill=(220, 50, 50, 255))
    d.ellipse([22, 14, 26, 18], fill=(50, 180, 80, 255))
    d.ellipse([34, 16, 38, 20], fill=(50, 100, 220, 255))
    d.ellipse([16, 28, 20, 32], fill=(220, 50, 50, 255))
    d.ellipse([28, 28, 32, 32], fill=(50, 100, 220, 255))
    img.save(os.path.join(OUTPUT_DIR, "headwear-crown.png"))


def make_headwear_horns():
    """Red devil horns."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(10, 30), (18, 30), (8, 12)], fill=(180, 30, 30, 255), outline=(100, 10, 10, 255))
    d.polygon([(30, 30), (38, 30), (40, 12)], fill=(180, 30, 30, 255), outline=(100, 10, 10, 255))
    d.rectangle([8, 28, 40, 34], fill=(120, 20, 20, 255))
    d.line([(12, 28), (10, 16)], fill=(240, 100, 100, 200), width=2)
    d.line([(36, 28), (38, 16)], fill=(240, 100, 100, 200), width=2)
    img.save(os.path.join(OUTPUT_DIR, "headwear-horns.png"))


def make_headwear_party_hat():
    """Colorful party hat (2P-only)."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(8, 36), (40, 36), (24, 8)], fill=(180, 50, 200, 255), outline=(100, 20, 120, 255))
    d.polygon([(12, 32), (36, 32), (33, 28), (15, 28)], fill=(240, 220, 60, 255))
    d.polygon([(15, 28), (33, 28), (30, 24), (18, 24)], fill=(50, 180, 80, 255))
    d.polygon([(18, 24), (30, 24), (27, 20), (21, 20)], fill=(240, 220, 60, 255))
    d.ellipse([20, 6, 28, 14], fill=(240, 100, 100, 255), outline=(180, 50, 50, 255))
    img.save(os.path.join(OUTPUT_DIR, "headwear-party-hat.png"))


# ─── Trail particles ────────────────────────────────────────────────────

def make_radial_particle(filename, color_rgb, size=16):
    """Soft circular particle with radial alpha falloff."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    center = size // 2
    max_radius = size // 2 - 1
    for r in range(max_radius, 0, -1):
        alpha = int(255 * (1 - r / max_radius) ** 2)
        r_color = (color_rgb[0], color_rgb[1], color_rgb[2], alpha)
        d.ellipse([center - r, center - r, center + r, center + r], fill=r_color)
    img.save(os.path.join(OUTPUT_DIR, filename))


def make_trail_dust():
    make_radial_particle("trail-dust.png", (180, 170, 150))


def make_trail_sparkle():
    """White sparkle particle (4-pointed star-ish)."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r in range(7, 0, -1):
        alpha = int(180 * (1 - r / 7) ** 2)
        d.ellipse([8 - r, 8 - r, 8 + r, 8 + r], fill=(255, 255, 255, alpha))
    d.polygon([(8, 0), (10, 8), (8, 16), (6, 8)], fill=(255, 255, 240, 255))
    d.polygon([(0, 8), (8, 6), (16, 8), (8, 10)], fill=(255, 255, 240, 255))
    img.save(os.path.join(OUTPUT_DIR, "trail-sparkle.png"))


# ─── Slap FX (burst textures, 48×48) ────────────────────────────────────

def make_slapfx_star():
    """Yellow 5-pointed star burst."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = 24, 24
    outer_r = 20
    inner_r = 8
    points = []
    for i in range(10):
        angle = math.pi / 2 + i * math.pi / 5
        r = outer_r if i % 2 == 0 else inner_r
        points.append((cx + r * math.cos(angle), cy - r * math.sin(angle)))
    d.polygon(points, fill=(255, 220, 60, 255), outline=(200, 150, 20, 255))
    for angle_deg in [0, 72, 144, 216, 288]:
        angle = math.radians(angle_deg)
        x1 = cx + 22 * math.cos(angle)
        y1 = cy - 22 * math.sin(angle)
        x2 = cx + 30 * math.cos(angle)
        y2 = cy - 30 * math.sin(angle)
        d.line([(x1, y1), (x2, y2)], fill=(255, 255, 200, 220), width=2)
    img.save(os.path.join(OUTPUT_DIR, "slapfx-star.png"))


def make_slapfx_lightning():
    """Blue lightning bolt."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon(
        [(28, 4), (16, 24), (22, 24), (18, 44), (34, 20), (26, 20)],
        fill=(120, 180, 255, 255),
        outline=(60, 100, 200, 255),
    )
    img_glow = img.filter(ImageFilter.GaussianBlur(2))
    img_final = Image.alpha_composite(img_glow, img)
    img_final.save(os.path.join(OUTPUT_DIR, "slapfx-lightning.png"))


if __name__ == "__main__":
    print("Generating headwear...")
    make_headwear_cap()
    make_headwear_crown()
    make_headwear_horns()
    make_headwear_party_hat()

    print("Generating trail particles...")
    make_trail_dust()
    make_trail_sparkle()

    print("Generating slap FX...")
    make_slapfx_star()
    make_slapfx_lightning()

    print("Done! All cosmetic sprites generated in:", OUTPUT_DIR)
