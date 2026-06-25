#!/usr/bin/env python3
"""Generate premium cosmetic sprite assets."""

from PIL import Image, ImageDraw
import os, math, random

OUTPUT_DIR = "/home/z/my-project/arena-slaps/public/sprites"

def new_canvas():
    return Image.new("RGBA", (48, 48), (0, 0, 0, 0))

def make_hw_wizard():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.polygon([(12, 36), (36, 36), (24, 6)], fill=(60, 80, 180), outline=(30, 40, 100))
    cx, cy = 24, 20; pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5; r = 5 if i % 2 == 0 else 2
        pts.append((cx + r * math.cos(a), cy - r * math.sin(a)))
    d.polygon(pts, fill=(255, 255, 100))
    d.ellipse([8, 32, 40, 40], fill=(40, 50, 120))
    img.save(os.path.join(OUTPUT_DIR, "headwear-wizard.png"))

def make_hw_pirate():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.polygon([(6, 22), (42, 22), (42, 38), (6, 38)], fill=(30, 30, 35))
    d.ellipse([18, 24, 30, 36], fill=(240, 240, 240))
    d.ellipse([20, 27, 23, 30], fill=(30, 30, 35))
    d.ellipse([25, 27, 28, 30], fill=(30, 30, 35))
    d.polygon([(40, 28), (46, 24), (46, 36), (40, 34)], fill=(30, 30, 35))
    img.save(os.path.join(OUTPUT_DIR, "headwear-pirate.png"))

def make_hw_space():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.ellipse([8, 10, 40, 42], fill=(150, 200, 255, 80), outline=(100, 150, 220), width=2)
    d.ellipse([6, 32, 42, 42], fill=(220, 220, 230), outline=(180, 180, 190), width=2)
    d.ellipse([14, 14, 22, 22], fill=(255, 255, 255, 60))
    img.save(os.path.join(OUTPUT_DIR, "headwear-space.png"))

def make_hw_ninja():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.rectangle([4, 20, 44, 34], fill=(20, 20, 25))
    d.rectangle([10, 24, 38, 28], fill=(0, 0, 0, 0))
    d.polygon([(4, 26), (0, 22), (0, 34), (4, 30)], fill=(180, 30, 30))
    d.rectangle([4, 24, 8, 30], fill=(140, 20, 20))
    img.save(os.path.join(OUTPUT_DIR, "headwear-ninja.png"))

def make_hw_viking():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.ellipse([8, 16, 40, 38], fill=(120, 80, 40), outline=(80, 50, 20), width=2)
    d.rectangle([8, 32, 40, 38], fill=(150, 150, 160))
    d.polygon([(8, 22), (16, 22), (4, 10)], fill=(240, 230, 200), outline=(180, 170, 140))
    d.polygon([(32, 22), (40, 22), (44, 10)], fill=(240, 230, 200), outline=(180, 170, 140))
    img.save(os.path.join(OUTPUT_DIR, "headwear-viking.png"))

def make_hw_tophat():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.ellipse([4, 32, 44, 40], fill=(20, 20, 25))
    d.rectangle([14, 8, 34, 34], fill=(20, 20, 25))
    d.rectangle([14, 28, 34, 32], fill=(180, 30, 30))
    d.ellipse([14, 6, 34, 12], fill=(30, 30, 35))
    img.save(os.path.join(OUTPUT_DIR, "headwear-tophat.png"))

def make_radial(filename, color, size=16):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img); c = size // 2
    for r in range(c - 1, 0, -1):
        a = int(255 * (1 - r / (c - 1)) ** 2)
        d.ellipse([c - r, c - r, c + r, c + r], fill=(*color, a))
    img.save(os.path.join(OUTPUT_DIR, filename))

def make_slapfx_explosion():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.polygon([(24,4),(30,20),(44,16),(34,26),(44,40),(24,32),(4,40),(14,26),(4,16),(18,20)], fill=(255,140,30), outline=(200,80,10))
    d.ellipse([16,16,32,32], fill=(255,240,100))
    img.save(os.path.join(OUTPUT_DIR, "slapfx-explosion.png"))

def make_slapfx_confetti():
    img = new_canvas(); d = ImageDraw.Draw(img)
    random.seed(42)
    colors = [(255,80,80),(80,200,100),(80,120,255),(255,220,60),(200,80,255)]
    for _ in range(25):
        x, y = random.randint(4, 44), random.randint(4, 44)
        d.rectangle([x, y, x+3, y+3], fill=random.choice(colors))
    img.save(os.path.join(OUTPUT_DIR, "slapfx-confetti.png"))

def make_slapfx_skull():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.ellipse([12,8,36,32], fill=(240,240,240), outline=(180,180,180))
    d.ellipse([16,16,22,22], fill=(30,30,30)); d.ellipse([26,16,32,22], fill=(30,30,30))
    d.rectangle([18,28,30,36], fill=(240,240,240))
    for x in [21,24,27]: d.line([(x,28),(x,36)], fill=(180,180,180))
    d.rectangle([4,38,44,42], fill=(200,200,200))
    img.save(os.path.join(OUTPUT_DIR, "slapfx-skull.png"))

def make_slapfx_heart():
    img = new_canvas(); d = ImageDraw.Draw(img)
    d.ellipse([10,12,26,28], fill=(255,80,120)); d.ellipse([22,12,38,28], fill=(255,80,120))
    d.polygon([(10,22),(38,22),(24,42)], fill=(255,80,120))
    d.ellipse([14,14,20,20], fill=(255,180,200,200))
    img.save(os.path.join(OUTPUT_DIR, "slapfx-heart.png"))

if __name__ == "__main__":
    print("Generating premium headwear...")
    make_hw_wizard(); make_hw_pirate(); make_hw_space()
    make_hw_ninja(); make_hw_viking(); make_hw_tophat()
    print("Generating premium trails...")
    make_radial("trail-fire.png", (255,100,20))
    make_radial("trail-rainbow.png", (200,100,255))
    make_radial("trail-galaxy.png", (80,60,200))
    make_radial("trail-poison.png", (80,200,50))
    print("Generating premium slap FX...")
    make_slapfx_explosion(); make_slapfx_confetti()
    make_slapfx_skull(); make_slapfx_heart()
    print("Done!")
