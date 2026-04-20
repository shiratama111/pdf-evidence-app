/**
 * useAppVersion
 *
 * Electron メインプロセスから現在のアプリバージョンを取得するフック。
 * - Electron 環境: `window.electronAPI.getVersion()` の結果
 * - ブラウザ dev 環境: 空文字
 */
import { useEffect, useState } from 'react';

export function useAppVersion(): string {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getVersion) return;
    api.getVersion().then(setVersion).catch(() => undefined);
  }, []);

  return version;
}
