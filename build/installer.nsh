; -----------------------------------------------------------------------------
; build/installer.nsh
;
; electron-builder の NSIS インストーラを customInstall / customUnInstall で拡張。
;
; 目的:
;   - インストール時に「デスクトップにショートカットを作成しますか？」ダイアログを表示
;     - はい: $DESKTOP にショートカットを作成
;     - いいえ: 作成しない（後で手動で作れる）
;   - サイレントインストール時（自動アップデート経由など）はダイアログを出さず、
;     /SD IDNO 指定により「作らない」を既定動作にする。
;     → 既に v1.3.1 以前で作成済みのショートカットはそのまま残る（上書きしない）
;   - アンインストール時はデスクトップショートカットを削除
; -----------------------------------------------------------------------------

!macro customInstall
  ; /SD IDNO:
  ;   サイレントモードで実行された時（自動アップデート適用時）は IDNO 相当とみなし、
  ;   skipDesktopShortcut へ直接ジャンプしてダイアログをスキップ。
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "デスクトップにショートカットを作成しますか？" \
    /SD IDNO IDNO skipDesktopShortcut
    CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  skipDesktopShortcut:
!macroend

!macro customUnInstall
  ; アンインストール時は問答無用でデスクトップショートカットも削除
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
!macroend
