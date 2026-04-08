import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { AppState } from '@/types/pdf';
import type { AppAction } from './actions';
import { appReducer, initialState } from './appReducer';

// Undo/Redo 対象外のアクション（UI状態やプログレスなど）
const NON_UNDOABLE_ACTIONS = new Set([
  'PAGE_THUMBNAIL_READY',
  'LOADING_STARTED',
  'LOADING_FINISHED',
  'EXPORT_STARTED',
  'EXPORT_PROGRESS',
  'EXPORT_FINISHED',
  'AI_PROCESSING_STARTED',
  'AI_PROCESSING_FINISHED',
  'PAGE_SELECTED',
  'SELECTION_CLEARED',
  'PREVIEW_SET',
  'PREVIEW_TOGGLED',
  'SEGMENT_SELECTED',
  'SEGMENT_SELECTION_CLEARED',
]);

const MAX_HISTORY = 50;

interface UndoableState {
  current: AppState;
  past: AppState[];
  future: AppState[];
}

type UndoableAction =
  | AppAction
  | { type: 'UNDO' }
  | { type: 'REDO' };

function undoableReducer(state: UndoableState, action: UndoableAction): UndoableState {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const prev = state.past[state.past.length - 1];
    return {
      current: prev,
      past: state.past.slice(0, -1),
      future: [state.current, ...state.future],
    };
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      current: next,
      past: [...state.past, state.current],
      future: state.future.slice(1),
    };
  }

  // 通常のアクション
  const newCurrent = appReducer(state.current, action);
  if (newCurrent === state.current) return state;

  // Undo対象外のアクションは履歴に追加しない
  if (NON_UNDOABLE_ACTIONS.has(action.type)) {
    return { ...state, current: newCurrent };
  }

  // 履歴に保存する際、一時的なUI状態をクリアして保存
  const sanitized: AppState = {
    ...state.current,
    isLoading: false,
    loadingMessage: '',
    isExporting: false,
    exportProgress: 0,
    isAiProcessing: false,
  };

  return {
    current: newCurrent,
    past: [...state.past.slice(-MAX_HISTORY + 1), sanitized],
    future: [],
  };
}

// ── Contexts ──

const StateContext = createContext<AppState>(initialState);
const DispatchContext = createContext<React.Dispatch<AppAction>>(() => {});
const UndoRedoContext = createContext<{ canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void }>({
  canUndo: false, canRedo: false, undo: () => {}, redo: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(undoableReducer, {
    current: initialState,
    past: [],
    future: [],
  });

  // AppActionのdispatchラッパー（型を合わせるため）
  const appDispatch = useCallback((action: AppAction) => {
    dispatch(action);
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const undoRedoValue = {
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo,
    redo,
  };

  // Ctrl+Z / Ctrl+Y グローバルショートカット
  const undoRedoRef = useRef(undoRedoValue);
  undoRedoRef.current = undoRedoValue;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // input/textareaでは無視
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoRedoRef.current.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        undoRedoRef.current.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <StateContext.Provider value={state.current}>
      <DispatchContext.Provider value={appDispatch}>
        <UndoRedoContext.Provider value={undoRedoValue}>
          {children}
        </UndoRedoContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  return useContext(StateContext);
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  return useContext(DispatchContext);
}

export function useUndoRedo() {
  return useContext(UndoRedoContext);
}
