/**
 * PDF証拠番号スタンプ処理エンジン（ブラウザ版）
 * pdf-lib + fontkit を使用。
 */
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { StampSettings, StampFormat, EvidenceNumber } from '@/types/pdf';

type RegisteredFontkit = Parameters<PDFDocument['registerFontkit']>[0];
type FontkitCreate = (buffer: Uint8Array, postscriptName?: string) => unknown;
type FontCollection = { fonts: unknown[] };

const originalFontkit = fontkit as { create: FontkitCreate };

function isFontCollection(value: unknown): value is FontCollection {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Partial<FontCollection>).fonts)
  );
}

const fontkitWithTtcSupport: RegisteredFontkit = {
  create: (buffer: Uint8Array, postscriptName?: string) => {
    const result = originalFontkit.create(buffer, postscriptName);
    if (isFontCollection(result)) {
      if (result.fonts.length === 0) {
        throw new Error('TrueType collection did not contain any fonts.');
      }
      return result.fonts[0] as never;
    }
    return result as never;
  },
};

// ---------------------------------------------------------------------------
// フォーマット定義
// ---------------------------------------------------------------------------

type FormatFn = (symbol: string, num: number) => string;
type BranchFn = (symbol: string, num: number, sub: number) => string;
type MergedFn = (symbol: string, num: number, subStart: number, subEnd: number) => string;

interface FormatStyle {
  main: FormatFn;
  branch: BranchFn;
  /** グループ統合用ラベル（例: 甲第1号証の1〜3） */
  merged: MergedFn;
  /** mints-formal の場合、ファイル名用の形式 */
  filenameMain?: FormatFn;
  filenameBranch?: BranchFn;
  filenameMerged?: MergedFn;
}

const FORMAT_STYLES: Record<StampFormat, FormatStyle> = {
  'mints': {
    main: (s, n) => `${s}${String(n).padStart(3, '0')}`,
    branch: (s, n, sub) => `${s}${String(n).padStart(3, '0')}-${sub}`,
    merged: (s, n, start, end) => `${s}${String(n).padStart(3, '0')}-${start}～${end}`,
  },
  'mints-formal': {
    // スタンプは正式形式、ファイル名はmints形式
    main: (s, n) => `${s}第${n}号証`,
    branch: (s, n, sub) => `${s}第${n}号証の${sub}`,
    merged: (s, n, start, end) => `${s}第${n}号証の${start}〜${end}`,
    filenameMain: (s, n) => `${s}${String(n).padStart(3, '0')}`,
    filenameBranch: (s, n, sub) => `${s}${String(n).padStart(3, '0')}-${sub}`,
    filenameMerged: (s, n, start, end) => `${s}${String(n).padStart(3, '0')}-${start}～${end}`,
  },
  'simple': {
    main: (s, n) => `${s}${n}`,
    branch: (s, n, sub) => `${s}${n}の${sub}`,
    merged: (s, n, start, end) => `${s}${n}の${start}〜${end}`,
  },
  'hyphen': {
    main: (s, n) => `${s}${n}`,
    branch: (s, n, sub) => `${s}${n}-${sub}`,
    merged: (s, n, start, end) => `${s}${n}-${start}～${end}`,
  },
  'formal': {
    main: (s, n) => `${s}第${n}号証`,
    branch: (s, n, sub) => `${s}第${n}号証の${sub}`,
    merged: (s, n, start, end) => `${s}第${n}号証の${start}〜${end}`,
  },
  'goushou': {
    main: (s, n) => `${s}${n}号証`,
    branch: (s, n, sub) => `${s}${n}号証の${sub}`,
    merged: (s, n, start, end) => `${s}${n}号証の${start}〜${end}`,
  },
};

