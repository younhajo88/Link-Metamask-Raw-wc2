import { useState, type ChangeEvent } from 'react';
import { isAddress } from 'viem';

import { useDiagnosticsStore } from '../state/useDiagnosticsStore';
import { CHAIN_LIST, getChain, type ChainKey } from '../walletconnect/chains';
import {
  requestAddChain,
  requestCapabilities,
  requestErc20Transfer,
  requestGetPermissions,
  requestNativeTransfer,
  requestPermissions,
  requestPersonalSign,
  requestSwitchChain,
  requestTypedDataSign,
  type RequestMode,
} from '../walletconnect/requests';
import { Panel } from './Panel';

type RequestType =
  | 'personal_sign'
  | 'eth_signTypedData_v4'
  | 'eth_sendTransaction'
  | 'erc20_transfer'
  | 'wallet_switchEthereumChain'
  | 'wallet_addEthereumChain'
  | 'wallet_getPermissions'
  | 'wallet_requestPermissions'
  | 'wallet_getCapabilities';

interface Confirmation {
  chainKey: ChainKey;
  asset: string;
  recipient: string;
  amount: string;
  send: () => Promise<unknown>;
}

const REQUEST_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'personal_sign', label: 'personal_sign' },
  { value: 'eth_signTypedData_v4', label: 'eth_signTypedData_v4' },
  { value: 'eth_sendTransaction', label: 'eth_sendTransaction' },
  { value: 'erc20_transfer', label: 'ERC-20 transfer' },
  {
    value: 'wallet_switchEthereumChain',
    label: 'wallet_switchEthereumChain',
  },
  { value: 'wallet_addEthereumChain', label: 'wallet_addEthereumChain' },
  { value: 'wallet_getPermissions', label: 'wallet_getPermissions' },
  { value: 'wallet_requestPermissions', label: 'wallet_requestPermissions' },
  { value: 'wallet_getCapabilities', label: 'wallet_getCapabilities' },
];

const AMOUNT_PATTERN = /^\d+(?:\.\d+)?$/;

