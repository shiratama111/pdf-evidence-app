import { memo, useRef, useEffect } from 'react';
import type { PdfPage } from '@/types/pdf';
import { loadPdfDocument, renderPageToCanvas } from '@/lib/pdf-renderer';
import { useAppState, useAppDispatch } from '@/state/AppContext';

interface ThumbnailCardProps {
  page: PdfPage;
  globalIndex: number;
  segmentColor: string;
  isSelected: boolean;
  onSelect: (pageId: string, additive: boolean) => void;
  onDoubleClick: (pageId: string) => void;
}

const THUMB_SCALE = 0.4;

export const ThumbnailCard = memo(function ThumbnailCard({
  page, globalIndex, segmentColor, isSelected, onSelect, onDoubleClick,
}: ThumbnailCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dispatch = useAppDispatch();
  const sourceFiles = useAppState().sourceFiles;
  const rendered = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || rendered.current) return;
    const sf = sourceFiles[page.sourceFileId];
    if (!sf) return;

    let cancelled = false;
    (async () => {
      try {
        const doc = await loadPdfDocument(sf.arrayBuffer, page.sourceFileId);
        if (cancelled || !canvasRef.current) return;
        await renderPageToCanvas(doc, page.sourcePageIndex, canvasRef.current, THUMB_SCALE, page.rotation);
        rendered.current = true;
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

  useEffect(() => {
    rendered.current = false;
  }, [page.rotation]);

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
      }`}
      onClick={(e) => onSelect(page.id, e.ctrlKey || e.metaKey)}
      onDoubleClick={() => onDoubleClick(page.id)}
    >
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
