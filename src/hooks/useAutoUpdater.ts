import { useEffect, useState } from 'react';
import type {
  UpdateInfoPayload,
  UpdateProgressPayload,
  UpdateErrorPayload,
} from '@/types/electron';

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; info: UpdateInfoPayload }
  | { kind: 'downloading'; info: UpdateInfoPayload; progress: UpdateProgressPayload }
  | { kind: 'downloaded'; info: UpdateInfoPayload }
  | { kind: 'not-available' }
  | { kind: 'error'; error: UpdateErrorPayload };

export function useAutoUpdater() {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' });
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.update) return;

    api.getVersion?.().then(setCurrentVersion).catch(() => undefined);

    const unsubs = [
      api.update.onChecking(() => setState({ kind: 'checking' })),
      api.update.onAvailable((info) => setState({ kind: 'available', info })),
      api.update.onNotAvailable(() => setState({ kind: 'not-available' })),
      api.update.onProgress((progress) =>
        setState((prev) => {
          const info =
            prev.kind === 'available' || prev.kind === 'downloading'
              ? prev.info
              : ({ version: undefined } as UpdateInfoPayload);
          return { kind: 'downloading', info, progress };
        }),
      ),
      api.update.onDownloaded((info) => setState({ kind: 'downloaded', info })),
      api.update.onError((error) => setState({ kind: 'error', error })),
    ];

    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, []);

  const installNow = async () => {
    await window.electronAPI?.update.install();
  };

  const checkNow = async () => {
    await window.electronAPI?.update.check();
  };

  const dismiss = () => {
    setState({ kind: 'idle' });
  };

  return { state, currentVersion, installNow, checkNow, dismiss };
}
