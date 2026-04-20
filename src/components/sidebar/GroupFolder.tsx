import { useState, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown, ChevronRight, FolderClosed, FolderOpen, GripVertical, Ungroup,
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
  onChildReorder: (groupId: string, fromSegmentId: string, toSegmentId: string) => void;
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
  onChildReorder,
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(groupName ?? '');

  const totalPages = childSegments.reduce((sum, segment) => sum + segment.pageIds.length, 0);
  const defaultLabel = stampEnabled ? `${symbol}${mainNum}号証` : `グループ (${childSegments.length}件)`;
  const folderLabel = groupName ?? defaultLabel;

  const handleChildDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChildReorder(groupId, active.id as string, over.id as string);
  }, [groupId, onChildReorder]);

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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd}>
            <SortableContext items={childSegments.map((segment) => segment.id)} strategy={verticalListSortingStrategy}>
              {childSegments.map((segment, index) => (
                <SortableChildSegmentItem
                  key={segment.id}
                  segment={segment}
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
          </DndContext>
        </div>
      )}
    </div>
  );
}
