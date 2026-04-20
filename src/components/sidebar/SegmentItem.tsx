import { useState, useCallback, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, GripVertical, Merge, Trash2 } from 'lucide-react';
import { formatStampLabel } from '@/lib/pdf-stamper';
import type { Segment, StampFormat } from '@/types/pdf';

type DragListeners = Record<string, unknown>;

interface BaseSegmentItemProps {
  segment: Segment;
  isLast: boolean;
  pageCount: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  stampEnabled: boolean;
  symbol: string;
  format: StampFormat;
  isSelected: boolean;
  isFocused: boolean;
  onToggleSelect: (id: string) => void;
  onFocus: (id: string) => void;
}

export interface SegmentItemProps extends BaseSegmentItemProps {
  onMergeNext: (id: string) => void;
  isInGroup: boolean;
}

export interface ChildSegmentItemProps extends BaseSegmentItemProps {
  /** 親グループID。D&Dの data.type = 'group-child' の groupId として使う */
  groupId: string;
}

export function SortableSegmentItem(props: SegmentItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
    isOver, overIndex, activeIndex, active,
  } = useSortable({ id: props.segment.id, data: { type: 'segment' } });

  // ドラッグ中は完全非表示（DragOverlay の浮遊プレビューだけを見せる）。
  // 空間は保持されるので他のアイテムが詰まり過ぎず、
  // @dnd-kit の transition と組み合わさって滑らかに動く。
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const activeType = active?.data.current?.type;
  const showReorderLine =
    isOver && activeType !== 'page' && activeType !== 'group-add';
  const insertBelow = activeIndex !== -1 && activeIndex < overIndex;

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      {showReorderLine && (
        <div
          className={`absolute left-0 right-0 h-[3px] bg-blue-500 rounded-full z-20 pointer-events-none shadow-[0_0_6px_rgba(59,130,246,0.6)] ${
            insertBelow ? '-bottom-0.5' : '-top-0.5'
          }`}
          aria-hidden
        />
      )}
      <SegmentRow {...props} dragListeners={listeners} />
    </div>
  );
}

export function SortableChildSegmentItem(props: ChildSegmentItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
    isOver, overIndex, activeIndex, active,
  } = useSortable({
    id: props.segment.id,
    data: { type: 'group-child', groupId: props.groupId },
  });

  // ドラッグ中は完全非表示（DragOverlay の浮遊プレビューだけを見せる）。
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  // 他のgroup-childを掴んでいる時だけ青ラインを出す（他タイプのドラッグでは出さない）
  const activeType = active?.data.current?.type;
  const showReorderLine = isOver && activeType === 'group-child';
  const insertBelow = activeIndex !== -1 && activeIndex < overIndex;

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      {showReorderLine && (
        <div
          className={`absolute left-0 right-0 h-[2px] bg-blue-500 rounded-full z-20 pointer-events-none shadow-[0_0_4px_rgba(59,130,246,0.6)] ${
            insertBelow ? '-bottom-[1px]' : '-top-[1px]'
          }`}
          aria-hidden
        />
      )}
      <ChildSegmentItem {...props} dragListeners={listeners} />
    </div>
  );
}

function useSegmentNameEditor(segment: Segment, onRename: (id: string, name: string) => void) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(segment.name);

  const handleSubmit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== segment.name) {
      onRename(segment.id, trimmed);
    } else {
      setEditValue(segment.name);
    }
    setIsEditing(false);
  }, [editValue, onRename, segment.id, segment.name]);

  const handleCancel = useCallback(() => {
    setEditValue(segment.name);
    setIsEditing(false);
  }, [segment.name]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSubmit();
    if (event.key === 'Escape') handleCancel();
  }, [handleCancel, handleSubmit]);

  const handleStartEdit = useCallback(() => {
    setEditValue(segment.name);
    setIsEditing(true);
  }, [segment.name]);

  return {
    isEditing,
    editValue,
    setEditValue,
    handleSubmit,
    handleKeyDown,
    handleStartEdit,
  };
}

function getEvidenceLabel(
  segment: Segment,
  stampEnabled: boolean,
  symbol: string,
  format: StampFormat,
) {
  return stampEnabled && segment.evidenceNumber
    ? formatStampLabel(symbol, segment.evidenceNumber, format)
    : null;
}

