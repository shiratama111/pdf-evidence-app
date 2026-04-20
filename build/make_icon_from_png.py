"""
build/make_icon_from_png.py

既存PNGから Windows用 ICO (マルチサイズ) とプレビューPNGを生成する。
ChatGPTなど外部AIで生成したアイコン画像を取り込むのが主用途。

入力:
- build/icon_source.png  - 元になるPNG画像（推奨: 1024x1024 以上の正方形）

出力:
- build/icon.ico         - マルチサイズ ICO (16/32/48/64/128/256)
- build/icon_preview.png - 確認用PNG (512x512)

実行:
    python build/make_icon_from_png.py
"""
from pathlib import Path
from PIL import Image

BUILD_DIR = Path(__file__).parent
SRC = BUILD_DIR / "icon_source.png"
ICO_OUT = BUILD_DIR / "icon.ico"
PREVIEW_OUT = BUILD_DIR / "icon_preview.png"

ICO_SIZES = [16, 32, 48, 64, 128, 256]


def square_crop(img: Image.Image) -> Image.Image:
    """非正方形の場合は中央から正方形にクロップする。"""
    w, h = img.size
    if w == h:
        return img
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    return img.crop((left, top, left + s, top + s))


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(f"Source image not found: {SRC}")

    img = Image.open(SRC).convert("RGBA")
    print(f"loaded: {SRC} size={img.size} mode={img.mode}")

    img = square_crop(img)
    print(f"after square_crop: size={img.size}")

    # 最大サイズ(256)より大きければ先に縮小（ICO内部のリサイズ品質を安定させるため）
    base = img.resize((512, 512), Image.Resampling.LANCZOS)

    # プレビュー
    base.save(PREVIEW_OUT, format="PNG")
    print(f"saved preview: {PREVIEW_OUT}")

    # マルチサイズ ICO
    base.save(ICO_OUT, format="ICO", sizes=[(s, s) for s in ICO_SIZES])
    print(f"saved ico: {ICO_OUT} sizes={ICO_SIZES}")


if __name__ == "__main__":
    main()
