/**
 * SortableSegmentBlock.tsx
 *
 * 中央PDF画面（ThumbnailGrid）で使う、セグメント/グループ単位のD&D並び替え可能なブロック。
 *
 * 仕様:
 * - 単独セグメント: 既存のセグメントヘッダー + ページグリッド + ドラッグハンドル（左端 GripVertical）
 * - グループ:       amber外枠 + グループヘッダー + 枝番セグメント縦並び（枝番個別D&D不可）
 * - D&D はドラッグハンドル経由のみ（誤ドラッグ防止）
 * - SegmentList と同じ buildSegmentTree を使ってトップレベル並びを揃える
 */
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, FolderOpen, GripVertical, Scissors } from 'lucide-react';
import type { PdfPage, Segment } from '@/types/pdf';
import type { TreeItem } from '@/lib/segment-tree';
import { getTreeItemId } from '@/lib/segment-tree';
import { SortablePageCard } from './SortablePageCard';
import { SortablePageEndZone } from './SortablePageEndZone';

type DragListeners = Record<string, unknown>;

interface SortableSegmentBlockProps {
  item: TreeItem;
  pages: Record<string, PdfPage>;
  startIndex: number;
  selectedPageIds: string[];
  selectedSegmentIds: string[];
  focusedSegmentId: string | null;
  focusedGroupId: string | null;
  /** ページD&D中フラグ。true の間だけ各セグメント末尾にドロップゾーンを表示する */
  isDraggingPage: boolean;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onPageSelect: (pageId: string, additive: boolean) => void;
  onPageDoubleClick: (pageId: string) => void;
  onSegmentToggle: (segmentId: string) => void;
  onSplit: (segmentId: string, afterPageId: string) => void;
}

