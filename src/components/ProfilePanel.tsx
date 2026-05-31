import { type ChangeEvent } from 'react';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { CHAIN_LIST, type ChainKey } from '../walletconnect/chains';
import {
  buildNamespaceProposal,
  type NamespaceProfileId,
} from '../walletconnect/namespaces';
import { Panel } from './Panel';

const PROFILE_OPTIONS: { value: NamespaceProfileId; label: string }[] = [
  { value: 'mainnet-only-required', label: 'Mainnet only required' },
  {
    value: 'strict-three-chains-required',
    label: 'Strict three chains required',
  },
  {
    value: 'mainnet-required-testnets-optional',
    label: 'Mainnet required, testnets optional',
  },
  { value: 'single-target-required', label: 'Single target required' },
];

export function ProfilePanel() {
  const { profileId, targetChainKey, setProfileId, setTargetChainKey } =
    useDiagnosticsStore();
  const proposalJson = JSON.stringify(
    buildNamespaceProposal(profileId, targetChainKey),
    null,
    2,
  );

  const handleProfileChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setProfileId(event.target.value as NamespaceProfileId);
  };

  const handleTargetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setTargetChainKey(event.target.value as ChainKey);
  };

  return (
    <Panel
      title="Namespace profile"
      summary="Choose the WalletConnect namespace permissions to propose."
      defaultOpen
    >
      <label>
        Profile
        <select value={profileId} onChange={handleProfileChange}>
          {PROFILE_OPTIONS.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Target chain
        <select value={targetChainKey} onChange={handleTargetChange}>
          {CHAIN_LIST.map((chain) => (
            <option key={chain.key} value={chain.key}>
              {chain.chainName}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(proposalJson)}
      >
        Copy proposal JSON
      </button>
      <pre style={{ overflowX: 'auto' }}>{proposalJson}</pre>
    </Panel>
  );
}
