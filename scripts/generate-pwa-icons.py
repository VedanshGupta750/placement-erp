"""Generate developer-owned PWA icons from the Placement ERP logo geometry."""

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "pwa"
OUTPUT.mkdir(parents=True, exist_ok=True)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * amount) for i in range(3))


def gradient(size: int) -> Image.Image:
    stops = ((0.0, (124, 92, 252)), (0.55, (90, 140, 255)), (1.0, (236, 123, 192)))
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            position = (x + y) / (2 * (size - 1))
            if position <= stops[1][0]:
                amount = position / stops[1][0]
                color = mix(stops[0][1], stops[1][1], amount)
            else:
                amount = (position - stops[1][0]) / (stops[2][0] - stops[1][0])
                color = mix(stops[1][1], stops[2][1], amount)
            pixels[x, y] = color
    return image


def bezier(p0, p1, p2, p3, steps=40):
    points = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        points.append(
            (
                u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
            )
        )
    return points


def draw_mark(draw: ImageDraw.ImageDraw, size: int, color=(255, 255, 255, 255), scale=1.0) -> None:
    unit = size / 512
    width = max(2, round(34 * unit * scale))
    x = 160 * unit
    top = 152 * unit
    bottom = 360 * unit
    shoulder = 282 * unit
    middle = 270 * unit
    draw.line([(x, bottom), (x, 190 * unit)], fill=color, width=width)
    draw.line([(x, top), (shoulder, top)], fill=color, width=width)
    curve = bezier(
        (shoulder, 152 * unit),
        (365 * unit, 152 * unit),
        (365 * unit, middle),
        (shoulder, middle),
    )
    curve += [(218 * unit, middle), (218 * unit, bottom)]
    draw.line(curve, fill=color, width=width, joint="curve")


def create_icon(size: int, path: Path, maskable=False) -> None:
    supersample = 2
    canvas_size = size * supersample
    source = gradient(canvas_size).convert("RGBA")
    if not maskable:
        mask = Image.new("L", (canvas_size, canvas_size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle(
            (0, 0, canvas_size - 1, canvas_size - 1),
            radius=round(canvas_size * 0.24),
            fill=255,
        )
        source.putalpha(mask)
    draw_mark(ImageDraw.Draw(source), canvas_size)
    source.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)


create_icon(192, OUTPUT / "icon-192.png")
create_icon(512, OUTPUT / "icon-512.png")
create_icon(512, OUTPUT / "icon-maskable-512.png", maskable=True)
# Full-bleed (maskable) on purpose: iOS applies its own rounded-rect mask to the
# Home Screen icon and composites any transparency onto black, so a rounded
# source with clear corners renders with dark wedges.
create_icon(180, OUTPUT / "apple-touch-icon.png", maskable=True)

badge = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
draw_mark(ImageDraw.Draw(badge), 96, scale=1.15)
badge.save(OUTPUT / "badge-96.png", optimize=True)

print(f"Generated PWA icons in {OUTPUT}")
