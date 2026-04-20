/**
 * SortablePageEndZone.tsx
 *
 * 各セグメントの末尾に配置する「末尾ドロップゾーン」。
 * ページD&D中にのみ表示されるように親側で制御し、ここにドロップすると
 * 当該セグメントの末尾（pageIds.length の位置）にページが挿入される。
 *
 * 設計:
 * - useSortable に data: { type: 'page', segmentId, pageIndex: endIndex } を設定
 * - ThumbnailGrid.tsx の handleDragEnd が `over.data.current.type === 'page'` を
 *   そのまま処理してくれるので、既存ロジックの変更不要
 * - 点線枠で「末尾に挿入」を視認でき、ホバー時は左側に青縦ラインを表示
 */
import { useSortable } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

interface SortablePageEndZoneProps {
  segmentId: string;
  endIndex: number;
}

export function SortablePageEndZone({ segmentId, endIndex }: SortablePageEndZoneProps) {
  const { setNodeRef, isOver, active } = useSortable({
    id: `end:${segmentId}`,
    data: { type: 'page', segmentId, pageIndex: endIndex },
  });

  const isPageDrag = active?.data.current?.type === 'page';
  const showLine = isOver && isPageDrag;

  return (
    <div
      ref={setNodeRef}
      className="relative flex flex-col items-center justify-center min-h-[160px] rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/40 text-xs text-blue-500 font-medium select-none pointer-events-auto"
      aria-label="末尾に挿入"
    >
      {showLine && (
        <div
          className="absolute -left-[7px] top-1 bottom-1 w-[3px] bg-blue-500 rounded-full z-20 pointer-events-none shadow-[0_0_6px_rgba(59,130,246,0.6)]"
          aria-hidden
        />
      )}
      <Plus className="w-5 h-5 mb-1" />
      <span>末尾に挿入</span>
    </div>
  );
}
