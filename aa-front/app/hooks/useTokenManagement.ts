import { useState, useEffect } from 'react';
import { PublicClient, formatEther, Hex, isAddress, encodeFunctionData, parseEther } from 'viem';
import { erc20Abi } from '../abi/erc20';
import { SimpleAccountABI } from '../abi/simpleAccount';
import { toast } from 'sonner';
import useUserOperation from './useUserOperation';
import { usePaymasterData } from './usePaymasterData';
import { useExecuteUserOperation } from './useExecuteUserOperation';
import { bundlerClient } from '../utils/client';

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  balance: string;
}

const STORAGE_KEY = 'imported_tokens';

export const useTokenManagement = (publicClient: PublicClient, aaAddress: Hex) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { createUserOperation } = useUserOperation();
  const { getPaymasterAndData } = usePaymasterData();
  const { execute } = useExecuteUserOperation();

  useEffect(() => {
    if (aaAddress && aaAddress !== '0x') {
      loadTokens();
    }
  }, [aaAddress]);

  useEffect(() => {
    if (tokens.length > 0 && aaAddress && aaAddress !== '0x') {
      updateTokenBalances();
    }
  }, [tokens.length, aaAddress]);

  const loadTokens = () => {
    if (!aaAddress) return;
    
    const storedTokens = localStorage.getItem(`${STORAGE_KEY}_${aaAddress}`);
    if (storedTokens) {
      try {
        setTokens(JSON.parse(storedTokens));
      } catch (error) {
        console.error('Error parsing stored tokens:', error);
        setTokens([]);
      }
    }
  };

  const updateTokenBalances = async () => {
    if (!aaAddress || tokens.length === 0) return;
    
    setIsLoading(true);
    
    try {
      const updatedTokens = await Promise.all(
        tokens.map(async (token) => {
          try {
            const balance = await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [aaAddress]
            });
            
            return {
              ...token,
              balance: formatEther(balance as bigint)
            };
          } catch (error) {
            console.error(`Error fetching balance for token ${token.address}:`, error);
            return {
              ...token,
              balance: '0'
            };
          }
        })
      );
      
      setTokens(updatedTokens);
      localStorage.setItem(`${STORAGE_KEY}_${aaAddress}`, JSON.stringify(updatedTokens));
    } catch (error) {
      console.error('Error updating token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const importToken = async (tokenAddress: string): Promise<boolean> => {
    if (!tokenAddress || !aaAddress) return false;
    
    if (!isAddress(tokenAddress)) {
      setImportError('Invalid address format');
      return false;
    }

    setImporting(true);
    setImportError('');

    try {
      if (tokens.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase())) {
        setImportError('Token already imported');
        return false;
      }

      const [name, symbol, balance] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name'
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol'
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [aaAddress]
        })
      ]);

      const newToken = {
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        balance: formatEther(balance as bigint)
      };

      const updatedTokens = [...tokens, newToken];
      setTokens(updatedTokens);
      localStorage.setItem(`${STORAGE_KEY}_${aaAddress}`, JSON.stringify(updatedTokens));
      
      toast.success(`Imported ${name} (${symbol}) successfully`);
      return true;
    } catch (error) {
      console.error('Error importing token:', error);
      setImportError('Invalid token address or not an ERC-20 token');
      return false;
    } finally {
      setImporting(false);
    }
  };

  const removeToken = (address: string): void => {
    const updatedTokens = tokens.filter(token => token.address.toLowerCase() !== address.toLowerCase());
    setTokens(updatedTokens);
    localStorage.setItem(`${STORAGE_KEY}_${aaAddress}`, JSON.stringify(updatedTokens));
    toast.success('Token removed');
  };

  const sendToken = async (tokenAddress: string, toAddress: string, amount: string): Promise<void> => {
    if (!aaAddress || !tokenAddress || !toAddress || !amount) {
      throw new Error('Missing required parameters for token transfer');
    }

    setIsSending(true);

    try {
      const transferCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress, parseEther(amount)]
      });

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [tokenAddress, '0x0', transferCalldata]
      });

      const userOp = await createUserOperation({ aaAddress, callData });
      
      const paymasterAndData = await getPaymasterAndData(userOp);
      userOp.paymasterAndData = paymasterAndData;

      const userOpHash = await execute(userOp);
      
      await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
      
      await updateTokenBalances();
    } catch (error) {
      console.error('Token transfer failed:', error);
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  return {
    tokens,
    isLoading,
    importing,
    isSending,
    importError,
    setImportError,
    importToken,
    removeToken,
    updateTokenBalances,
    sendToken
  };
};