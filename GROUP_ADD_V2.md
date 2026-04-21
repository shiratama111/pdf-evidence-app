# グループ追加機能 v2 実装プラン（feature/group-add-v2）

## このブランチの目的
- master は **v1.5.3（ロールバック版）** で安定運用中
- このブランチで「セグメントをD&Dでグループに追加」機能を **再挑戦**
- v1.5.0〜v1.5.2 の試みで発見した UX 問題を解消した版として実装する
- 完成・検証できたら master にマージしてリリース

---

## 過去の試み（master に取り込まれなかった経緯）

| Version | 内容 | コミット | 結果 |
|:--:|:--|:--|:--|
| v1.5.0 | GROUP_SEGMENT_ADDED 初実装、セグメント→グループ青リング | `43f5d33` | 入替と追加が区別できず |
| v1.5.1 | pointerWithin + ネスト droppable で2モード判別、ラベル追加 | `a61fdc5` | 挙動はそれっぽいが違和感残る |
| v1.5.2 | 「グループに追加」文言・並び替え青ライン・ページD&D opacity強化 | `797bebb` | **根本的な違和感は解消せず** |
| v1.5.3 | 上記すべてロールバック（v1.4.1 相当） | `e6caf42`（revert commit） | master の現状 |

これらのコミットは git log に残っているので、 `git show <commit>` や `git cherry-pick <commit>` で参照・復元可能。

---

## 残った UX の違和感（先輩のフィードバック 2026/04/21）

### 違和感の正体
> 「元のPDFやセグメントがある場所がグループに追加するときには残ったままになっている。この残ったままにある状態が違和感を生んでいる」

### 現状の挙動（v1.5.2まで）
- セグメントをドラッグ開始 → 元の位置に `opacity: 0.4`（薄く半透明）で残ったまま
- DragOverlay で浮遊プレビューがカーソルに追従
- 両方同時に見えて、「どっちが本物？」「掴んでるのに残ってる」感

### 期待動作
- **ドラッグ開始と同時に、元の場所からセグメント/PDF を完全に消す**
- あたかも「掴んで持ち上げた」ように見える
- 浮遊プレビュー（DragOverlay）だけが見える

---

## 新方針: ドラッグ元を完全に非表示化

### 技術アプローチ
`SortableSegmentItem` / `SortableGroupFolder` / `SortableSegmentBlock` の `isDragging` 時のスタイル:

**変更前（v1.5.2）**:
```tsx
style: { opacity: isDragging ? 0.4 : 1 }
```

**変更後（v2）**:
```tsx
style: {
  // ドラッグ中は完全に非表示（DragOverlay側で浮遊プレビューが見える）
  visibility: isDragging ? 'hidden' : 'visible',
  // もしくは display: 'none'（レイアウトから除外、他のセグメントが詰まる）
}
```

2択：
- **`visibility: hidden`**: DOM は残るが見えない → レイアウトの高さは保持（他が詰まらない）
- **`display: none`**: DOM から除外風 → 他のセグメントが詰まる（入替位置に spacer が必要？）

`@dnd-kit` の SortableContext は、ドラッグ中に他のアイテムが詰まって見えるようレイアウトシフトする（`transform: translate(...)`）。つまり:
- `visibility: hidden` でも、他のアイテムが transform で位置ずらしして詰まる → 見た目 OK
- DragOverlay は元要素の位置に依存しないので問題なし

**推奨**: `visibility: hidden`（または `opacity: 0`）

ただし、**ドロップ先判定**で問題が出ないか要検証:
- `@dnd-kit` の collision detection は要素の rect を使うので、`visibility: hidden` でも DOM 上の位置は残る
- → 自分自身の位置も droppable 候補になって、変な挙動になる可能性

対策: ドラッグ中の active 自体は droppable から除外する（自己ドロップ防止）。デフォルトでこうなっているはず（@dnd-kit は active を over 候補から除く）。

### DragOverlay の視認性向上
- 現状の `opacity-90 rotate-2 ring-2 ring-blue-400 shadow-2xl` は維持
- カーソル追従の浮遊プレビューが唯一の「今ドラッグしている」サイン

---

## 実装ステップ（このブランチで着手するときの手順）

### ① v1.5.0〜v1.5.2 の変更を復元（参考コミット3つ）
**cherry-pick は競合する可能性** あり（revert commit との衝突）。代替案:

**案A**: 手動で v1.5.2 commit (`797bebb`) のファイル内容を参照しつつ、このブランチで新規に実装
- 参考コマンド: `git show 797bebb -- src/components/sidebar/GroupFolder.tsx`
- 過去の diff を見ながら今回の UX 改善も含めて一気に書く

**案B**: v1.5.2 commit を cherry-pick して、その後 UX 改善 commit を追加
- `git cherry-pick 43f5d33 a61fdc5 797bebb`
- 競合したら revert した部分をそのまま受け入れる

**推奨**: 案A（過去の実装をコピペ参考にしつつ、今回の改善を含めて新規に実装する方がクリーン）

### ② UX 改善実装
1. `SortableSegmentItem` / `SortableGroupFolder` / `SortableSegmentBlock` の isDragging スタイル変更
   - `opacity: 0.4` → `visibility: isDragging ? 'hidden' : 'visible'`
2. ページD&D の `SortablePageCard` は現状維持（v1.4.1 / v1.5.3 の挙動で OK）
3. グループ追加のロジック（GROUP_SEGMENT_ADDED、addSegmentToGroup）は v1.5.0 から復元
4. 2モード判別（ネスト droppable + pointerWithin）は v1.5.1 から復元し、inset 領域配置・ラベル「グループに追加」
5. 並び替え青ライン（v1.5.2）も復元

### ③ 検証
- 新規インストール → D&D 動作確認
- ドラッグ元が完全に消えているか、違和感がないか
- 中央ビューのページD&D が壊れていないか

### ④ master へのマージ
- PR 作成（`gh pr create`）
- 先輩確認後マージ
- v1.6.0 として MINOR bump でリリース

---

## 既存の backend（ロールバック後も残せる可能性）

v1.5.3 ロールバックで以下も消したが、backend は再利用可能な形で保存すべきかも:
- `actions.ts` の `GROUP_SEGMENT_ADDED` アクション
- `segments-helpers.ts` の `addSegmentToGroup` 関数
- `segments-reducer.ts` の case

これらは v1.5.0 コミット (`43f5d33`) から拾える。

---

## このブランチの運用

- master は常に安定版
- このブランチは**自由に実験・コミット・リセット**できる
- 必要なら何度でも push して `gh pr create` で diff 確認
- 完成したら master に squash merge or rebase merge（先輩の好みで）

## 参考 git コマンド

```bash
# 現在のブランチ確認
git branch --show-current

# v1.5.2 の該当ファイルを確認
git show 797bebb -- src/components/sidebar/GroupFolder.tsx

# v1.5.2 のコミットまるごと cherry-pick
git cherry-pick 43f5d33 a61fdc5 797bebb

# 参考用に一時的に v1.5.2 のソースツリーをワーキングに展開
git checkout 797bebb -- src/components/sidebar/GroupFolder.tsx  # 例

# リリース前にブランチを master にマージ
git checkout master
git merge feature/group-add-v2
```
