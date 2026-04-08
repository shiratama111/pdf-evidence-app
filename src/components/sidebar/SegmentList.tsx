import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { formatStampLabel, getEffectiveSymbol } from '@/lib/pdf-stamper';
import type { StampFormat } from '@/types/pdf';

export function SegmentList() {
  const { segments, pages, stampEnabled, stampSettings, selectedSegmentIds } = useAppState();
  const dispatch = useAppDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = segments.findIndex(s => s.id === active.id);
    const toIndex = segments.findIndex(s => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      dispatch({ type: 'SEGMENT_REORDERED', payload: { fromIndex, toIndex } });
    }
  }, [segments, dispatch]);

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

  const handleToggleSelect = useCallback((segmentId: string, additive: boolean) => {
    dispatch({ type: 'SEGMENT_SELECTED', payload: { segmentId, additive } });
  }, [dispatch]);

  const handleGroup = useCallback(() => {
    dispatch({ type: 'SEGMENTS_GROUPED' });
  }, [dispatch]);

  const handleUngroup = useCallback((groupId: string) => {
    dispatch({ type: 'SEGMENTS_UNGROUPED', payload: { groupId } });
  }, [dispatch]);

  const totalPages = segments.reduce((sum, s) => sum + s.pageIds.length, 0);
  const symbol = getEffectiveSymbol(stampSettings);

  // グループの最初のセグメントかどうかを判定
  const isGroupStart = (idx: number) => {
    const seg = segments[idx];
    if (!seg.groupId) return false;
    return idx === 0 || segments[idx - 1].groupId !== seg.groupId;
  };
  const isGroupEnd = (idx: number) => {
    const seg = segments[idx];
    if (!seg.groupId) return false;
    return idx === segments.length - 1 || segments[idx + 1].groupId !== seg.groupId;
  };

  return (
    <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-100">
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
              全結合
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

      {/* Segment items with D&D */}
      <div className="flex-1 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={segments.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {segments.map((seg, idx) => (
              <SortableSegmentItem
                key={seg.id}
                segment={seg}
                isLast={idx === segments.length - 1}
                pageCount={seg.pageIds.length}
                firstPageThumb={pages[seg.pageIds[0]]?.thumbnailUrl}
                onRename={handleRename}
                onDelete={handleDelete}
                onMergeNext={handleMergeNext}
                onUngroup={handleUngroup}
                stampEnabled={stampEnabled}
                symbol={symbol}
                format={stampSettings.format}
                isSelected={selectedSegmentIds.includes(seg.id)}
                onToggleSelect={handleToggleSelect}
                isGroupStart={isGroupStart(idx)}
                isGroupEnd={isGroupEnd(idx)}
                isInGroup={!!seg.groupId}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

interface SortableSegmentItemProps {
  segment: { id: string; name: string; color: string; isCollapsed: boolean; pageIds: string[]; evidenceNumber: { main: number; sub: number | null } | null; groupId: string | null };
  isLast: boolean;
  pageCount: number;
  firstPageThumb: string | null | undefined;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMergeNext: (id: string) => void;
  onUngroup: (groupId: string) => void;
  stampEnabled: boolean;
  symbol: string;
  format: StampFormat;
  isSelected: boolean;
  onToggleSelect: (id: string, additive: boolean) => void;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  isInGroup: boolean;
}

function SortableSegmentItem(props: SortableSegmentItemProps) {
  const { segment } = props;
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SegmentItem {...props} dragListeners={listeners} />
    </div>
  );
}

function SegmentItem({
  segment, isLast, pageCount, onRename, onDelete, onMergeNext, onUngroup,
  stampEnabled, symbol, format, isSelected, onToggleSelect,
  isGroupStart, isGroupEnd, isInGroup, dragListeners,
}: SortableSegmentItemProps & { dragListeners?: Record<string, unknown> }) {
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

  // グループ枠のスタイル
  const groupBorderClass = isInGroup
    ? `border-l-2 border-blue-300 ml-1 ${isGroupStart ? 'border-t-2 rounded-tl mt-0.5' : ''} ${isGroupEnd ? 'border-b-2 rounded-bl mb-0.5' : ''}`
    : '';

  return (
    <div className={`border-b border-gray-50 group ${isSelected ? 'bg-blue-50' : ''} ${groupBorderClass}`}>
      {/* グループヘッダー（最初の要素のみ） */}
      {isGroupStart && (
        <div className="flex items-center justify-between px-2 pt-1 pb-0.5 bg-blue-50/50">
          <span className="text-[10px] text-blue-500 font-medium flex items-center gap-1">
            <Group className="w-2.5 h-2.5" />
            枝番グループ
          </span>
          <button
            onClick={() => segment.groupId && onUngroup(segment.groupId)}
            className="text-[10px] px-1 py-0.5 rounded hover:bg-gray-100 text-gray-400 flex items-center gap-0.5"
          >
            <Ungroup className="w-2.5 h-2.5" />
            解除
          </button>
        </div>
      )}

      {/* Evidence number badge */}
      {stampEnabled && evidenceLabel && (
        <div className="flex items-center px-2 pt-1 pb-0.5">
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-500 font-medium">{evidenceLabel}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-2 py-2 hover:bg-gray-50">
        {/* Checkbox for selection */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(segment.id, true)}
          className="rounded border-gray-300 w-3.5 h-3.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Drag handle */}
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          {...dragListeners}
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-300" />
        </div>

        {/* Color dot */}
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              className="w-full text-sm border border-blue-300 rounded px-1 py-0.5 outline-none"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setEditValue(segment.name); setIsEditing(false); } }}
              autoFocus
            />
          ) : (
            <div
              className="text-sm text-gray-700 truncate cursor-text"
              onDoubleClick={() => { setEditValue(segment.name); setIsEditing(true); }}
              title={segment.name}
            >
              {segment.name}
            </div>
          )}
          <div className="text-xs text-gray-400">{pageCount}ページ</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isLast && (
            <button
              onClick={() => onMergeNext(segment.id)}
              className="p-1 rounded hover:bg-gray-200 text-gray-400"
              title="次と結合"
            >
              <Merge className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(segment.id)}
            className="p-1 rounded hover:bg-red-50 text-red-400"
            title="セグメント削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
