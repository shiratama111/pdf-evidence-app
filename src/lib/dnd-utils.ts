/**
 * @dnd-kit 共通ユーティリティ。
 *
 * ドラッグ中の active.data.current.type に応じて collision detection の対象を
 * 絞り込む。これにより:
 * - page ドラッグ中にセグメント/グループ droppable が干渉しない
 * - segment ドラッグ中に page droppable が干渉しない
 * - group-reorder ドラッグ中に group-add に吸われない（group同士の並び替え維持）
 * - group-child（グループ内セグメント）ドラッグ中は全タイプにヒット可能
 *   → handleDragEnd 側で「同グループの枝番並び替え / 他グループへ移動 / グループ離脱」を分岐
 */
import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core';

type DetectionArgs = Parameters<CollisionDetection>[0];

function filterByType(
  args: DetectionArgs,
  allow: (type: unknown) => boolean,
): DetectionArgs {
  return {
    ...args,
    droppableContainers: args.droppableContainers.filter((container) =>
      allow(container.data.current?.type),
    ),
  };
}

/** pointerWithin を優先し、検出されない場合は closestCenter にフォールバック */
function withFallback(args: DetectionArgs) {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
}

/**
 * 中央PDF画面（ThumbnailGrid）用の collision detection。
 * - page ドラッグ → page のみ許可（segment/group系を除外、SortablePageCard/EndZoneとの干渉防止）
 * - group-reorder → segment + group-reorder（グループ並び替えで group-add に吸われない）
 * - segment → segment + group-reorder + group-add（セグメント並び替え/グループ追加）
 * - group-child → segment + group-reorder + group-add + group-child（取り出し/移動/枝番並び替え）
 */
export const workspaceCollisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  const scoped =
    activeType === 'page'
      ? filterByType(args, (t) => t === 'page')
      : activeType === 'group-reorder'
        ? filterByType(args, (t) => (
          t === 'segment' || t === 'group-reorder' || t === 'list-end'
        ))
        : activeType === 'segment'
          ? filterByType(args, (t) => (
            t === 'segment' || t === 'group-reorder' || t === 'group-add' || t === 'list-end'
          ))
          : activeType === 'group-child'
            ? filterByType(args, (t) => (
              t === 'segment' || t === 'group-reorder' || t === 'group-add' ||
              t === 'group-child' || t === 'list-end'
            ))
            : args;

  return withFallback(scoped);
};

/**
 * 左サイドバー（SegmentList）用の collision detection。
 * - page drag は存在しないので workspace より単純
 * - group-reorder → segment + group-reorder
 * - segment → segment + group-reorder + group-add
 * - group-child → segment + group-reorder + group-add + group-child（取り出し/移動/枝番並び替え）
 */
export const sidebarCollisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  const scoped =
    activeType === 'group-reorder'
      ? filterByType(args, (t) => (
        t === 'segment' || t === 'group-reorder' || t === 'list-end'
      ))
      : activeType === 'segment'
        ? filterByType(args, (t) => (
          t === 'segment' || t === 'group-reorder' || t === 'group-add' || t === 'list-end'
        ))
        : activeType === 'group-child'
          ? filterByType(args, (t) => (
            t === 'segment' || t === 'group-reorder' || t === 'group-add' ||
            t === 'group-child' || t === 'list-end'
          ))
          : args;

  return withFallback(scoped);
};
