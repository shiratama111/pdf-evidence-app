; -----------------------------------------------------------------------------
; build/installer.nsh
;
; electron-builder の NSIS インストーラを customInstall / customUnInstall で拡張。
;
; 目的:
;   - 新規インストール時のみ「デスクトップにショートカットを作成しますか？」ダイアログを表示
;     - はい: $DESKTOP にショートカットを作成
;     - いいえ: 作成しない（後で手動で作れる）
;   - 以下のケースではダイアログを完全にスキップ:
;     1. サイレントモード（自動アップデート経由など）
;        → main.cjs の `autoUpdater.quitAndInstall(true, true)` でサイレント起動
;     2. 既にデスクトップショートカットが存在する
;        → 前回のインストールで「はい」を選んだユーザーがアップデート時に
;          再度ダイアログで問われるのを防ぐ
;   - アンインストール時はデスクトップショートカットを削除
; -----------------------------------------------------------------------------

!macro customInstall
  ; (1) サイレントモード時は即スキップ
  IfSilent skipDesktopShortcut
  ; (2) 既に同名ショートカットがあれば、再度の確認はせずスキップ
  IfFileExists "$DESKTOP\${PRODUCT_NAME}.lnk" skipDesktopShortcut 0

  MessageBox MB_YESNO|MB_ICONQUESTION \
    "デスクトップにショートカットを作成しますか？" \
    IDNO skipDesktopShortcut
    CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  skipDesktopShortcut:
!macroend

!macro customUnInstall
  ; アンインストール時は問答無用でデスクトップショートカットも削除
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
!macroend
