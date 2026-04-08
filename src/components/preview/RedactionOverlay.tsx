/**
 * RedactionOverlay - プレビューCanvas上の墨消し矩形描画・表示・削除UI
 */
import { useState, useCallback, useRef } from 'react';
import { useAppDispatch } from '@/state/AppContext';
import type { PageId, RedactionArea } from '@/types/pdf';
import { pdfToCanvasRect, canvasToPdfRect } from '@/lib/redaction-coords';

interface RedactionOverlayProps {
  pageId: PageId;
  canvasWidth: number;
  canvasHeight: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  rotation: number;
  redactions: RedactionArea[];
  isDrawMode: boolean;
}

interface DrawingRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function RedactionOverlay({
  pageId, canvasWidth, canvasHeight, pageWidth, pageHeight,
  scale, rotation, redactions, isDrawMode,
}: RedactionOverlayProps) {
  const dispatch = useAppDispatch();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<DrawingRect | null>(null);
  // 削除ボタンクリック中フラグ（ドラッグ開始を抑止するため）
  const deletingRef = useRef(false);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDrawMode || deletingRef.current) return;
    const pos = getRelativePos(e);
    setDrawing({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
  }, [isDrawMode, getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    const pos = getRelativePos(e);
    setDrawing(prev => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
  }, [drawing, getRelativePos]);

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    const w = Math.abs(drawing.currentX - drawing.startX);
    const h = Math.abs(drawing.currentY - drawing.startY);
    if (w >= 10 && h >= 10) {
      const canvasRect = {
        x: Math.min(drawing.startX, drawing.currentX),
        y: Math.min(drawing.startY, drawing.currentY),
        width: w,
        height: h,
      };
      const pdfRect = canvasToPdfRect(canvasRect, pageWidth, pageHeight, scale, rotation);
      dispatch({ type: 'REDACTION_ADDED', payload: { pageId, redaction: { id: crypto.randomUUID(), ...pdfRect } } });
    }
    setDrawing(null);
  }, [drawing, pageId, pageWidth, pageHeight, scale, rotation, dispatch]);

  return (
    <>
      {/* 描画用オーバーレイ（墨消しモード時のみマウスイベントを受ける） */}
      <div
        ref={overlayRef}
        className="absolute top-0 left-0"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          cursor: isDrawMode ? 'crosshair' : 'default',
          pointerEvents: isDrawMode ? 'auto' : 'none',
          zIndex: 5,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (drawing) setDrawing(null); }}
      >
        {/* ドラッグ中の矩形プレビュー */}
        {drawing && (
          <div
            className="absolute border-2 border-red-500 border-dashed pointer-events-none"
            style={{
              left: Math.min(drawing.startX, drawing.currentX),
              top: Math.min(drawing.startY, drawing.currentY),
              width: Math.abs(drawing.currentX - drawing.startX),
              height: Math.abs(drawing.currentY - drawing.startY),
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
            }}
          />
        )}
      </div>

      {/* 墨消し矩形の表示レイヤー（常に表示、独立したz-index） */}
      {redactions.map((r) => {
        const canvasR = pdfToCanvasRect(r, pageWidth, pageHeight, scale, rotation);
        return (
          <div key={r.id}>
            {/* 墨消し矩形本体 */}
            <div
              className="absolute border-2"
              style={{
                left: canvasR.x,
                top: canvasR.y,
                width: canvasR.width,
                height: canvasR.height,
                backgroundColor: isDrawMode ? 'rgba(220, 38, 38, 0.3)' : 'rgba(0, 0, 0, 0.7)',
                borderColor: isDrawMode ? 'rgba(220, 38, 38, 0.8)' : 'rgba(0, 0, 0, 0.9)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
            {/* 削除ボタン（矩形の右上、最前面に独立配置） */}
            {isDrawMode && (
              <div
                className="absolute"
                style={{
                  left: canvasR.x + canvasR.width - 8,
                  top: canvasR.y - 8,
                  zIndex: 50,
                  pointerEvents: 'auto',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deletingRef.current = true;
                  dispatch({ type: 'REDACTION_REMOVED', payload: { pageId, redactionId: r.id } });
                  setTimeout(() => { deletingRef.current = false; }, 100);
                }}
              >
                <div className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer text-xs font-bold select-none">
                  ✕
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
