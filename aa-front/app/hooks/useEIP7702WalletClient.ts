import { useMemo } from 'react';
import { useWalletClient } from 'wagmi';
import { eip7702Actions } from 'viem/experimental';

export function useEIP7702WalletClient() {
  const { data: wagmiWalletClient, isLoading } = useWalletClient();
  
  const eip7702Client = useMemo(() => {
    if (!wagmiWalletClient) return null;
    return wagmiWalletClient.extend(eip7702Actions());
  }, [wagmiWalletClient]);
  
  return {
    eip7702Client,
    isLoading
  };
}