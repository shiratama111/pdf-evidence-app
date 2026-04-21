/**
 * SegmentDragPreview.tsx
 *
 * DragOverlay 内で使う、セグメント/グループのドラッグ中プレビュー表示。
 * 半透明 + 軽い回転 + 青リングで「掴んで持ち上げた」感を出す。
 *
 * ThumbnailGrid / SegmentList 両方の DragOverlay で共通利用。
 */
import { FileText, FolderOpen } from 'lucide-react';
import type { Segment } from '@/types/pdf';

interface SegmentDragPreviewProps {
  activeId: string;
  activeType: 'segment' | 'group-reorder' | 'group-child';
  segments: Segment[];
}

const WRAPPER_CLASS =
  'opacity-85 -rotate-3 ring-2 ring-blue-400 shadow-2xl cursor-grabbing select-none pointer-events-none';

export function SegmentDragPreview({ activeId, activeType, segments }: SegmentDragPreviewProps) {
  // segment / group-child は見た目共通（どちらも単一セグメント）
  if (activeType === 'segment' || activeType === 'group-child') {
    const seg = segments.find((s) => s.id === activeId);
    if (!seg) return null;
    return (
      <div
        className={`${WRAPPER_CLASS} bg-white border border-gray-300 rounded-lg px-3 py-2 min-w-[200px]`}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-700 truncate">{seg.name}</div>
            <div className="text-[10px] text-gray-400">{seg.pageIds.length}p</div>
          </div>
        </div>
      </div>
    );
  }

  // group-reorder: id は `grp_<groupId>` 形式
  const groupId = activeId.startsWith('grp_') ? activeId.slice(4) : activeId;
  const childSegs = segments.filter((s) => s.groupId === groupId);
  if (childSegs.length === 0) return null;

  const mainNum = childSegs[0].evidenceNumber?.main ?? 1;
  const groupName = childSegs[0].groupName ?? `甲${mainNum}号証（${childSegs.length}件）`;
  const totalPages = childSegs.reduce((sum, s) => sum + s.pageIds.length, 0);

  return (
    <div
      className={`${WRAPPER_CLASS} bg-amber-50 border-2 border-amber-300 rounded-lg px-3 py-2 min-w-[220px]`}
    >
      <div className="flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-amber-800 truncate">{groupName}</div>
          <div className="text-[10px] text-amber-600/70">
            {childSegs.length}件 / {totalPages}p
          </div>
        </div>
      </div>
    </div>
  );
}
