import { useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown, ChevronRight, FolderClosed, FolderOpen, GripVertical, Plus, Ungroup,
} from 'lucide-react';
import type { Segment, StampFormat } from '@/types/pdf';
import { SortableChildSegmentItem } from './SegmentItem';

type DragListeners = Record<string, unknown>;

export interface GroupFolderProps {
  groupId: string;
  mainNum: number;
  childSegments: Segment[];
  isCollapsed: boolean;
  mergeInExport: boolean;
  groupName?: string;
  isFocused: boolean;
  onToggleCollapse: () => void;
  onUngroup: () => void;
  onToggleMerge: (groupId: string, mergeInExport: boolean) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onGroupFocus: (groupId: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  stampEnabled: boolean;
  symbol: string;
  format: StampFormat;
  selectedSegmentIds: string[];
  focusedSegmentId: string | null;
  onToggleSelect: (id: string) => void;
  onFocus: (id: string) => void;
}

export function SortableGroupFolder(props: GroupFolderProps) {
  const sortableId = `grp_${props.groupId}`;
  // 外側: セグメント/グループ並び替え用（tree上の順序変更）
  const {
    attributes, listeners, setNodeRef: setSortableRef,
    transform, transition, isDragging, active,
    isOver, overIndex, activeIndex,
  } = useSortable({
    id: sortableId,
    data: { type: 'group-reorder', groupId: props.groupId },
  });
  // 内側: グループ追加用 - inset 領域に限定することで、中央=add / 端=reorder を空間的に分離
  const { setNodeRef: setDroppableRef, isOver: isOverAdd } = useDroppable({
    id: `add:${props.groupId}`,
    data: { type: 'group-add', groupId: props.groupId },
  });

  // ドラッグ中のアクティブセグメント判定（既に同グループ属している場合は追加ハイライト不要）
  const draggingSegId = active?.data.current?.type === 'segment' ? (active.id as string) : null;
  const isAlreadyInGroup =
    draggingSegId != null && props.childSegments.some((seg) => seg.id === draggingSegId);
  const showAddHighlight = isOverAdd && draggingSegId != null && !isAlreadyInGroup;

  // 並び替え青ライン: 自分が over で add モードではなく、active が page でも group-add でもない
  const activeType = active?.data.current?.type;
  const showReorderLine =
    isOver && !isOverAdd && activeType !== 'page' && activeType !== 'group-add';
  const insertBelow = activeIndex !== -1 && activeIndex < overIndex;

  // ドラッグ中は完全非表示（DragOverlay の浮遊プレビューだけを見せる）。
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setSortableRef} style={style} {...attributes} className="relative">
      {/* 並び替え位置インジケータ（青い横長ライン） */}
      {showReorderLine && (
        <div
          className={`absolute left-0 right-0 h-[3px] bg-blue-500 rounded-full z-20 pointer-events-none shadow-[0_0_6px_rgba(59,130,246,0.6)] ${
            insertBelow ? '-bottom-1' : '-top-1'
          }`}
          aria-hidden
        />
      )}

      {/* inset 領域の add droppable 本体（サイズは小さくレイアウトに影響させない） */}
      <div
        ref={setDroppableRef}
        className="absolute inset-x-2 top-2 bottom-2 z-0 pointer-events-none"
        aria-hidden
      />

      {/* 追加モード中のハイライト（absolute overlay、レイアウト動かさない） */}
      {showAddHighlight && (
        <div className="absolute inset-x-2 top-2 bottom-2 z-10 pointer-events-none ring-2 ring-blue-400/80 rounded bg-blue-50/70 shadow-[0_0_12px_rgba(59,130,246,0.5)] flex items-center justify-center">
          <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-600 bg-white/95 border border-blue-400 rounded select-none">
            <Plus className="w-3 h-3" />
            グループに追加
          </div>
        </div>
      )}

      <GroupFolder {...props} dragListeners={listeners} />
    </div>
  );
}