export function RequestLab() {
  const targetChainKey = useDiagnosticsStore((state) => state.targetChainKey);
  const setLastError = useDiagnosticsStore((state) => state.setLastError);
  const hasPendingRequests = useDiagnosticsStore(
    (state) => state.pendingRequestIds.length > 0,
  );
  const [requestType, setRequestType] = useState<RequestType>('personal_sign');
  const [chainKey, setChainKey] = useState<ChainKey>(targetChainKey);
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [decimals, setDecimals] = useState('18');
  const [unsafe, setUnsafe] = useState(false);
  const [unsafeReason, setUnsafeReason] = useState('');
  const [validationError, setValidationError] = useState<string>();
  const [confirmation, setConfirmation] = useState<Confirmation>();

  const chain = getChain(chainKey);
  const mode: RequestMode = unsafe ? 'unsafe' : 'safe';
  const baseInput = {
    chain,
    mode,
    unsafeReason: unsafe ? unsafeReason : undefined,
  };

  const reportError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setLastError(message);
    setValidationError(message);
  };

  const run = (request: () => Promise<unknown>) => {
    setValidationError(undefined);
    void Promise.resolve().then(request).catch(reportError);
  };

  const resetUnsafeConsent = () => {
    setUnsafe(false);
    setUnsafeReason('');
  };

  const validateUnsafeReason = () => {
    if (unsafe && !unsafeReason.trim()) {
      setValidationError('Unsafe requests require a non-empty reason.');
      return false;
    }

    return true;
  };

  const validateAddress = (value: string, label: string) => {
    if (!isAddress(value)) {
      setValidationError(`${label} must be a valid address.`);
      return false;
    }

    return true;
  };

  const validateAmount = () => {
    if (!AMOUNT_PATTERN.test(amount)) {
      setValidationError('Amount must be a non-negative decimal number.');
      return false;
    }

    return true;
  };

  const prepareRequest = () => {
    setValidationError(undefined);
    setConfirmation(undefined);

    if (!validateUnsafeReason()) {
      return;
    }

    switch (requestType) {
      case 'personal_sign':
        if (!message.trim()) {
          setValidationError('Message is required.');
          return;
        }
        resetUnsafeConsent();
        run(() => requestPersonalSign({ ...baseInput, message }));
        return;
      case 'eth_signTypedData_v4':
        resetUnsafeConsent();
        run(() => requestTypedDataSign(baseInput));
        return;
      case 'eth_sendTransaction':
        if (!recipient.trim() || amount === '') {
          setValidationError('Recipient and amount are required.');
          return;
        }
        if (
          !validateAddress(recipient, 'Recipient') ||
          !validateAmount()
        ) {
          return;
        }
        resetUnsafeConsent();
        setConfirmation({
          chainKey,
          asset: chain.nativeCurrency.symbol,
          recipient,
          amount,
          send: () =>
            requestNativeTransfer({ ...baseInput, to: recipient, amount }),
        });
        return;
      case 'erc20_transfer': {
        if (!token.trim() || !recipient.trim() || amount === '') {
          setValidationError('Token, recipient, and amount are required.');
          return;
        }
        if (
          !validateAddress(token, 'Token contract') ||
          !validateAddress(recipient, 'Recipient') ||
          !validateAmount()
        ) {
          return;
        }
        const parsedDecimals = Number(decimals);
        if (
          !Number.isInteger(parsedDecimals) ||
          parsedDecimals < 0 ||
          parsedDecimals > 255
        ) {
          setValidationError('Decimals must be an integer between 0 and 255.');
          return;
        }
        resetUnsafeConsent();
        setConfirmation({
          chainKey,
          asset: `ERC-20 token ${token}`,
          recipient,
          amount,
          send: () =>
            requestErc20Transfer({
              ...baseInput,
              token,
              recipient,
              amount,
              decimals: parsedDecimals,
            }),
        });
        return;
      }
      case 'wallet_switchEthereumChain':
        resetUnsafeConsent();
        run(() => requestSwitchChain(baseInput));
        return;
      case 'wallet_addEthereumChain':
        resetUnsafeConsent();
        run(() => requestAddChain(baseInput));
        return;
      case 'wallet_getPermissions':
        resetUnsafeConsent();
        run(() => requestGetPermissions(baseInput));
        return;
      case 'wallet_requestPermissions':
        resetUnsafeConsent();
        run(() => requestPermissions(baseInput));
        return;
      case 'wallet_getCapabilities':
        resetUnsafeConsent();
        run(() => requestCapabilities(baseInput));
    }
  };

  const handleRequestTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setRequestType(event.target.value as RequestType);
    setValidationError(undefined);
    setConfirmation(undefined);
    resetUnsafeConsent();
  };

  const handleChainChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setChainKey(event.target.value as ChainKey);
    setConfirmation(undefined);
    resetUnsafeConsent();
  };

  return (
    <Panel title="Request lab" defaultOpen>
      <label>
        Request
        <select value={requestType} onChange={handleRequestTypeChange}>
          {REQUEST_OPTIONS.map((request) => (
            <option key={request.value} value={request.value}>
              {request.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Chain
        <select value={chainKey} onChange={handleChainChange}>
          {CHAIN_LIST.map((option) => (
            <option key={option.key} value={option.key}>
              {option.chainName}
            </option>
          ))}
        </select>
      </label>

      {requestType === 'personal_sign' ? (
        <label>
          Message
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
      ) : null}

      {requestType === 'eth_sendTransaction' || requestType === 'erc20_transfer' ? (
        <>
          {requestType === 'erc20_transfer' ? (
            <label>
              Token contract
              <input value={token} onChange={(event) => setToken(event.target.value)} />
            </label>
          ) : null}
          <label>
            Recipient
            <input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
          </label>
          <label>
            Amount ({requestType === 'erc20_transfer' ? 'tokens' : chain.nativeCurrency.symbol})
            <input value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          {requestType === 'erc20_transfer' ? (
            <label>
              Decimals
              <input
                inputMode="numeric"
                value={decimals}
                onChange={(event) => setDecimals(event.target.value)}
              />
            </label>
          ) : null}
        </>
      ) : null}

      <label>
        <input
          type="checkbox"
          checked={unsafe}
          onChange={(event) => {
            setUnsafe(event.target.checked);
            setConfirmation(undefined);
          }}
        />
        Unsafe request
      </label>
      {unsafe ? (
        <>
          <p role="alert">
            Unsafe requests may trigger accountsChanged([]), silent fail
            behavior, or expose wallet-specific behavior.
          </p>
          <label>
            Unsafe reason
            <input
              value={unsafeReason}
              onChange={(event) => setUnsafeReason(event.target.value)}
            />
          </label>
        </>
      ) : null}

      {validationError ? <p role="alert">{validationError}</p> : null}
      <button type="button" disabled={hasPendingRequests} onClick={prepareRequest}>
        Prepare request
      </button>

      {confirmation ? (
        <section aria-labelledby="request-confirmation-title">
          <h3 id="request-confirmation-title">Confirm request</h3>
          <p>Chain: {getChain(confirmation.chainKey).chainName}</p>
          <p>Asset: {confirmation.asset}</p>
          <p>Recipient: {confirmation.recipient}</p>
          <p>Amount: {confirmation.amount}</p>
          {confirmation.chainKey === 'mainnet' ? (
            <p role="alert">
              Mainnet warning: this request can transfer real funds.
            </p>
          ) : null}
          <button
            type="button"
            disabled={hasPendingRequests}
            onClick={() => {
              const request = confirmation.send;
              setConfirmation(undefined);
              run(request);
            }}
          >
            Confirm and send
          </button>
          <button type="button" onClick={() => setConfirmation(undefined)}>
            Cancel
          </button>
        </section>
      ) : null}
    </Panel>
  );
}
