#!/usr/bin/env python3
"""Generate favicon.ico (16/32/48) from the DeepRest moon icon-512.png."""
from PIL import Image

src = Image.open("/home/z/my-project/public/icon-512.png").convert("RGBA")
sizes = [(16, 16), (32, 32), (48, 48)]
frames = [src.resize(s, Image.LANCZOS) for s in sizes]
out = "/home/z/my-project/public/favicon.ico"
frames[0].save(out, format="ICO", sizes=sizes, append_images=frames[1:])
print("wrote", out)

# verify
ico = Image.open(out)
print("ico verified:", ico.format, ico.size)
