import type { PairingTypes, SessionTypes } from '@walletconnect/types';
import { create } from 'zustand';

import {
  createDiagnosticEvent,
  type DiagnosticEvent,
  type DiagnosticEventInput,
} from '../diagnostics/eventLog';
import type { ChainKey } from '../walletconnect/chains';
import type {
  NamespaceProfileId,
  NamespaceProposal,
} from '../walletconnect/namespaces';
import {
  parseSession,
  type ParsedSessionState,
} from '../walletconnect/session';

export type ConnectionStatus =
  | 'idle'
  | 'sign_client_initializing'
  | 'pairing_uri_ready'
  | 'approval_pending'
  | 'connected'
  | 'disconnecting'
  | 'expired'
  | 'disconnected'
  | 'error';

export interface DiagnosticsState {
  status: ConnectionStatus;
  profileId: NamespaceProfileId;
  targetChainKey: ChainKey;
  uri?: string;
  activeProposal?: NamespaceProposal;
  activeSession?: SessionTypes.Struct;
  parsedSession?: ParsedSessionState;
  sessions: SessionTypes.Struct[];
  pairings: PairingTypes.Struct[];
  events: DiagnosticEvent[];
  restoredFromStorage: boolean;
  lastError?: string;
  pendingRequestIds: string[];
  setStatus: (status: ConnectionStatus) => void;
  setProfileId: (profileId: NamespaceProfileId) => void;
  setTargetChainKey: (targetChainKey: ChainKey) => void;
  setUri: (uri?: string) => void;
  setActiveProposal: (activeProposal?: NamespaceProposal) => void;
  setActiveSession: (activeSession?: SessionTypes.Struct) => void;
  setRestoredState: (
    sessions: SessionTypes.Struct[],
    pairings: PairingTypes.Struct[],
  ) => void;
  setLastError: (lastError?: string) => void;
  addPendingRequest: (requestId: string) => void;
  removePendingRequest: (requestId: string) => void;
  appendEvent: (event: DiagnosticEventInput) => void;
  clearEvents: () => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as const,
  profileId: 'mainnet-required-testnets-optional' as const,
  targetChainKey: 'mainnet' as const,
  uri: undefined,
  activeProposal: undefined,
  activeSession: undefined,
  parsedSession: undefined,
  sessions: [],
  pairings: [],
  events: [],
  restoredFromStorage: false,
  lastError: undefined,
  pendingRequestIds: [],
};

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setProfileId: (profileId) => set({ profileId }),
  setTargetChainKey: (targetChainKey) => set({ targetChainKey }),
  setUri: (uri) => set({ uri }),
  setActiveProposal: (activeProposal) => set({ activeProposal }),
  setActiveSession: (activeSession) =>
    set({
      activeSession,
      parsedSession: activeSession ? parseSession(activeSession) : undefined,
    }),
  setRestoredState: (sessions, pairings) =>
    set({ sessions, pairings, restoredFromStorage: true }),
  setLastError: (lastError) => set({ lastError }),
  addPendingRequest: (requestId) =>
    set((state) => ({
      pendingRequestIds: [...state.pendingRequestIds, requestId],
    })),
  removePendingRequest: (requestId) =>
    set((state) => ({
      pendingRequestIds: state.pendingRequestIds.filter(
        (pendingRequestId) => pendingRequestId !== requestId,
      ),
    })),
  appendEvent: (event) =>
    set((state) => ({
      events: [...state.events, createDiagnosticEvent(event)],
    })),
  clearEvents: () => set({ events: [] }),
  reset: () => set(initialState),
}));
