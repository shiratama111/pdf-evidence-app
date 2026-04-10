/**
 * PDF証拠番号スタンプ処理エンジン（ブラウザ版）
 * pdf-lib + fontkit を使用。
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
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

/** PDFの先頭ページにスタンプを描画 */
export function drawStampOnPage(
  page: PDFPage,
  font: PDFFont,
  label: string,
  settings: StampSettings,
): void {
  const { width, height } = page.getSize();
  const fontSize = settings.fontSize;
  const textWidth = font.widthOfTextAtSize(label, fontSize);
  const pad = 4;
  const color = COLORS[settings.fontColor as keyof typeof COLORS] ?? COLORS.black;

  const x = width - settings.marginRight - textWidth - pad;
  const y = height - settings.marginTop - fontSize - pad;

  // 白背景
  if (settings.showBackground) {
    page.drawRectangle({
      x: x - pad,
      y: y - pad * 0.5,
      width: textWidth + pad * 2,
      height: fontSize + pad * 2,
      color: rgb(1, 1, 1),
      opacity: 1,
    });
  }

  // 枠線
  if (settings.showBorder) {
    page.drawRectangle({
      x: x - pad,
      y: y - pad * 0.5,
      width: textWidth + pad * 2,
      height: fontSize + pad * 2,
      borderColor: color,
      borderWidth: 0.5,
    });
  }

  // テキスト
  page.drawText(label, {
    x,
    y: y + pad * 0.5,
    size: fontSize,
    font,
    color,
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
