/**
 * ListEndDropZone.tsx
 *
 * セグメント/グループ一覧の末尾に配置する不可視のドロップゾーン。
 * 最後の要素より下にドロップしたい時に、衝突判定のターゲットがない問題を解消する。
 *
 * 用途:
 * - サイドバー SegmentList の末尾
 * - 中央PDF ThumbnailGrid の末尾
 *
 * 動作:
 * - ドラッグしていない時は高さ 0 で見えない
 * - segment / group-reorder / group-child のドラッグ中だけ高さを確保して衝突検出の対象になる
 * - 自分が isOver の時は青い横長ラインを強調表示
 */
import { useDroppable } from '@dnd-kit/core';

interface ListEndDropZoneProps {
  id: string;
  /** 親が持っているドラッグ中のアクティブタイプ。null/undefined ならドラッグしていない */
  activeType: string | null | undefined;
  className?: string;
}

export function ListEndDropZone({ id, activeType, className }: ListEndDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'list-end' },
  });

  const visible =
    activeType === 'segment' ||
    activeType === 'group-reorder' ||
    activeType === 'group-child';

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-all ${visible ? 'h-8' : 'h-0 pointer-events-none'} ${className ?? ''}`}
      aria-hidden
    >
      {visible && (
        <div
          className={`absolute inset-x-1 top-1/2 -translate-y-1/2 h-[3px] rounded-full transition-opacity ${
            isOver
              ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)] opacity-100'
              : 'bg-blue-300/50 opacity-40'
          }`}
        />
      )}
    </div>
  );
}
