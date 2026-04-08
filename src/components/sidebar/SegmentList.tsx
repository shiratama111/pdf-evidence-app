import { useState, useCallback, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Trash2, Merge, GripVertical, Layers, Hash, Group, Ungroup,
  FolderOpen, FolderClosed, ChevronDown, ChevronRight, FileText,
} from 'lucide-react';
import { formatStampLabel, getEffectiveSymbol } from '@/lib/pdf-stamper';
import type { Segment, StampFormat } from '@/types/pdf';

// ── ツリー構造の構築 ──

type TreeItem =
  | { kind: 'single'; segment: Segment; originalIndex: number }
  | { kind: 'group'; groupId: string; mainNum: number; segments: { segment: Segment; originalIndex: number }[] };

function buildTree(segments: Segment[]): TreeItem[] {
  const items: TreeItem[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.groupId) {
      const gid = seg.groupId;
      const group: { segment: Segment; originalIndex: number }[] = [];
      while (i < segments.length && segments[i].groupId === gid) {
        group.push({ segment: segments[i], originalIndex: i });
        i++;
      }
      const mainNum = group[0].segment.evidenceNumber?.main ?? 0;
      items.push({ kind: 'group', groupId: gid, mainNum, segments: group });
    } else {
      items.push({ kind: 'single', segment: seg, originalIndex: i });
      i++;
    }
  }
  return items;
}

/** D&D用のユニークID: グループフォルダは `grp_${groupId}`, 単体は segment.id */
function getTreeItemId(item: TreeItem): string {
  return item.kind === 'group' ? `grp_${item.groupId}` : item.segment.id;
}

// ── メインコンポーネント ──

