import { useState, useCallback, useMemo, type DragEvent } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Group, Hash, Layers } from 'lucide-react';
import { getEffectiveSymbol } from '@/lib/pdf-stamper';
import {
  buildSegmentTree,
  flattenTreeToSegmentIds,
  getTreeItemId,
} from '@/lib/segment-tree';
import { sidebarCollisionDetection } from '@/lib/dnd-utils';
import { SegmentDragPreview } from '@/components/common/SegmentDragPreview';
import { SortableGroupFolder } from './GroupFolder';
import { SortableSegmentItem } from './SegmentItem';

export function SegmentList() {
  const {
    segments,
    stampEnabled,
    stampSettings,
    selectedSegmentIds,
    focusedSegmentId,
    focusedGroupId,
  } = useAppState();
  const dispatch = useAppDispatch();
  const { loadFiles } = usePdfLoader();
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // D&D 中のオーバーレイ表示用
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    type: 'segment' | 'group-reorder';
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tree = useMemo(() => buildSegmentTree(segments), [segments]);
  const sortableIds = useMemo(() => tree.map(getTreeItemId), [tree]);
  const totalPages = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.pageIds.length, 0),
    [segments],
  );
  const symbol = useMemo(() => getEffectiveSymbol(stampSettings), [stampSettings]);

  const focusFirstPage = useCallback((pageId?: string) => {
    if (!pageId) return;
    dispatch({ type: 'PAGE_SELECTED', payload: { pageId, additive: false } });
    dispatch({ type: 'PREVIEW_SET', payload: { pageId } });
  }, [dispatch]);

  const handleFileDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    if (event.dataTransfer.files.length > 0) {
      loadFiles(event.dataTransfer.files);
    }
  }, [loadFiles]);

  const handleFileDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleFileDragLeave = useCallback(() => {
    setIsDraggingFile(false);
  }, []);

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const type = event.active.data.current?.type as string | undefined;
    if (type === 'segment' || type === 'group-reorder') {
      setActiveDrag({ id: event.active.id as string, type });
    } else {
      setActiveDrag(null);
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // ケース1: セグメントをグループ中央 (add droppable) にドロップ → グループ追加
    if (activeType === 'segment' && overType === 'group-add') {
      const targetGroupId = over.data.current?.groupId as string | undefined;
      if (!targetGroupId) return;
      // 既に同じグループに属している場合はノーオペレーション
      const seg = segments.find((s) => s.id === active.id);
      if (seg?.groupId === targetGroupId) return;
      dispatch({
        type: 'GROUP_SEGMENT_ADDED',
        payload: { segmentId: active.id as string, groupId: targetGroupId },
      });
      return;
    }

    // 明示的 no-op: group-reorder を group-add にドロップしてもグループ並び替えには使わない
    // （collision detection 側で除外済みだが、意図を残すため明示）
    if (activeType === 'group-reorder' && overType === 'group-add') {
      return;
    }

    // ケース2: セグメント／グループの並び替え（over が group-reorder / segment の場合）
    const fromIndex = tree.findIndex((item) => getTreeItemId(item) === active.id);
    const toIndex = tree.findIndex((item) => getTreeItemId(item) === over.id);
    if (fromIndex === -1 || toIndex === -1) return;

    const newTree = [...tree];
    const [moved] = newTree.splice(fromIndex, 1);
    newTree.splice(toIndex, 0, moved);

    dispatch({
      type: 'SEGMENTS_BULK_REORDERED',
      payload: { segmentIds: flattenTreeToSegmentIds(newTree) },
    });
  }, [dispatch, tree, segments]);

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

  const handleFocusSegment = useCallback((segmentId: string) => {
    dispatch({ type: 'SEGMENT_FOCUSED', payload: { segmentId } });
    focusFirstPage(segments.find((segment) => segment.id === segmentId)?.pageIds[0]);
  }, [dispatch, focusFirstPage, segments]);

  const handleGroup = useCallback(() => {
    dispatch({ type: 'SEGMENTS_GROUPED' });
  }, [dispatch]);

  const handleUngroup = useCallback((groupId: string) => {
    dispatch({ type: 'SEGMENTS_UNGROUPED', payload: { groupId } });
  }, [dispatch]);

  const handleChildReorder = useCallback((
    groupId: string,
    fromSegmentId: string,
    toSegmentId: string,
  ) => {
    dispatch({
      type: 'GROUP_CHILD_REORDERED',
      payload: { groupId, fromSegmentId, toSegmentId },
    });
  }, [dispatch]);

  const handleToggleMerge = useCallback((groupId: string, mergeInExport: boolean) => {
    dispatch({ type: 'GROUP_MERGE_TOGGLED', payload: { groupId, mergeInExport } });
  }, [dispatch]);

  const handleGroupRename = useCallback((groupId: string, name: string) => {
    dispatch({ type: 'GROUP_RENAMED', payload: { groupId, name } });
  }, [dispatch]);

  const handleGroupFocus = useCallback((groupId: string) => {
    dispatch({ type: 'GROUP_FOCUSED', payload: { groupId } });
    focusFirstPage(segments.find((segment) => segment.groupId === groupId)?.pageIds[0]);
  }, [dispatch, focusFirstPage, segments]);

  return (
    <div
      className={`w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col h-full transition-colors ${isDraggingFile ? 'bg-blue-50' : ''}`}
      onDrop={handleFileDrop}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
    >
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

      <div className="flex-1 overflow-y-auto py-1">
        <DndContext
          sensors={sensors}
          collisionDetection={sidebarCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {tree.map((item) => (
              item.kind === 'group' ? (
                <SortableGroupFolder
                  key={item.groupId}
                  groupId={item.groupId}
                  mainNum={item.mainNum}
                  childSegments={item.segments.map(({ segment }) => segment)}
                  isCollapsed={collapsedGroups.has(item.groupId)}
                  mergeInExport={item.segments[0].segment.mergeInExport ?? false}
                  groupName={item.segments[0].segment.groupName}
                  isFocused={focusedGroupId === item.groupId}
                  onToggleCollapse={() => toggleCollapse(item.groupId)}
                  onUngroup={() => handleUngroup(item.groupId)}
                  onToggleMerge={handleToggleMerge}
                  onGroupRename={handleGroupRename}
                  onGroupFocus={handleGroupFocus}
                  onChildReorder={handleChildReorder}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  stampEnabled={stampEnabled}
                  symbol={symbol}
                  format={stampSettings.format}
                  selectedSegmentIds={selectedSegmentIds}
                  focusedSegmentId={focusedSegmentId}
                  onToggleSelect={handleToggleSelect}
                  onFocus={handleFocusSegment}
                />
              ) : (
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
                  isFocused={focusedSegmentId === item.segment.id}
                  onToggleSelect={handleToggleSelect}
                  onFocus={handleFocusSegment}
                  isInGroup={false}
                />
              )
            ))}
          </SortableContext>

          {/* カーソル追従の浮遊プレビュー（segment/group-reorder 両対応） */}
          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              <SegmentDragPreview
                activeId={activeDrag.id}
                activeType={activeDrag.type}
                segments={segments}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