export function SortableSegmentBlock(props: SortableSegmentBlockProps) {
  const id = getTreeItemId(props.item);
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id, data: { type: 'segment' } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {props.item.kind === 'single'
        ? <SingleSegmentBlock {...props} item={props.item} dragListeners={listeners} />
        : <GroupSegmentBlock {...props} item={props.item} dragListeners={listeners} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 単独セグメント用
// ---------------------------------------------------------------------------

function SingleSegmentBlock({
  item,
  pages,
  startIndex,
  selectedPageIds,
  selectedSegmentIds,
  focusedSegmentId,
  focusedGroupId,
  isDraggingPage,
  registerRef,
  onPageSelect,
  onPageDoubleClick,
  onSegmentToggle,
  onSplit,
  dragListeners,
}: SortableSegmentBlockProps & {
  item: Extract<TreeItem, { kind: 'single' }>;
  dragListeners?: DragListeners;
}) {
  const seg = item.segment;
  const isSegSelected = selectedSegmentIds.includes(seg.id);
  const isSegFocused =
    focusedSegmentId === seg.id ||
    (!!focusedGroupId && seg.groupId === focusedGroupId);

  return (
    <div
      ref={(el) => registerRef(seg.id, el)}
      className={`mb-6 rounded-lg transition-all ${
        isSegSelected
          ? 'bg-blue-50 ring-2 ring-blue-300 p-3 -mx-1'
          : isSegFocused
            ? 'ring-2 ring-indigo-300 bg-indigo-50/40 p-3 -mx-1'
            : ''
      }`}
    >
      <SegmentHeader
        segment={seg}
        isSelected={isSegSelected}
        isFocused={isSegFocused}
        onToggle={() => onSegmentToggle(seg.id)}
        dragListeners={dragListeners}
      />
      <SegmentPageGrid
        segment={seg}
        pages={pages}
        startIndex={startIndex}
        selectedPageIds={selectedPageIds}
        isDraggingPage={isDraggingPage}
        onPageSelect={onPageSelect}
        onPageDoubleClick={onPageDoubleClick}
        onSplit={onSplit}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// グループ用（枝番一体ブロック）
// ---------------------------------------------------------------------------

function GroupSegmentBlock({
  item,
  pages,
  startIndex,
  selectedPageIds,
  selectedSegmentIds,
  focusedSegmentId,
  focusedGroupId,
  isDraggingPage,
  registerRef,
  onPageSelect,
  onPageDoubleClick,
  onSegmentToggle,
  onSplit,
  dragListeners,
}: SortableSegmentBlockProps & {
  item: Extract<TreeItem, { kind: 'group' }>;
  dragListeners?: DragListeners;
}) {
  const isGroupFocused = focusedGroupId === item.groupId;
  const totalPages = item.segments.reduce(
    (sum, { segment }) => sum + segment.pageIds.length,
    0,
  );
  const groupName = item.segments[0].segment.groupName;
  const defaultLabel = `甲${item.mainNum}号証（${item.segments.length}件）`;
  const folderLabel = groupName ?? defaultLabel;

  // グループ内の累積ページインデックスを計算
  let cursor = startIndex;

  return (
    <div
      className={`mb-6 rounded-lg border-2 border-amber-300 bg-amber-50/20 p-3 transition-all ${
        isGroupFocused ? 'ring-2 ring-indigo-300' : ''
      }`}
    >
      {/* グループヘッダー（ドラッグハンドル付き） */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-amber-100 text-gray-400 hover:text-gray-600"
          {...dragListeners}
          title="ドラッグで並び替え（グループ一体移動）"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-amber-800 truncate" title={folderLabel}>
          {folderLabel}
        </span>
        <span className="text-xs text-amber-600/70">
          {item.segments.length}件 / {totalPages}p
        </span>
      </div>

      {/* 枝番セグメント縦並び（個別D&D不可） */}
      <div className="space-y-4">
        {item.segments.map(({ segment }) => {
          const segStart = cursor;
          cursor += segment.pageIds.length;
          const isSegSelected = selectedSegmentIds.includes(segment.id);
          const isSegFocused = focusedSegmentId === segment.id;

          return (
            <div
              key={segment.id}
              ref={(el) => registerRef(segment.id, el)}
              className={`rounded-lg transition-all ${
                isSegSelected
                  ? 'bg-blue-50 ring-2 ring-blue-300 p-2'
                  : isSegFocused
                    ? 'ring-2 ring-indigo-300 bg-indigo-50/40 p-2'
                    : ''
              }`}
            >
              <SegmentHeader
                segment={segment}
                isSelected={isSegSelected}
                isFocused={isSegFocused}
                onToggle={() => onSegmentToggle(segment.id)}
              />
              <SegmentPageGrid
                segment={segment}
                pages={pages}
                startIndex={segStart}
                selectedPageIds={selectedPageIds}
                isDraggingPage={isDraggingPage}
                onPageSelect={onPageSelect}
                onPageDoubleClick={onPageDoubleClick}
                onSplit={onSplit}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 共通: セグメントヘッダー（チェックボックス・色・名前）
// ---------------------------------------------------------------------------

interface SegmentHeaderProps {
  segment: Segment;
  isSelected: boolean;
  isFocused: boolean;
  onToggle: () => void;
  dragListeners?: DragListeners;
}

function SegmentHeader({
  segment, isSelected, isFocused, onToggle, dragListeners,
}: SegmentHeaderProps) {
  return (
    <div
      className={`flex items-center gap-2 mb-2 px-1 py-1 rounded-md cursor-pointer select-none transition-colors ${
        isSelected ? 'bg-blue-100' : isFocused ? 'bg-indigo-100/60' : 'hover:bg-gray-100'
      }`}
      onClick={onToggle}
    >
      {dragListeners && (
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
          onClick={(e) => e.stopPropagation()}
          {...dragListeners}
          title="ドラッグで並び替え"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
        }`}
      >
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: segment.color }}
      />
      <span className="text-sm font-medium text-gray-700">{segment.name}</span>
      <span className="text-xs text-gray-400">({segment.pageIds.length}p)</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 共通: セグメント内ページグリッド（既存ThumbnailGrid相当）
// ---------------------------------------------------------------------------

interface SegmentPageGridProps {
  segment: Segment;
  pages: Record<string, PdfPage>;
  startIndex: number;
  selectedPageIds: string[];
  isDraggingPage: boolean;
  onPageSelect: (pageId: string, additive: boolean) => void;
  onPageDoubleClick: (pageId: string) => void;
  onSplit: (segmentId: string, afterPageId: string) => void;
}

function SegmentPageGrid({
  segment, pages, startIndex, selectedPageIds, isDraggingPage,
  onPageSelect, onPageDoubleClick, onSplit,
}: SegmentPageGridProps) {
  // ページD&D中は末尾ドロップゾーンを SortableContext の items に含める
  const endZoneId = `end:${segment.id}`;
  const sortableIds = isDraggingPage
    ? [...segment.pageIds, endZoneId]
    : segment.pageIds;

  return (
    <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 group">
        {segment.pageIds.map((pageId, i) => {
          const page = pages[pageId];
          if (!page) return null;
          return (
            <SortablePageCard
              key={pageId}
              pageId={pageId}
              segmentId={segment.id}
              pageIndex={i}
              page={page}
              globalIndex={startIndex + i}
              segmentColor={segment.color}
              isSelected={selectedPageIds.includes(pageId)}
              onSelect={onPageSelect}
              onDoubleClick={onPageDoubleClick}
            >
              {i < segment.pageIds.length - 1 && (
                <button
                  className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 hover:!opacity-100 p-1 bg-white border border-gray-300 rounded-full shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-opacity"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSplit(segment.id, pageId);
                  }}
                  title="ここで分割"
                >
                  <Scissors className="w-3 h-3 text-gray-500" />
                </button>
              )}
            </SortablePageCard>
          );
        })}
        {isDraggingPage && (
          <SortablePageEndZone
            segmentId={segment.id}
            endIndex={segment.pageIds.length}
          />
        )}
      </div>
    </SortableContext>
  );
}
