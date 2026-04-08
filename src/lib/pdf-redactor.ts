/**
 * PDF墨消し（リダクション）エンジン
 *
 * 墨消しのあるページを処理する手順:
 * 1. pdfjs-distでページを高解像度canvasにレンダリング
 * 2. canvas上で墨消し領域を黒塗り
 * 3. canvasをJPEG画像に変換
 * 4. pdf-libで新しいページに画像を埋め込み（元ページを置換）
 * 5. pdfjs-distのgetTextContent()で全テキスト位置を取得
 * 6. 墨消し範囲外のテキストのみpdf-libの低レベルAPIで非表示テキストとして再追加
 */

import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';
import type { RedactionArea } from '@/types/pdf';
import { textItemIntersectsAnyRedaction } from './redaction-coords';
import { loadPdfDocument } from './pdf-renderer';
import { embedJapaneseFont } from './pdf-stamper';

/** 墨消し適用時のレンダリング解像度 (DPI) */
const REDACTION_DPI = 200;
const SCALE_FACTOR = REDACTION_DPI / 72; // ~2.78

interface TextItemForRedaction {
  str: string;
  transform: number[]; // [a, b, c, d, e, f]
  width: number;
  height: number;
}

/**
 * PDFDocumentの指定ページに墨消しを適用する。
 * ページの内容を画像に置き換え、墨消し外のテキストを非表示テキストとして復元する。
 *
 * @param pdfDoc - 出力先のPDFDocument（pdf-lib）
 * @param pageIndex - 処理対象のページインデックス（0ベース）
 * @param redactions - 墨消し領域の配列（PDF座標）
 * @param sourceBuffer - 元PDFのArrayBuffer
 * @param sourcePageIndex - 元PDFでのページインデックス
 * @param fontBytes - 日本語フォントバイト（非表示テキスト用、nullなら非表示テキスト省略）
 */