function GroupFolder({
  groupId,
  mainNum,
  childSegments,
  isCollapsed,
  mergeInExport,
  groupName,
  isFocused,
  onToggleCollapse,
  onUngroup,
  onToggleMerge,
  onGroupRename,
  onGroupFocus,
  onRename,
  onDelete,
  stampEnabled,
  symbol,
  format,
  selectedSegmentIds,
  focusedSegmentId,
  onToggleSelect,
  onFocus,
  dragListeners,
}: GroupFolderProps & { dragListeners?: DragListeners }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(groupName ?? '');

  const totalPages = childSegments.reduce((sum, segment) => sum + segment.pageIds.length, 0);
  const defaultLabel = stampEnabled ? `${symbol}${mainNum}号証` : `グループ (${childSegments.length}件)`;
  const folderLabel = groupName ?? defaultLabel;

  const handleStartEdit = useCallback(() => {
    setEditValue(groupName ?? '');
    setIsEditing(true);
  }, [groupName]);

  const handleSubmitEdit = useCallback(() => {
    onGroupRename(groupId, editValue);
    setIsEditing(false);
  }, [editValue, groupId, onGroupRename]);

  const handleCancelEdit = useCallback(() => {
    setEditValue(groupName ?? '');
    setIsEditing(false);
  }, [groupName]);

  return (
    <div className="mx-1 mb-0.5">
      <div
        className={`flex items-center gap-1 px-1.5 py-1.5 rounded-t border cursor-pointer select-none transition-colors ${
          isFocused ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}
        onClick={() => onGroupFocus(groupId)}
      >
        <div className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" {...dragListeners}>
          <GripVertical className="w-3 h-3 text-gray-300" />
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse();
          }}
          className="flex-shrink-0 p-0.5"
        >
          {isCollapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </button>

        {isCollapsed
          ? <FolderClosed className="w-4 h-4 text-amber-500 flex-shrink-0" />
          : <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              className="w-full text-xs font-semibold border border-blue-300 rounded px-1 py-0.5 outline-none"
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onBlur={handleSubmitEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmitEdit();
                if (event.key === 'Escape') handleCancelEdit();
              }}
              onClick={(event) => event.stopPropagation()}
              autoFocus
              placeholder={defaultLabel}
            />
          ) : (
            <div
              className="text-xs font-semibold text-gray-700 truncate cursor-text"
              onDoubleClick={(event) => {
                event.stopPropagation();
                handleStartEdit();
              }}
              title={`${folderLabel}（ダブルクリックで名前変更）`}
            >
              {folderLabel}
            </div>
          )}
          <div className="text-[10px] text-gray-400">
            {childSegments.length}件 / {totalPages}p
          </div>
        </div>

        <label
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-500 rounded hover:bg-amber-50 cursor-pointer select-none"
          title="ONにすると、この枝番グループを1つのPDFに統合してエクスポートします"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={mergeInExport}
            onChange={(event) => onToggleMerge(groupId, event.target.checked)}
            className="w-3 h-3 accent-amber-500"
          />
          <span className={mergeInExport ? 'text-amber-700 font-semibold' : ''}>統合</span>
        </label>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onUngroup();
          }}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center gap-0.5 text-[10px]"
          title="グループ解除"
        >
          <Ungroup className="w-3.5 h-3.5" />
        </button>
      </div>

      {!isCollapsed && (
        <div className="border-l-2 border-amber-300 border-r border-b border-gray-200 rounded-b bg-white ml-2">
          {/*
           * 親 SegmentList の DndContext 配下で動作する SortableContext。
           * ネストされた DndContext を廃し、group-child の drop を親で扱うことで
           * 「グループ外へ取り出す」経路を解放する（親 handleDragEnd で分岐）。
           */}
          <SortableContext items={childSegments.map((segment) => segment.id)} strategy={verticalListSortingStrategy}>
            {childSegments.map((segment, index) => (
              <SortableChildSegmentItem
                key={segment.id}
                segment={segment}
                groupId={groupId}
                isLast={index === childSegments.length - 1}
                pageCount={segment.pageIds.length}
                onRename={onRename}
                onDelete={onDelete}
                stampEnabled={stampEnabled}
                symbol={symbol}
                format={format}
                isSelected={selectedSegmentIds.includes(segment.id)}
                isFocused={focusedSegmentId === segment.id}
                onToggleSelect={onToggleSelect}
                onFocus={onFocus}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
