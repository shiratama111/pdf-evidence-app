import { useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { ThumbnailCard } from './ThumbnailCard';
import { Scissors, RotateCw, RotateCcw, Trash2, Check } from 'lucide-react';

export function ThumbnailGrid() {
  const { segments, pages, selectedPageIds, selectedSegmentIds } = useAppState();
  const dispatch = useAppDispatch();
  const { loadFiles } = usePdfLoader();
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handlePageSelect = (pageId: string, additive: boolean) => {
    dispatch({ type: 'PAGE_SELECTED', payload: { pageId, additive } });
  };

  const handleDoubleClick = (pageId: string) => {
    dispatch({ type: 'PREVIEW_SET', payload: { pageId } });
  };

  const handleSplit = (segmentId: string, afterPageId: string) => {
    dispatch({ type: 'SEGMENT_SPLIT_AT', payload: { segmentId, afterPageId } });
  };

  const handleRotate = (degrees: 90 | -90) => {
    if (selectedPageIds.length === 0) return;
    dispatch({ type: 'PAGES_ROTATED', payload: { pageIds: selectedPageIds, degrees } });
  };

  const handleDelete = () => {
    if (selectedPageIds.length === 0) return;
    dispatch({ type: 'PAGES_DELETED', payload: { pageIds: selectedPageIds } });
    dispatch({ type: 'SELECTION_CLEARED' });
  };

  const handleSegmentToggle = useCallback((segmentId: string) => {
    dispatch({ type: 'SEGMENT_SELECTED', payload: { segmentId, additive: true } });
  }, [dispatch]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files.length > 0) {
      loadFiles(e.dataTransfer.files);
    }
  }, [loadFiles]);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleFileDragLeave = useCallback(() => {
    setIsDraggingFile(false);
  }, []);

  let globalIndex = 0;

  return (
    <div
      className={`flex-1 overflow-y-auto p-4 transition-colors ${isDraggingFile ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''}`}
      onDrop={handleFileDrop}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
    >
      {/* Toolbar */}
      {selectedPageIds.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2 mb-3 p-2 bg-white/90 backdrop-blur rounded-lg border border-gray-200 shadow-sm">
          <span className="text-sm text-gray-600 mr-2">
            {selectedPageIds.length}ページ選択中
          </span>
          <button
            onClick={() => handleRotate(-90)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
            title="左に回転"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
            title="右に回転"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-50 text-red-500"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Segments */}
      {segments.map((seg) => {
        const isSegSelected = selectedSegmentIds.includes(seg.id);
        const startIndex = globalIndex;
        const cards = seg.pageIds.map((pageId, i) => {
          const page = pages[pageId];
          if (!page) return null;
          const idx = startIndex + i;
          globalIndex++;
          return (
            <div key={pageId} className="relative">
              <ThumbnailCard
                page={page}
                globalIndex={idx}
                segmentColor={seg.color}
                isSelected={selectedPageIds.includes(pageId)}
                onSelect={handlePageSelect}
                onDoubleClick={handleDoubleClick}
              />
              {/* Split button between pages */}
              {i < seg.pageIds.length - 1 && (
                <button
                  className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 hover:!opacity-100 p-1 bg-white border border-gray-300 rounded-full shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handleSplit(seg.id, pageId); }}
                  title="ここで分割"
                >
                  <Scissors className="w-3 h-3 text-gray-500" />
                </button>
              )}
            </div>
          );
        });

        return (
          <div
            key={seg.id}
            className={`mb-6 rounded-lg transition-colors ${isSegSelected ? 'bg-blue-50 ring-2 ring-blue-300 p-3 -mx-1' : ''}`}
          >
            {/* Segment header — クリックでセグメント選択 */}
            <div
              className={`flex items-center gap-2 mb-2 px-1 py-1 rounded-md cursor-pointer select-none transition-colors ${
                isSegSelected ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
              onClick={() => handleSegmentToggle(seg.id)}
            >
              {/* チェックボックス */}
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                isSegSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
              }`}>
                {isSegSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-sm font-medium text-gray-700">{seg.name}</span>
              <span className="text-xs text-gray-400">({seg.pageIds.length}p)</span>
            </div>
            {/* Grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 group">
              {cards}
            </div>
          </div>
        );
      })}
    </div>
  );
}
