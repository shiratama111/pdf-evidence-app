import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState } from '@/types/pdf';
import type { AppAction } from './actions';
import { appReducer, initialState } from './appReducer';

const StateContext = createContext<AppState>(initialState);
const DispatchContext = createContext<React.Dispatch<AppAction>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
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
