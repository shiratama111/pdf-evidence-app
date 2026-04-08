import { useRef, useEffect, useState } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { loadPdfDocument, renderPageToCanvas } from '@/lib/pdf-renderer';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  RotateCw, RotateCcw, Scissors,
} from 'lucide-react';

const PREVIEW_SCALES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function PreviewPanel() {
  const { previewPageId, pages, sourceFiles, segments, isPreviewOpen } = useAppState();
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scaleIdx, setScaleIdx] = useState(2);

  const page = previewPageId ? pages[previewPageId] : null;

  const allPageIds = segments.flatMap(s => s.pageIds);
  const currentIdx = previewPageId ? allPageIds.indexOf(previewPageId) : -1;

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    const sf = sourceFiles[page.sourceFileId];
    if (!sf) return;

    let cancelled = false;
    (async () => {
      const doc = await loadPdfDocument(sf.arrayBuffer, page.sourceFileId);
      if (cancelled || !canvasRef.current) return;
      await renderPageToCanvas(doc, page.sourcePageIndex, canvasRef.current, PREVIEW_SCALES[scaleIdx], page.rotation);
    })();
    return () => { cancelled = true; };
  }, [page, sourceFiles, scaleIdx]);

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

  return (
    <div className="flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full" style={{ width: 720 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          プレビュー {currentIdx + 1} / {allPageIds.length}
        </span>
        <button
          onClick={() => dispatch({ type: 'PREVIEW_SET', payload: { pageId: null } })}
          className="p-1 rounded hover:bg-gray-100"
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
