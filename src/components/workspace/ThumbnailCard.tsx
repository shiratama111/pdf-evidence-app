import { memo, useRef, useEffect } from 'react';
import type { PdfPage } from '@/types/pdf';
import { loadPdfDocument, renderPageToCanvas } from '@/lib/pdf-renderer';
import { useAppState, useAppDispatch } from '@/state/AppContext';

interface ThumbnailCardProps {
  page: PdfPage;
  globalIndex: number;
  segmentColor: string;
  isSelected: boolean;
  onSelect: (pageId: string, shiftKey: boolean) => void;
  onDoubleClick: (pageId: string) => void;
  showCheckbox?: boolean;
}

const THUMB_SCALE = 0.4;

export const ThumbnailCard = memo(function ThumbnailCard({
  page, globalIndex, segmentColor, isSelected, onSelect, onDoubleClick, showCheckbox = true,
}: ThumbnailCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dispatch = useAppDispatch();
  const sourceFiles = useAppState().sourceFiles;

  useEffect(() => {
    if (!canvasRef.current) return;
    const sf = sourceFiles[page.sourceFileId];
    if (!sf) return;

    let cancelled = false;
    (async () => {
      try {
        const doc = await loadPdfDocument(sf.arrayBuffer, page.sourceFileId);
        if (cancelled || !canvasRef.current) return;
        await renderPageToCanvas(doc, page.sourcePageIndex, canvasRef.current, THUMB_SCALE, page.rotation);
        canvasRef.current.toBlob((blob) => {
          if (blob && !cancelled) {
            dispatch({ type: 'PAGE_THUMBNAIL_READY', payload: { pageId: page.id, thumbnailUrl: URL.createObjectURL(blob) } });
          }
        });
      } catch (err) {
        console.error('Thumbnail render failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [page.sourceFileId, page.sourcePageIndex, page.rotation, sourceFiles, page.id, dispatch]);

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
      }`}
      onClick={() => {
        onDoubleClick(page.id);
      }}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={isSelected}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            const nativeEvent = e.nativeEvent;
            const shiftKey = 'shiftKey' in nativeEvent ? Boolean(nativeEvent.shiftKey) : false;
            onSelect(page.id, shiftKey);
          }}
          className="absolute left-2 top-2 z-20 h-5 w-5 rounded border-gray-300 bg-white text-blue-600 accent-blue-600 shadow-sm cursor-pointer"
          aria-label={`${globalIndex + 1}ページ目を選択`}
        />
      )}

      {/* Color indicator */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: segmentColor }}
      />

      {/* Canvas */}
      <div className="bg-white p-1 flex items-center justify-center" style={{ minHeight: 160 }}>
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-40 shadow-sm"
        />
      </div>

      {/* Page number */}
      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
        {globalIndex + 1}
      </div>
    </div>
  );
});
