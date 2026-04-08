import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { loadPdfDocument, renderPageToCanvas } from '@/lib/pdf-renderer';
import { formatStampLabel, getEffectiveSymbol } from '@/lib/pdf-stamper';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  RotateCw, RotateCcw, Scissors,
} from 'lucide-react';

const PREVIEW_SCALES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const STAMP_COLORS: Record<string, string> = {
  black: '#000000',
  red: '#cc0000',
  blue: '#0000cc',
};

export function PreviewPanel() {
  const { previewPageId, pages, sourceFiles, segments, isPreviewOpen, stampEnabled, stampSettings } = useAppState();
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scaleIdx, setScaleIdx] = useState(2);
  const [panelWidth, setPanelWidth] = useState(720);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX; // 左にドラッグ = 大きくなる
      const newWidth = Math.max(300, Math.min(1200, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  const page = previewPageId ? pages[previewPageId] : null;

  const allPageIds = segments.flatMap(s => s.pageIds);
  const currentIdx = previewPageId ? allPageIds.indexOf(previewPageId) : -1;

  // このページが所属するセグメント＆ページがセグメントの先頭かどうか
  const ownerSegment = page ? segments.find(s => s.pageIds.includes(page.id)) : null;
  const isFirstPageInSegment = page && ownerSegment ? ownerSegment.pageIds[0] === page.id : false;

  // スタンプラベル（先頭ページのみ）
  const stampLabel = (stampEnabled && isFirstPageInSegment && ownerSegment?.evidenceNumber)
    ? formatStampLabel(getEffectiveSymbol(stampSettings), ownerSegment.evidenceNumber, stampSettings.format)
    : null;

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    const sf = sourceFiles[page.sourceFileId];
    if (!sf) return;

    let cancelled = false;
    (async () => {
      const doc = await loadPdfDocument(sf.arrayBuffer, page.sourceFileId);
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      await renderPageToCanvas(doc, page.sourcePageIndex, canvas, PREVIEW_SCALES[scaleIdx], page.rotation);

      // スタンプオーバーレイ描画
      if (stampLabel && !cancelled) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawStampOverlay(ctx, canvas.width, canvas.height, stampLabel, stampSettings, PREVIEW_SCALES[scaleIdx]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [page, sourceFiles, scaleIdx, stampLabel, stampSettings]);

  if (!isPreviewOpen || !page) return null;

  const handlePrev = () => {
    if (currentIdx > 0) {
      dispatch({ type: 'PREVIEW_SET', payload: { pageId: allPageIds[currentIdx - 1] } });
    }
  };

  const handleNext = () => {
    if (currentIdx < allPageIds.length - 1) {
      dispatch({ type: 'PREVIEW_SET', payload: { pageId: allPageIds[currentIdx + 1] } });
    }
  };

  const handleRotate = (deg: 90 | -90) => {
    dispatch({ type: 'PAGES_ROTATED', payload: { pageIds: [page.id], degrees: deg } });
  };

  const handleSplit = () => {
    for (const seg of segments) {
      const idx = seg.pageIds.indexOf(page.id);
      if (idx !== -1 && idx < seg.pageIds.length - 1) {
        dispatch({ type: 'SEGMENT_SPLIT_AT', payload: { segmentId: seg.id, afterPageId: page.id } });
        break;
      }
    }
  };

  // セグメント情報表示
  const segInfo = ownerSegment
    ? `${ownerSegment.name}${stampLabel ? ` [${stampLabel}]` : ''}`
    : '';

  return (
    <div className="flex-shrink-0 bg-white flex flex-col h-full relative" style={{ width: panelWidth }}>
      {/* リサイズハンドル（左端） */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10 group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400" />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            プレビュー {currentIdx + 1} / {allPageIds.length}
          </span>
          {segInfo && (
            <span className="text-xs text-gray-400 truncate">
              — {segInfo}
            </span>
          )}
        </div>
        <button
          onClick={() => dispatch({ type: 'PREVIEW_SET', payload: { pageId: null } })}
          className="p-1 rounded hover:bg-gray-100 flex-shrink-0"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-center gap-1 p-2 border-b border-gray-100">
        <button onClick={handlePrev} disabled={currentIdx <= 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setScaleIdx(Math.max(0, scaleIdx - 1))} className="p-1 rounded hover:bg-gray-100">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 w-10 text-center">{Math.round(PREVIEW_SCALES[scaleIdx] * 100)}%</span>
        <button onClick={() => setScaleIdx(Math.min(PREVIEW_SCALES.length - 1, scaleIdx + 1))} className="p-1 rounded hover:bg-gray-100">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={handleNext} disabled={currentIdx >= allPageIds.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button onClick={() => handleRotate(-90)} className="p-1 rounded hover:bg-gray-100" title="左に回転">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={() => handleRotate(90)} className="p-1 rounded hover:bg-gray-100" title="右に回転">
          <RotateCw className="w-4 h-4" />
        </button>
        <button onClick={handleSplit} className="p-1 rounded hover:bg-gray-100" title="ここで分割">
          <Scissors className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-2 bg-gray-50">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}

/**
 * Canvas上にスタンプを描画する（プレビュー用）
 * pdf-stamper.ts の drawStampOnPage と同じ位置計算を再現
 */
function drawStampOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  _canvasHeight: number,
  label: string,
  settings: { fontSize: number; fontColor: string; marginTop: number; marginRight: number; showBackground: boolean; showBorder: boolean },
  scale: number,
) {
  const fontSize = settings.fontSize * scale;
  const marginRight = settings.marginRight * scale;
  const marginTop = settings.marginTop * scale;
  const pad = 4 * scale;
  const color = STAMP_COLORS[settings.fontColor] ?? STAMP_COLORS.black;

  ctx.save();
  ctx.font = `bold ${fontSize}px "Yu Gothic", "BIZ UDGothic", "Meiryo", "MS Gothic", sans-serif`;
  const textMetrics = ctx.measureText(label);
  const textWidth = textMetrics.width;

  const x = canvasWidth - marginRight - textWidth - pad;
  const y = marginTop + fontSize + pad;

  // 白背景
  if (settings.showBackground) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x - pad, y - fontSize - pad * 0.5, textWidth + pad * 2, fontSize + pad * 2);
  }

  // 枠線
  if (settings.showBorder) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5 * scale;
    ctx.strokeRect(x - pad, y - fontSize - pad * 0.5, textWidth + pad * 2, fontSize + pad * 2);
  }

  // テキスト
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x, y);

  ctx.restore();
}