export function SegmentList() {
  const { segments, pages, stampEnabled, stampSettings, selectedSegmentIds } = useAppState();
  const dispatch = useAppDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tree = useMemo(() => buildTree(segments), [segments]);
  const sortableIds = useMemo(() => tree.map(getTreeItemId), [tree]);

  // フォルダの開閉状態（ローカル）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleCollapse = (gid: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromTreeIdx = tree.findIndex(t => getTreeItemId(t) === active.id);
    const toTreeIdx = tree.findIndex(t => getTreeItemId(t) === over.id);
    if (fromTreeIdx === -1 || toTreeIdx === -1) return;

    // ツリーをフラットなセグメント配列の並び順に変換
    const newTree = [...tree];
    const [moved] = newTree.splice(fromTreeIdx, 1);
    newTree.splice(toTreeIdx, 0, moved);

    const newOrder: string[] = [];
    for (const item of newTree) {
      if (item.kind === 'single') {
        newOrder.push(item.segment.id);
      } else {
        for (const child of item.segments) {
          newOrder.push(child.segment.id);
        }
      }
    }
    dispatch({ type: 'SEGMENTS_BULK_REORDERED', payload: { segmentIds: newOrder } });
  }, [tree, dispatch]);

  const handleRename = useCallback((segmentId: string, name: string) => {
    dispatch({ type: 'SEGMENT_RENAMED', payload: { segmentId, name } });
  }, [dispatch]);

  const handleDelete = useCallback((segmentId: string) => {
    dispatch({ type: 'SEGMENT_DELETED', payload: { segmentId } });
  }, [dispatch]);

  const handleMergeNext = useCallback((segmentId: string) => {
    dispatch({ type: 'SEGMENTS_MERGE', payload: { segmentId, withNextSegment: true } });
  }, [dispatch]);

  const handleMergeAll = useCallback(() => {
    dispatch({ type: 'SEGMENTS_MERGE_ALL' });
  }, [dispatch]);

  const handleAutoAssign = useCallback(() => {
    dispatch({ type: 'EVIDENCE_NUMBERS_AUTO_ASSIGN' });
  }, [dispatch]);

  const handleToggleSelect = useCallback((segmentId: string) => {
    dispatch({ type: 'SEGMENT_SELECTED', payload: { segmentId, additive: true } });
  }, [dispatch]);

  const handleGroup = useCallback(() => {
    dispatch({ type: 'SEGMENTS_GROUPED' });
  }, [dispatch]);

  const handleUngroup = useCallback((groupId: string) => {
    dispatch({ type: 'SEGMENTS_UNGROUPED', payload: { groupId } });
  }, [dispatch]);

  const totalPages = segments.reduce((sum, s) => sum + s.pageIds.length, 0);
  const symbol = getEffectiveSymbol(stampSettings);

  return (
    <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            セグメント
            <span className="ml-1 text-xs text-gray-400 font-normal">
              {segments.length}件 / {totalPages}p
            </span>
          </h2>
          {segments.length > 1 && (
            <button
              onClick={handleMergeAll}
              className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500 flex items-center gap-1"
              title="全結合"
            >
              <Layers className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {stampEnabled && (
            <button
              onClick={handleAutoAssign}
              className="text-xs px-2 py-1 rounded hover:bg-amber-50 text-amber-600 flex items-center gap-1 border border-amber-200"
            >
              <Hash className="w-3 h-3" />
              自動採番
            </button>
          )}
          {selectedSegmentIds.length >= 2 && (
            <button
              onClick={handleGroup}
              className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center gap-1 border border-blue-200"
            >
              <Group className="w-3 h-3" />
              グループ化
            </button>
          )}
          {selectedSegmentIds.length > 0 && (
            <button
              onClick={() => dispatch({ type: 'SEGMENT_SELECTION_CLEARED' })}
              className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500"
            >
              選択解除
            </button>
          )}
        </div>
      </div>

      {/* Tree with D&D */}
      <div className="flex-1 overflow-y-auto py-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {tree.map((item) => {
              if (item.kind === 'group') {
                const isCollapsed = collapsedGroups.has(item.groupId);
                return (
                  <SortableGroupFolder
                    key={item.groupId}
                    groupId={item.groupId}
                    mainNum={item.mainNum}
                    childSegments={item.segments.map(s => s.segment)}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => toggleCollapse(item.groupId)}
                    onUngroup={() => handleUngroup(item.groupId)}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMergeNext={handleMergeNext}
                    stampEnabled={stampEnabled}
                    symbol={symbol}
                    format={stampSettings.format}
                    selectedSegmentIds={selectedSegmentIds}
                    onToggleSelect={handleToggleSelect}
                    pages={pages}
                    allSegments={segments}
                  />
                );
              }
              return (
                <SortableSegmentItem
                  key={item.segment.id}
                  segment={item.segment}
                  isLast={item.originalIndex === segments.length - 1}
                  pageCount={item.segment.pageIds.length}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onMergeNext={handleMergeNext}
                  stampEnabled={stampEnabled}
                  symbol={symbol}
                  format={stampSettings.format}
                  isSelected={selectedSegmentIds.includes(item.segment.id)}
                  onToggleSelect={handleToggleSelect}
                  isInGroup={false}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// ── グループフォルダ ──

interface GroupFolderProps {
  groupId: string;
  mainNum: number;
  childSegments: Segment[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUngroup: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMergeNext: (id: string) => void;
  stampEnabled: boolean;
  symbol: string;
  format: StampFormat;
  selectedSegmentIds: string[];
  onToggleSelect: (id: string) => void;
  pages: Record<string, { thumbnailUrl: string | null }>;
  allSegments: Segment[];
  dragListeners?: Record<string, unknown>;
}

function SortableGroupFolder(props: GroupFolderProps) {
  const sortableId = `grp_${props.groupId}`;
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <GroupFolder {...props} dragListeners={listeners} />
    </div>
  );
}

function GroupFolder({
  mainNum, childSegments, isCollapsed, onToggleCollapse, onUngroup,
  onRename, onDelete, onMergeNext,
  stampEnabled, symbol, format,
  selectedSegmentIds, onToggleSelect,
  allSegments, dragListeners,
}: GroupFolderProps) {
  const totalPages = childSegments.reduce((sum, s) => sum + s.pageIds.length, 0);
  const folderLabel = stampEnabled
    ? `${symbol}${mainNum}号証`
    : `グループ (${childSegments.length}件)`;

  return (
    <div className="mx-1 mb-0.5">
      {/* フォルダヘッダー */}
      <div className="flex items-center gap-1 px-1.5 py-1.5 bg-white rounded-t border border-gray-200 hover:bg-gray-50 cursor-pointer select-none">
        {/* ドラッグハンドル */}
        <div className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" {...dragListeners}>
          <GripVertical className="w-3 h-3 text-gray-300" />
        </div>

        {/* 開閉トグル */}
        <button onClick={onToggleCollapse} className="flex-shrink-0 p-0.5">
          {isCollapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          }
        </button>

        {/* フォルダアイコン */}
        {isCollapsed
          ? <FolderClosed className="w-4 h-4 text-amber-500 flex-shrink-0" />
          : <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
        }

        {/* フォルダ名 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-700 truncate">
            {folderLabel}
          </div>
          <div className="text-[10px] text-gray-400">
            {childSegments.length}件 / {totalPages}p
          </div>
        </div>

        {/* グループ解除 */}
        <button
          onClick={(e) => { e.stopPropagation(); onUngroup(); }}
          className="p-0.5 rounded hover:bg-gray-200 text-gray-400 opacity-0 group-hover:opacity-100"
          title="グループ解除"
        >
          <Ungroup className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 子セグメント */}
      {!isCollapsed && (
        <div className="border-l-2 border-amber-300 border-r border-b border-gray-200 rounded-b bg-white ml-2">
          {childSegments.map((seg, idx) => (
            <ChildSegmentItem
              key={seg.id}
              segment={seg}
              isLast={idx === childSegments.length - 1}
              isLastInAll={allSegments[allSegments.length - 1]?.id === seg.id}
              pageCount={seg.pageIds.length}
              onRename={onRename}
              onDelete={onDelete}
              onMergeNext={onMergeNext}
              stampEnabled={stampEnabled}
              symbol={symbol}
              format={format}
              isSelected={selectedSegmentIds.includes(seg.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 単体セグメント（ソータブル） ──

interface SegmentItemProps {
  segment: Segment;
  isLast: boolean;
  pageCount: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMergeNext: (id: string) => void;
  stampEnabled: boolean;
  symbol: string;
  format: StampFormat;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  isInGroup: boolean;
}

function SortableSegmentItem(props: SegmentItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: props.segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SegmentRow {...props} dragListeners={listeners} />
    </div>
  );
}

// ── セグメント行（共通） ──

function SegmentRow({
  segment, isLast, pageCount, onRename, onDelete, onMergeNext,
  stampEnabled, symbol, format, isSelected, onToggleSelect,
  isInGroup, dragListeners,
}: SegmentItemProps & { dragListeners?: Record<string, unknown> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(segment.name);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== segment.name) {
      onRename(segment.id, trimmed);
    } else {
      setEditValue(segment.name);
    }
    setIsEditing(false);
  };

  const evidenceLabel = segment.evidenceNumber
    ? formatStampLabel(symbol, segment.evidenceNumber, format)
    : null;

  return (
    <div className={`group mx-1 mb-0.5 rounded border transition-colors ${
      isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'
    } ${isInGroup ? 'mx-0 border-x-0 rounded-none mb-0' : ''}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(segment.id)}
          className="rounded border-gray-300 w-3.5 h-3.5 flex-shrink-0 accent-blue-500"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Drag handle (単体のみ) */}
        {!isInGroup && dragListeners && (
          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" {...dragListeners}>
            <GripVertical className="w-3.5 h-3.5 text-gray-300" />
          </div>
        )}

        {/* ファイルアイコン */}
        <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />

        {/* 証拠番号バッジ */}
        {stampEnabled && evidenceLabel && (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-800 whitespace-nowrap flex-shrink-0">
            {evidenceLabel}
          </span>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              className="w-full text-xs border border-blue-300 rounded px-1 py-0.5 outline-none"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setEditValue(segment.name); setIsEditing(false); } }}
              autoFocus
            />
          ) : (
            <div
              className="text-xs text-gray-700 truncate cursor-text"
              onDoubleClick={() => { setEditValue(segment.name); setIsEditing(true); }}
              title={segment.name}
            >
              {segment.name}
            </div>
          )}
          <div className="text-[10px] text-gray-400">{pageCount}p</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isLast && (
            <button
              onClick={() => onMergeNext(segment.id)}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
              title="次と結合"
            >
              <Merge className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => onDelete(segment.id)}
            className="p-0.5 rounded hover:bg-red-50 text-red-400"
            title="削除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── グループ内の子セグメント行 ──

interface ChildSegmentItemProps {
  segment: Segment;
  isLast: boolean;
  isLastInAll: boolean;
  pageCount: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMergeNext: (id: string) => void;
  stampEnabled: boolean;
  symbol: string;
  format: StampFormat;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

function ChildSegmentItem({
  segment, isLast, pageCount, onRename, onDelete,
  stampEnabled, symbol, format, isSelected, onToggleSelect,
}: ChildSegmentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(segment.name);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== segment.name) {
      onRename(segment.id, trimmed);
    } else {
      setEditValue(segment.name);
    }
    setIsEditing(false);
  };

  const evidenceLabel = segment.evidenceNumber
    ? formatStampLabel(symbol, segment.evidenceNumber, format)
    : null;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 transition-colors ${
      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
    } ${!isLast ? 'border-b border-gray-100' : ''}`}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(segment.id)}
        className="rounded border-gray-300 w-3 h-3 flex-shrink-0 accent-blue-500"
        onClick={(e) => e.stopPropagation()}
      />

      {/* ファイルアイコン */}
      <FileText className="w-3 h-3 text-gray-300 flex-shrink-0" />

      {/* 枝番バッジ */}
      {stampEnabled && evidenceLabel && (
        <span className="inline-flex items-center px-1 py-0.5 text-[9px] font-medium rounded bg-amber-50 text-amber-700 whitespace-nowrap flex-shrink-0">
          {evidenceLabel}
        </span>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            className="w-full text-[11px] border border-blue-300 rounded px-1 py-0.5 outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setEditValue(segment.name); setIsEditing(false); } }}
            autoFocus
          />
        ) : (
          <div
            className="text-[11px] text-gray-600 truncate cursor-text"
            onDoubleClick={() => { setEditValue(segment.name); setIsEditing(true); }}
            title={segment.name}
          >
            {segment.name}
          </div>
        )}
      </div>

      {/* Page count */}
      <span className="text-[9px] text-gray-400 flex-shrink-0">{pageCount}p</span>

      {/* Delete */}
      <button
        onClick={() => onDelete(segment.id)}
        className="p-0.5 rounded hover:bg-red-50 text-red-300 opacity-0 group-hover:opacity-100"
        title="削除"
      >
        <Trash2 className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