function SegmentRow({
  segment,
  isLast,
  pageCount,
  onRename,
  onDelete,
  onMergeNext,
  stampEnabled,
  symbol,
  format,
  isSelected,
  isFocused,
  onToggleSelect,
  onFocus,
  isInGroup,
  dragListeners,
}: SegmentItemProps & { dragListeners?: DragListeners }) {
  const {
    isEditing,
    editValue,
    setEditValue,
    handleSubmit,
    handleKeyDown,
    handleStartEdit,
  } = useSegmentNameEditor(segment, onRename);
  const evidenceLabel = getEvidenceLabel(segment, stampEnabled, symbol, format);

  return (
    <div
      className={`group mx-1 mb-0.5 rounded border transition-colors cursor-pointer ${
        isSelected
          ? 'bg-blue-50 border-blue-200'
          : isFocused
            ? 'bg-gray-100 border-gray-300'
            : 'bg-white border-gray-200 hover:border-gray-300'
      } ${isInGroup ? 'mx-0 border-x-0 rounded-none mb-0' : ''}`}
      onClick={() => onFocus(segment.id)}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(segment.id)}
          className="rounded border-gray-300 w-3.5 h-3.5 flex-shrink-0 accent-blue-500"
          onClick={(event) => event.stopPropagation()}
        />

        {!isInGroup && dragListeners && (
          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" {...dragListeners}>
            <GripVertical className="w-3.5 h-3.5 text-gray-300" />
          </div>
        )}

        <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />

        {stampEnabled && evidenceLabel && (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-800 whitespace-nowrap flex-shrink-0">
            {evidenceLabel}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              className="w-full text-xs border border-blue-300 rounded px-1 py-0.5 outline-none"
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onBlur={handleSubmit}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div
              className="text-xs text-gray-700 truncate cursor-text"
              onDoubleClick={(event) => {
                event.stopPropagation();
                handleStartEdit();
              }}
              title={segment.name}
            >
              {segment.name}
            </div>
          )}
          <div className="text-[10px] text-gray-400">{pageCount}p</div>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isLast && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onMergeNext(segment.id);
              }}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
              title="次と結合"
            >
              <Merge className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(segment.id);
            }}
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

function ChildSegmentItem({
  segment,
  isLast,
  pageCount,
  onRename,
  onDelete,
  stampEnabled,
  symbol,
  format,
  isSelected,
  isFocused,
  onToggleSelect,
  onFocus,
  dragListeners,
}: ChildSegmentItemProps & { dragListeners?: DragListeners }) {
  const {
    isEditing,
    editValue,
    setEditValue,
    handleSubmit,
    handleKeyDown,
    handleStartEdit,
  } = useSegmentNameEditor(segment, onRename);
  const evidenceLabel = getEvidenceLabel(segment, stampEnabled, symbol, format);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 transition-colors cursor-pointer ${
        isSelected ? 'bg-blue-50' : isFocused ? 'bg-gray-100' : 'hover:bg-gray-50'
      } ${!isLast ? 'border-b border-gray-100' : ''}`}
      onClick={() => onFocus(segment.id)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(segment.id)}
        className="rounded border-gray-300 w-3 h-3 flex-shrink-0 accent-blue-500"
        onClick={(event) => event.stopPropagation()}
      />

      <div className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" {...dragListeners}>
        <GripVertical className="w-3 h-3 text-gray-300" />
      </div>

      <FileText className="w-3 h-3 text-gray-300 flex-shrink-0" />

      {stampEnabled && evidenceLabel && (
        <span className="inline-flex items-center px-1 py-0.5 text-[9px] font-medium rounded bg-amber-50 text-amber-700 whitespace-nowrap flex-shrink-0">
          {evidenceLabel}
        </span>
      )}

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            className="w-full text-[11px] border border-blue-300 rounded px-1 py-0.5 outline-none"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <div
            className="text-[11px] text-gray-600 truncate cursor-text"
            onDoubleClick={(event) => {
              event.stopPropagation();
              handleStartEdit();
            }}
            title={segment.name}
          >
            {segment.name}
          </div>
        )}
      </div>

      <span className="text-[9px] text-gray-400 flex-shrink-0">{pageCount}p</span>

      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete(segment.id);
        }}
        className="p-0.5 rounded hover:bg-red-50 text-red-300 opacity-0 group-hover:opacity-100"
        title="削除"
      >
        <Trash2 className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