export async function applyPageRedactions(
  pdfDoc: PDFDocument,
  pageIndex: number,
  redactions: RedactionArea[],
  sourceBuffer: ArrayBuffer,
  sourcePageIndex: number,
  fontBytes: Uint8Array | null,
): Promise<void> {
  if (redactions.length === 0) return;

  const page = pdfDoc.getPage(pageIndex);
  const { width: pageWidth, height: pageHeight } = page.getSize();

  // ── Step 1-3: ページを画像としてレンダリング＋墨消し＋JPEG変換 ──
  const imageBytes = await renderPageWithRedactions(
    sourceBuffer,
    sourcePageIndex,
    redactions,
    pageWidth,
    pageHeight,
  );

  // ── Step 4: 元ページの内容を画像で置き換え ──
  const image = await pdfDoc.embedJpg(imageBytes);

  // ページのコンテンツストリームをクリアして画像を描画
  // pdf-libには直接ページ内容をクリアするAPIがないため、
  // 新しいページを作成して元ページと入れ替える
  const newPage = pdfDoc.insertPage(pageIndex + 1, [pageWidth, pageHeight]);
  newPage.drawImage(image, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  // ── Step 5-6: 非表示テキスト復元 ──
  if (fontBytes) {
    try {
      const survivingTexts = await getSurvivingTextItems(
        sourceBuffer,
        sourcePageIndex,
        redactions,
      );

      if (survivingTexts.length > 0) {
        const font = await embedJapaneseFont(pdfDoc, fontBytes);
        addInvisibleTextLayer(newPage, survivingTexts, font, pdfDoc);
      }
    } catch (err) {
      console.warn('[redactor] Failed to add invisible text layer:', err);
      // テキスト復元失敗しても画像の墨消しは有効なので続行
    }
  }

  // 元のページを削除（新しいページはpageIndex+1にあったがremoveで繰り上がる）
  pdfDoc.removePage(pageIndex);
}

/**
 * pdfjs-distでページをcanvasにレンダリングし、墨消し領域を黒塗りしてJPEGに変換
 */
async function renderPageWithRedactions(
  sourceBuffer: ArrayBuffer,
  sourcePageIndex: number,
  redactions: RedactionArea[],
  _pageWidth: number,
  pageHeight: number,
): Promise<Uint8Array> {
  const doc = await loadPdfDocument(sourceBuffer.slice(0));
  const pdfPage = await doc.getPage(sourcePageIndex + 1); // pdfjs 1-based

  const viewport = pdfPage.getViewport({ scale: SCALE_FACTOR });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  // ページをレンダリング
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;

  // 墨消し領域を黒塗り（Canvas座標に変換）
  ctx.fillStyle = '#000000';
  for (const r of redactions) {
    // PDF座標→Canvas座標変換（回転なし前提、元ページの座標系）
    const cx = r.x * SCALE_FACTOR;
    const cy = (pageHeight - r.y - r.height) * SCALE_FACTOR;
    const cw = r.width * SCALE_FACTOR;
    const ch = r.height * SCALE_FACTOR;
    ctx.fillRect(cx, cy, cw, ch);
  }

  // JPEG変換
  return new Promise<Uint8Array>((resolve) => {
    canvas.toBlob(
      (blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.readAsArrayBuffer(blob!);
      },
      'image/jpeg',
      0.92,
    );
  });
}

/**
 * 墨消し範囲外のテキストアイテムを取得
 */
async function getSurvivingTextItems(
  sourceBuffer: ArrayBuffer,
  sourcePageIndex: number,
  redactions: RedactionArea[],
): Promise<TextItemForRedaction[]> {
  const doc = await loadPdfDocument(sourceBuffer.slice(0));
  const pdfPage = await doc.getPage(sourcePageIndex + 1);
  const textContent = await pdfPage.getTextContent();

  const surviving: TextItemForRedaction[] = [];
  for (const item of textContent.items) {
    if (!('str' in item) || !(item as { str: string }).str) continue;

    const textItem = item as {
      str: string;
      transform: number[];
      width: number;
      height: number;
    };

    // 墨消し領域と交差しないテキストのみ残す
    if (!textItemIntersectsAnyRedaction(
      textItem.transform,
      textItem.width,
      textItem.height,
      redactions,
    )) {
      surviving.push({
        str: textItem.str,
        transform: textItem.transform,
        width: textItem.width,
        height: textItem.height,
      });
    }
  }

  return surviving;
}

/**
 * 非表示テキスト（Rendering Mode 3）をページに追加
 * OCR済みPDFと同じパターン: 視覚的には見えないが、テキスト検索・コピーが可能
 */
function addInvisibleTextLayer(
  page: ReturnType<PDFDocument['getPage']>,
  textItems: TextItemForRedaction[],
  font: Awaited<ReturnType<typeof embedJapaneseFont>>,
  pdfDoc: PDFDocument,
): void {
  // フォントをページリソースに登録
  const fontKey = 'F_redact';

  // ページのResourcesにフォントを追加
  let resources = page.node.get(PDFName.of('Resources'));
  if (!resources) {
    resources = pdfDoc.context.obj({});
    page.node.set(PDFName.of('Resources'), resources);
  }

  // Fontsサブ辞書を取得/作成
  const resourcesDict = resources as unknown as { get(k: PDFName): unknown; set(k: PDFName, v: unknown): void };
  let fonts = resourcesDict.get(PDFName.of('Font'));
  if (!fonts) {
    fonts = pdfDoc.context.obj({});
    resourcesDict.set(PDFName.of('Font'), fonts);
  }
  const fontsDict = fonts as unknown as { set(k: PDFName, v: unknown): void };
  fontsDict.set(PDFName.of(fontKey), font.ref);

  // 非表示テキストをコンテンツストリームとして追加
  // pdf-libのdrawText()はRendering Mode 3をサポートしないため、
  // 生のPDFオペレーターを構築してContentsに追加する
  const operators: string[] = [];
  operators.push('q');        // Save graphics state
  operators.push('BT');       // Begin text
  operators.push('3 Tr');     // Text rendering mode 3 = invisible

  for (const item of textItems) {
    const fontSize = Math.abs(item.transform[3]) || 12;
    const [a, b, c, d, e, f] = item.transform;

    operators.push(`/${fontKey} ${fontSize} Tf`);
    operators.push(`${a} ${b} ${c} ${d} ${e} ${f} Tm`);

    // テキストをPDF HexStringに変換
    const hex = Array.from(new TextEncoder().encode(item.str))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    operators.push(`<${hex}> Tj`);
  }

  operators.push('ET');       // End text
  operators.push('Q');        // Restore graphics state

  const streamContent = operators.join('\n');
  const stream = pdfDoc.context.stream(new TextEncoder().encode(streamContent));
  const streamRef = pdfDoc.context.register(stream);

  // 既存のContentsに追加
  const currentContents = page.node.get(PDFName.of('Contents'));
  if (currentContents) {
    // ContentsをArrayにして追加ストリームを加える
    const contentsArray = PDFArray.withContext(pdfDoc.context);
    if (currentContents instanceof PDFArray) {
      for (let i = 0; i < currentContents.size(); i++) {
        contentsArray.push(currentContents.get(i));
      }
    } else {
      contentsArray.push(currentContents);
    }
    contentsArray.push(streamRef);
    page.node.set(PDFName.of('Contents'), contentsArray);
  } else {
    page.node.set(PDFName.of('Contents'), streamRef);
  }
}
