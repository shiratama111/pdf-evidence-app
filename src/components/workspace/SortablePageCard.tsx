/**
 * SortablePageCard.tsx
 *
 * 中央PDF画面で個別ページをD&Dで並び替え・別セグメントへ移動可能にするための、
 * `ThumbnailCard` を `useSortable` でラップした薄い wrapper。
 *
 * 設計:
 * - ドラッグハンドルなし：サムネイル全体が draggable
 * - 選択/ダブルクリックとの両立は、親側 sensors の activationConstraint: { distance: 5 } に依存
 * - useSortable の data に `type: 'page' / segmentId / pageIndex` を載せ、
 *   ThumbnailGrid の handleDragEnd で判別・ディスパッチする
 * - スプリットボタン（✂️）や overlay はこの wrapper 内では扱わず、親側 children として差し込める
 */
import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PdfPage } from '@/types/pdf';
import { ThumbnailCard } from './ThumbnailCard';

interface SortablePageCardProps {
  pageId: string;
  segmentId: string;
  pageIndex: number;
  page: PdfPage;
  globalIndex: number;
  segmentColor: string;
  isSelected: boolean;
  onSelect: (pageId: string, additive: boolean) => void;
  onDoubleClick: (pageId: string) => void;
  /** スプリットボタン等の overlay を差し込む */
  children?: ReactNode;
}

export function SortablePageCard({
  pageId,
  segmentId,
  pageIndex,
  page,
  globalIndex,
  segmentColor,
  isSelected,
  onSelect,
  onDoubleClick,
  children,
}: SortablePageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({
    id: pageId,
    data: { type: 'page', segmentId, pageIndex },
  });

  // ドラッグ元（掴まれている元ページ）は半透明 + 点線枠で「ここから移動中」を明示する。
  // 実体の浮遊プレビューは ThumbnailGrid.tsx の DragOverlay で描画される。
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // 挿入先インジケータ: ページ間をドラッグ中にホバー中のページの左側へ青縦ラインを出す。
  // rectSortingStrategy では over 要素の位置に挿入されるため、常に「このページの前（左側）」に挿入される想定で描画する。
  const isPageDrag = active?.data.current?.type === 'page';
  const showInsertLine = isOver && isPageDrag && active?.id !== pageId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg ${
        isDragging ? 'outline outline-2 outline-dashed outline-blue-400 outline-offset-[-2px]' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      {showInsertLine && (
        <div
          className="absolute -left-[7px] top-1 bottom-1 w-[3px] bg-blue-500 rounded-full z-20 pointer-events-none shadow-[0_0_6px_rgba(59,130,246,0.6)]"
          aria-hidden
        />
      )}
      <ThumbnailCard
        page={page}
        globalIndex={globalIndex}
        segmentColor={segmentColor}
        isSelected={isSelected}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
      />
      {children}
    </div>
  );
}