const COLORS = {
  black: rgb(0, 0, 0),
  red: rgb(0.8, 0, 0),
  blue: rgb(0, 0, 0.8),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** 証拠番号からスタンプ用ラベルを生成 */
export function formatStampLabel(
  symbol: string,
  evidence: EvidenceNumber,
  format: StampFormat,
): string {
  const fmt = FORMAT_STYLES[format];
  if (evidence.sub != null) {
    return fmt.branch(symbol, evidence.main, evidence.sub);
  }
  return fmt.main(symbol, evidence.main);
}

/** 証拠番号からファイル名用ラベルを生成 */
export function formatFilenameLabel(
  symbol: string,
  evidence: EvidenceNumber,
  format: StampFormat,
): string {
  const fmt = FORMAT_STYLES[format];
  if (evidence.sub != null) {
    const fn = fmt.filenameBranch ?? fmt.branch;
    return fn(symbol, evidence.main, evidence.sub);
  }
  const fn = fmt.filenameMain ?? fmt.main;
  return fn(symbol, evidence.main);
}

/** 統合枝番のスタンプラベルを生成（例: 甲第1号証の1〜3） */
export function formatMergedStampLabel(
  symbol: string,
  main: number,
  subStart: number,
  subEnd: number,
  format: StampFormat,
): string {
  const fmt = FORMAT_STYLES[format];
  if (subStart === subEnd) {
    return fmt.branch(symbol, main, subStart);
  }
  return fmt.merged(symbol, main, subStart, subEnd);
}

/** 統合枝番のファイル名用ラベルを生成（例: 甲001-1～3） */
export function formatMergedFilenameLabel(
  symbol: string,
  main: number,
  subStart: number,
  subEnd: number,
  format: StampFormat,
): string {
  const fmt = FORMAT_STYLES[format];
  if (subStart === subEnd) {
    const fn = fmt.filenameBranch ?? fmt.branch;
    return fn(symbol, main, subStart);
  }
  const fn = fmt.filenameMerged ?? fmt.merged;
  return fn(symbol, main, subStart, subEnd);
}

/** 実効的な符号文字列を返す */
export function getEffectiveSymbol(settings: StampSettings): string {
  return settings.symbol === '__custom__' ? settings.customSymbol : settings.symbol;
}

/**
 * PDFの先頭ページにスタンプを描画。
 *
 * ページ rotation（PDF /Rotate、時計回り度数）を考慮し、ビューワーで見たときに
 * 「見た目の右上」にスタンプが正立した状態で表示されるよう、物理座標系で配置する。
 *
 * 実装メモ:
 * - pdf-lib の drawText / drawRectangle は常にページの物理座標系（/Rotate=0 相当）で描画
 * - ページ /Rotate=R が適用されるとビューワー側で時計回り R 度回転されて見える
 * - pdf-lib の `degrees(A)` は「反時計回り A 度」を意味する（数学的 convention）
 * - 見た目で正立させるには、文字を反時計回り R 度（= 時計回り -R 度）回転させ、
 *   ページ回転と合わせて合計 0 度になるよう打ち消す
 * - 矩形は axis-aligned で物理配置。物理での w/h は、R=90/270 のとき見た目で入れ替わる
 *   ため、物理 w=boxH, h=boxW となる
 */
export function drawStampOnPage(
  page: PDFPage,
  font: PDFFont,
  label: string,
  settings: StampSettings,
): void {
  const { width: W, height: H } = page.getSize();
  // PDF /Rotate（時計回り度数、0/90/180/270 に正規化）
  const rotationDeg = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;

  const fontSize = settings.fontSize;
  const textWidth = font.widthOfTextAtSize(label, fontSize);
  const pad = 4;
  const color = COLORS[settings.fontColor as keyof typeof COLORS] ?? COLORS.black;

  // 見た目（ビューワーでページrotation適用後）でのスタンプボックス寸法
  const boxW = textWidth + pad * 2; // 見た目横（= ビューワーから見たときの矩形の幅）
  const boxH = fontSize + pad * 2;  // 見た目縦
  const mr = settings.marginRight;
  const mt = settings.marginTop;

  // 物理座標系での配置（axis-aligned）とテキスト基点・回転角
  let rectX: number;
  let rectY: number;
  let rectW: number;
  let rectH: number;
  let textX: number;
  let textY: number;
  let textRotateCcw: number; // pdf-lib の degrees() は反時計回り正

  switch (rotationDeg) {
    case 0:
      // 回転なし: 物理=見た目
      rectX = W - mr - boxW;
      rectY = H - mt - boxH;
      rectW = boxW;
      rectH = boxH;
      textX = rectX + pad;
      textY = rectY + pad;
      textRotateCcw = 0;
      break;
    case 90:
      // ページ時計回り90度 → 見た目右上は物理の左上領域
      // 物理矩形は w=boxH, h=boxW（見た目で width/height が入れ替わる）
      rectX = mt;
      rectY = H - mr - boxW;
      rectW = boxH;
      rectH = boxW;
      // テキスト: 反時計回り90度で描くと物理上は「上向き」、ビューワーで正立
      // 基点（ベースライン左端）は、回転後にテキストの「見た目での左下」になる物理位置
      textX = mt + boxH - pad;
      textY = H - mr - boxW + pad;
      textRotateCcw = 90;
      break;
    case 180:
      // ページ時計回り180度 → 見た目右上は物理の左下領域
      rectX = mr;
      rectY = mt;
      rectW = boxW;
      rectH = boxH;
      textX = mr + boxW - pad;
      textY = mt + boxH - pad;
      textRotateCcw = 180;
      break;
    case 270:
      // ページ時計回り270度 → 見た目右上は物理の右下領域
      rectX = W - mt - boxH;
      rectY = mr;
      rectW = boxH;
      rectH = boxW;
      textX = W - mt - boxH + pad;
      textY = mr + boxW - pad;
      textRotateCcw = 270;
      break;
  }

  // 白背景
  if (settings.showBackground) {
    page.drawRectangle({
      x: rectX,
      y: rectY,
      width: rectW,
      height: rectH,
      color: rgb(1, 1, 1),
      opacity: 1,
    });
  }

  // 枠線
  if (settings.showBorder) {
    page.drawRectangle({
      x: rectX,
      y: rectY,
      width: rectW,
      height: rectH,
      borderColor: color,
      borderWidth: 0.5,
    });
  }

  // テキスト
  page.drawText(label, {
    x: textX,
    y: textY,
    size: fontSize,
    font,
    color,
    rotate: degrees(textRotateCcw),
  });
}

/** フォントバイト列からfontkit対応のPDFフォントを登録・埋め込み */
export async function embedJapaneseFont(
  pdfDoc: PDFDocument,
  fontBytes: Uint8Array,
): Promise<PDFFont> {
  pdfDoc.registerFontkit(fontkitWithTtcSupport);
  return await pdfDoc.embedFont(fontBytes, { subset: true });
}

/** メタデータを削除 */
export function removeMetadata(pdfDoc: PDFDocument): void {
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('');
  pdfDoc.setCreator('');
}
