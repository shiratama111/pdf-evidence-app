"""
build/make_icon.py

PDF証拠作成アプリの仮アイコン生成スクリプト。

デザイン:
- 青 (blue-600) の丸角四角背景
- 中央に白「証」の大きな文字（Yu Gothic Bold）
- 右下に赤い丸スタンプ（白抜きで「甲」）

出力:
- build/icon.ico  - マルチサイズICO (16/32/48/64/128/256)
- build/icon_preview.png - 確認用PNG (512x512)

実行:
    python build/make_icon.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BUILD_DIR = Path(__file__).parent
FONT_PATH = "C:/Windows/Fonts/YuGothB.ttc"

# 高解像度で描画してから各サイズに縮小
CANVAS = 512


def draw_icon() -> Image.Image:
    img = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ---- 背景: 丸角青 ----
    padding = 20
    rect = (padding, padding, CANVAS - padding, CANVAS - padding)
    draw.rounded_rectangle(rect, radius=80, fill=(37, 99, 235, 255))  # blue-600

    # 背景にうっすらグラデーション感を出すためのハイライト（上半分やや明るめ）
    highlight = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    hdraw.rounded_rectangle(
        (padding, padding, CANVAS - padding, CANVAS // 2 + 30),
        radius=80,
        fill=(255, 255, 255, 30),
    )
    img = Image.alpha_composite(img, highlight)
    draw = ImageDraw.Draw(img)

    # ---- 中央: 白「証」 ----
    kanji_font = ImageFont.truetype(FONT_PATH, int(CANVAS * 0.62))
    kanji = "証"
    bbox = draw.textbbox((0, 0), kanji, font=kanji_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (CANVAS - tw) // 2 - bbox[0]
    ty = (CANVAS - th) // 2 - bbox[1] - 10  # やや上寄せ
    draw.text((tx, ty), kanji, font=kanji_font, fill=(255, 255, 255, 255))

    # ---- 右下: 赤丸スタンプ (白抜き「甲」) ----
    stamp_d = int(CANVAS * 0.32)
    sx = CANVAS - stamp_d - 40
    sy = CANVAS - stamp_d - 40

    # 白背景円（印面のベース）
    draw.ellipse((sx, sy, sx + stamp_d, sy + stamp_d), fill=(255, 255, 255, 255))
    # 赤外枠
    border = 10
    draw.ellipse(
        (sx, sy, sx + stamp_d, sy + stamp_d),
        outline=(220, 38, 38, 255),  # red-600
        width=border,
    )
    # 赤「甲」
    stamp_font = ImageFont.truetype(FONT_PATH, int(stamp_d * 0.7))
    stamp_text = "甲"
    sbbox = draw.textbbox((0, 0), stamp_text, font=stamp_font)
    sw, sh = sbbox[2] - sbbox[0], sbbox[3] - sbbox[1]
    scx = sx + (stamp_d - sw) // 2 - sbbox[0]
    scy = sy + (stamp_d - sh) // 2 - sbbox[1] - 4
    draw.text((scx, scy), stamp_text, font=stamp_font, fill=(220, 38, 38, 255))

    return img


def main() -> None:
    img = draw_icon()

    # プレビュー用PNG
    preview_path = BUILD_DIR / "icon_preview.png"
    img.save(preview_path, format="PNG")
    print(f"saved: {preview_path}")

    # マルチサイズICO
    sizes = [16, 32, 48, 64, 128, 256]
    ico_path = BUILD_DIR / "icon.ico"
    img.save(ico_path, format="ICO", sizes=[(s, s) for s in sizes])
    print(f"saved: {ico_path} (sizes={sizes})")


if __name__ == "__main__":
    main()
