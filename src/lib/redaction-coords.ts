/**
 * 墨消し座標変換ユーティリティ
 * Canvas座標（左上原点）↔ PDF座標（左下原点）の変換と、
 * テキストアイテムと墨消し領域の交差判定を提供する。
 */

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Canvas座標の矩形 → PDF座標の矩形に変換
 * Canvas: 左上原点、Y軸下向き
 * PDF: 左下原点、Y軸上向き
 */
export function canvasToPdfRect(
  canvasRect: CanvasRect,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: number,
): PdfRect {
  // Canvas座標をスケール除去
  const cx = canvasRect.x / scale;
  const cy = canvasRect.y / scale;
  const cw = canvasRect.width / scale;
  const ch = canvasRect.height / scale;

  switch (rotation % 360) {
    case 0:
      return {
        x: cx,
        y: pageHeight - cy - ch,
        width: cw,
        height: ch,
      };
    case 90:
      return {
        x: cy,
        y: cx,
        width: ch,
        height: cw,
      };
    case 180:
      return {
        x: pageWidth - cx - cw,
        y: cy,
        width: cw,
        height: ch,
      };
    case 270:
      return {
        x: pageHeight - cy - ch,
        y: pageWidth - cx - cw,
        width: ch,
        height: cw,
      };
    default:
      return { x: cx, y: pageHeight - cy - ch, width: cw, height: ch };
  }
}

/**
 * PDF座標の矩形 → Canvas座標の矩形に変換
 */
export function pdfToCanvasRect(
  pdfRect: PdfRect,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: number,
): CanvasRect {
  let cx: number, cy: number, cw: number, ch: number;

  switch (rotation % 360) {
    case 0:
      cx = pdfRect.x;
      cy = pageHeight - pdfRect.y - pdfRect.height;
      cw = pdfRect.width;
      ch = pdfRect.height;
      break;
    case 90:
      cx = pdfRect.y;
      cy = pdfRect.x;
      cw = pdfRect.height;
      ch = pdfRect.width;
      break;
    case 180:
      cx = pageWidth - pdfRect.x - pdfRect.width;
      cy = pdfRect.y;
      cw = pdfRect.width;
      ch = pdfRect.height;
      break;
    case 270:
      cx = pageHeight - pdfRect.y - pdfRect.height;
      cy = pageWidth - pdfRect.x - pdfRect.width;
      cw = pdfRect.height;
      ch = pdfRect.width;
      break;
    default:
      cx = pdfRect.x;
      cy = pageHeight - pdfRect.y - pdfRect.height;
      cw = pdfRect.width;
      ch = pdfRect.height;
  }

  return {
    x: cx * scale,
    y: cy * scale,
    width: cw * scale,
    height: ch * scale,
  };
}

/**
 * pdfjs-distのTextItemが墨消し領域と交差するかを判定
 * TextItem.transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
 * translateX, translateY はPDF座標（左下原点）
 */
export function textItemIntersectsRedaction(
  transform: number[],
  itemWidth: number,
  itemHeight: number,
  redaction: PdfRect,
): boolean {
  // テキストアイテムのバウンディングボックス（PDF座標）
  const textLeft = transform[4];
  const textBottom = transform[5];
  const textRight = textLeft + itemWidth;
  const textTop = textBottom + (itemHeight || Math.abs(transform[3]));

  // 墨消し領域のバウンディングボックス（PDF座標）
  const redLeft = redaction.x;
  const redBottom = redaction.y;
  const redRight = redLeft + redaction.width;
  const redTop = redBottom + redaction.height;

  // AABB交差判定
  return !(textRight <= redLeft || textLeft >= redRight ||
           textTop <= redBottom || textBottom >= redTop);
}

/**
 * テキストアイテムがいずれかの墨消し領域と交差するかを判定
 */
export function textItemIntersectsAnyRedaction(
  transform: number[],
  itemWidth: number,
  itemHeight: number,
  redactions: PdfRect[],
): boolean {
  return redactions.some(r => textItemIntersectsRedaction(transform, itemWidth, itemHeight, r));
}
