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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pageId,
    data: { type: 'page', segmentId, pageIndex },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative"
      {...attributes}
      {...listeners}
    >
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
