import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  buildSegmentTree,
  flattenTreeToSegmentIds,
  getTreeItemId,
} from '@/lib/segment-tree';
import { workspaceCollisionDetection } from '@/lib/dnd-utils';
import { SortableSegmentBlock } from './SortableSegmentBlock';
import { ThumbnailCard } from './ThumbnailCard';
import { SegmentDragPreview } from '@/components/common/SegmentDragPreview';
import { ListEndDropZone } from '@/components/common/ListEndDropZone';
import { RotateCw, RotateCcw, Trash2, X } from 'lucide-react';

export function ThumbnailGrid() {
  const {
    segments,
    pages,
    selectedPageIds,
    selectedSegmentIds,
    focusedSegmentId,
    focusedGroupId,
    focusVersion,
  } = useAppState();
  const dispatch = useAppDispatch();
  const { loadFiles } = usePdfLoader();
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  // D&D 中のオーバーレイ表示用（page/segment/group-reorder/group-child 共通）
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    type: 'page' | 'segment' | 'group-reorder' | 'group-child';
  } | null>(null);
  const activePageId = activeDrag?.type === 'page' ? activeDrag.id : null;
  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastScrolledFocusVersionRef = useRef<number>(focusVersion);
  const lastSelectedPageIdRef = useRef<string | null>(null);

  // ドラッグ開始は 5px 移動後（クリック/選択との競合を防ぐ）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tree = useMemo(() => buildSegmentTree(segments), [segments]);
  const sortableIds = useMemo(() => tree.map(getTreeItemId), [tree]);
  const orderedPageIds = useMemo(() => segments.flatMap(segment => segment.pageIds), [segments]);

  // フォーカス変化時にスクロール（focusVersion が変わった時のみ実際にスクロール）
  useEffect(() => {
    if (focusVersion === lastScrolledFocusVersionRef.current) return;
    lastScrolledFocusVersionRef.current = focusVersion;

    let targetSegmentId: string | undefined;
    if (focusedSegmentId) {
      targetSegmentId = focusedSegmentId;
    } else if (focusedGroupId) {
      const firstInGroup = segments.find((s) => s.groupId === focusedGroupId);
      targetSegmentId = firstInGroup?.id;
    }
    if (!targetSegmentId) return;
    const el = segmentRefs.current.get(targetSegmentId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusedSegmentId, focusedGroupId, focusVersion, segments]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) segmentRefs.current.set(id, el);
    else segmentRefs.current.delete(id);
  }, []);

  const handlePageSelect = useCallback((pageId: string, shiftKey: boolean) => {
    const selectedSet = new Set(selectedPageIds);
    const shouldSelect = !selectedSet.has(pageId);

    if (shiftKey && lastSelectedPageIdRef.current) {
      const currentIndex = orderedPageIds.indexOf(pageId);
      const anchorIndex = orderedPageIds.indexOf(lastSelectedPageIdRef.current);
      if (currentIndex !== -1 && anchorIndex !== -1) {
        const start = Math.min(currentIndex, anchorIndex);
        const end = Math.max(currentIndex, anchorIndex);
        const range = orderedPageIds.slice(start, end + 1);
        for (const rangePageId of range) {
          if (shouldSelect) selectedSet.add(rangePageId);
          else selectedSet.delete(rangePageId);
        }
        dispatch({
          type: 'PAGE_SELECTION_SET',
          payload: { pageIds: orderedPageIds.filter(orderedPageId => selectedSet.has(orderedPageId)) },
        });
        lastSelectedPageIdRef.current = pageId;
      } else {
        dispatch({ type: 'PAGE_SELECTED', payload: { pageId, additive: true } });
        lastSelectedPageIdRef.current = pageId;
      }
    } else {
      dispatch({ type: 'PAGE_SELECTED', payload: { pageId, additive: true } });
      lastSelectedPageIdRef.current = pageId;
    }

    const ownerSeg = segments.find((s) => s.pageIds.includes(pageId));
    if (ownerSeg) {
      dispatch({
        type: 'SEGMENT_FOCUSED',
        payload: { segmentId: ownerSeg.id, withScroll: false },
      });
    }
  }, [dispatch, orderedPageIds, selectedPageIds, segments]);

  const handlePageDoubleClick = useCallback((pageId: string) => {
    dispatch({ type: 'PREVIEW_SET', payload: { pageId } });
  }, [dispatch]);

  const handleSplit = useCallback((segmentId: string, afterPageId: string) => {
    dispatch({ type: 'SEGMENT_SPLIT_AT', payload: { segmentId, afterPageId } });
  }, [dispatch]);

  const handleRotate = useCallback((degrees: 90 | -90) => {
    if (selectedPageIds.length === 0) return;
    dispatch({ type: 'PAGES_ROTATED', payload: { pageIds: selectedPageIds, degrees } });
  }, [dispatch, selectedPageIds]);

  const handleDelete = useCallback(() => {
    if (selectedPageIds.length === 0) return;
    dispatch({ type: 'PAGES_DELETED', payload: { pageIds: selectedPageIds } });
    dispatch({ type: 'SELECTION_CLEARED' });
    lastSelectedPageIdRef.current = null;
  }, [dispatch, selectedPageIds]);

  const handleClearSelection = useCallback(() => {
    dispatch({ type: 'SELECTION_CLEARED' });
    lastSelectedPageIdRef.current = null;
  }, [dispatch]);

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const type = event.active.data.current?.type as string | undefined;
    if (type === 'page' || type === 'segment' || type === 'group-reorder' || type === 'group-child') {
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

    // Case 1: ページ D&D（セグメント内並び替え or 別セグメントへ移動）
    if (activeType === 'page') {
      if (overType !== 'page') return; // 現状はページ→ページ間の drop のみ対応

      const targetSegmentId = over.data.current?.segmentId as string | undefined;
      const targetIndex = over.data.current?.pageIndex as number | undefined;
      if (!targetSegmentId || targetIndex == null) return;

      dispatch({
        type: 'PAGES_MOVED',
        payload: {
          pageIds: [active.id as string],
          targetSegmentId,
          targetIndex,
        },
      });
      return;
    }

    // Case 2: セグメント or group-child をグループ中央（group-add droppable）にドロップ → グループ追加
    if ((activeType === 'segment' || activeType === 'group-child') && overType === 'group-add') {
      const targetGroupId = over.data.current?.groupId as string | undefined;
      if (!targetGroupId) return;
      const seg = segments.find((s) => s.id === active.id);
      if (seg?.groupId === targetGroupId) return; // 既に同じグループ
      dispatch({
        type: 'GROUP_SEGMENT_ADDED',
        payload: { segmentId: active.id as string, groupId: targetGroupId },
      });
      return;
    }

    // 明示的 no-op: group-reorder を group-add にドロップしても何もしない
    if (activeType === 'group-reorder' && overType === 'group-add') {
      return;
    }

    // Case 2.5: リスト末尾ドロップゾーン
    if (overType === 'list-end') {
      if (activeType === 'group-child') {
        dispatch({
          type: 'SEGMENT_EJECTED_FROM_GROUP',
          payload: { segmentId: active.id as string, targetIndex: segments.length },
        });
        return;
      }
      if (activeType === 'segment' || activeType === 'group-reorder') {
        const fromIndex = tree.findIndex((item) => getTreeItemId(item) === active.id);
        if (fromIndex === -1 || fromIndex === tree.length - 1) return;
        const newTree = [...tree];
        const [moved] = newTree.splice(fromIndex, 1);
        newTree.push(moved);
        dispatch({
          type: 'SEGMENTS_BULK_REORDERED',
          payload: { segmentIds: flattenTreeToSegmentIds(newTree) },
        });
        return;
      }
    }

    // Case 3: group-child 同士のドロップ
    if (activeType === 'group-child' && overType === 'group-child') {
      const activeGroupId = active.data.current?.groupId as string | undefined;
      const overGroupId = over.data.current?.groupId as string | undefined;
      if (!activeGroupId || !overGroupId) return;

      if (activeGroupId === overGroupId) {
        // 同じグループ内 → 枝番並び替え
        dispatch({
          type: 'GROUP_CHILD_REORDERED',
          payload: {
            groupId: activeGroupId,
            fromSegmentId: active.id as string,
            toSegmentId: over.id as string,
          },
        });
      } else {
        // 別グループの子 → そのグループに移動
        dispatch({
          type: 'GROUP_SEGMENT_ADDED',
          payload: { segmentId: active.id as string, groupId: overGroupId },
        });
      }
      return;
    }

    // Case 4: group-child → segment / group-reorder（トップレベル）にドロップ → グループから離脱
    if (activeType === 'group-child' && (overType === 'segment' || overType === 'group-reorder')) {
      const overTreeIndex = tree.findIndex((item) => getTreeItemId(item) === over.id);
      if (overTreeIndex === -1) return;

      // カーソルの上下で挿入位置を判定
      const activeRect = active.rect.current?.translated;
      const overRect = over.rect;
      const insertBelow = activeRect && overRect
        ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
        : false;

      const overItem = tree[overTreeIndex];
      let targetIndex: number;
      if (overItem.kind === 'single') {
        targetIndex = overItem.originalIndex + (insertBelow ? 1 : 0);
      } else {
        const first = overItem.segments[0].originalIndex;
        const last = overItem.segments[overItem.segments.length - 1].originalIndex;
        targetIndex = insertBelow ? last + 1 : first;
      }

      dispatch({
        type: 'SEGMENT_EJECTED_FROM_GROUP',
        payload: { segmentId: active.id as string, targetIndex },
      });
      return;
    }

    // Case 5: セグメント並び替え（既存挙動）
    if (activeType === 'segment' || activeType === 'group-reorder') {
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
    }
  }, [dispatch, tree, segments]);

  // tree 上の累積ページインデックスを計算
  let runningPageIndex = 0;

  return (
    <div
      className={`flex-1 overflow-y-auto p-4 transition-colors ${
        isDraggingFile ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''
      }`}
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
            onClick={handleClearSelection}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
            title="全ページ選択解除"
          >
            <X className="w-4 h-4" />
          </button>
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

      {/* Sortable Segments / Groups */}
      <DndContext
        sensors={sensors}
        collisionDetection={workspaceCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {tree.map((item) => {
            const itemStartIndex = runningPageIndex;
            const itemPageCount =
              item.kind === 'single'
                ? item.segment.pageIds.length
                : item.segments.reduce(
                    (sum, { segment }) => sum + segment.pageIds.length,
                    0,
                  );
            runningPageIndex += itemPageCount;

            return (
              <SortableSegmentBlock
                key={getTreeItemId(item)}
                item={item}
                pages={pages}
                startIndex={itemStartIndex}
                selectedPageIds={selectedPageIds}
                selectedSegmentIds={selectedSegmentIds}
                focusedSegmentId={focusedSegmentId}
                focusedGroupId={focusedGroupId}
                isDraggingPage={activePageId !== null}
                registerRef={registerRef}
                onPageSelect={handlePageSelect}
                onPageDoubleClick={handlePageDoubleClick}
                onSegmentToggle={handleSegmentToggle}
                onSplit={handleSplit}
              />
            );
          })}
        </SortableContext>

        {/* 末尾ドロップゾーン: リスト最下部にドロップしても確実にヒットさせる */}
        <ListEndDropZone id="workspace-list-end" activeType={activeDrag?.type} />

        {/* カーソル追従の浮遊プレビュー（page/segment/group-reorder すべて対応） */}
        <DragOverlay dropAnimation={null}>
          {activeDrag?.type === 'page' && pages[activeDrag.id] ? (
            <div className="opacity-90 rotate-2 ring-2 ring-blue-400 rounded-lg shadow-2xl cursor-grabbing">
              <ThumbnailCard
                page={pages[activeDrag.id]}
                globalIndex={0}
                segmentColor="#3b82f6"
                isSelected={false}
                onSelect={() => undefined}
                onDoubleClick={() => undefined}
                showCheckbox={false}
              />
            </div>
          ) : activeDrag && (
            activeDrag.type === 'segment' ||
            activeDrag.type === 'group-reorder' ||
            activeDrag.type === 'group-child'
          ) ? (
            <SegmentDragPreview
              activeId={activeDrag.id}
              activeType={activeDrag.type}
              segments={segments}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
