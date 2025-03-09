import { useState, useEffect } from 'react';
import { useAA } from "./useAA";
import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";
import { eip7702Actions } from "viem/experimental";

export const useEip7702Provider = () => {
  const { addressMode } = useAA();
  const [walletClient, setWalletClient] = useState<any>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMaskが見つかりません。インストールしてください。');
        }

        if (addressMode !== 'eoa') {
          console.log('addressModeがeoaではないため、eip7702Providerは実行されません。');
          return;
        }

        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error('アカウントへのアクセスが許可されませんでした。');
        }

        const walletClient = createWalletClient({
          chain: sepolia,
          transport: custom(window.ethereum)
        }).extend(eip7702Actions());
        
        console.log(`接続成功: ${accounts[0]}`);
        setWalletClient(walletClient);
      } catch (error) {
        console.error('MetaMask接続エラー:', error);
      }
    };

    initialize();
  }, [addressMode]);

  return walletClient;
};