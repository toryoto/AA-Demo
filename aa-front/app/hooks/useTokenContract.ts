import { useState, useCallback } from 'react';
import { PublicClient } from 'viem';
import { tokenCreationFactoryAbi } from '../abi/tokenCreationFactory';
import { TOKEN_CREATION_FACTORY_ADDRESS } from '../constants/addresses';
import { erc20Abi } from '../abi/erc20';

export interface TokenInfo {
  tokenAddress: string;
  name: string;
  symbol: string;
  initialSupply: bigint;
  timestamp: bigint;
}

export interface TokenBalance {
  address: string;
  balance: bigint;
}

export const useTokenContract = (
  publicClient: PublicClient,
  aaAddress: string
) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // トークン残高を取得する関数
  const getTokenBalance = useCallback(async (tokenAddress: string): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [aaAddress]
      });
      return balance as bigint;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return BigInt(0);
    }
  }, [publicClient, aaAddress]);

  // ユーザーのトークン一覧を取得する関数
  const getUserTokens = useCallback(async (): Promise<void> => {
    if (!aaAddress || isLoading) return;
    
    try {
      setIsLoading(true);
      console.log('Fetching tokens for address:', aaAddress);
      
      const userTokens = await publicClient.readContract({
        address: TOKEN_CREATION_FACTORY_ADDRESS as `0x${string}`,
        abi: tokenCreationFactoryAbi,
        functionName: 'getUserTokens',
        args: [aaAddress]
      }) as TokenInfo[];

      console.log('Tokens fetched:', userTokens.length);

      setTokens(userTokens);

      // 各トークンの残高を取得
      const balancePromises = userTokens.map(async (token: TokenInfo) => {
        const balance = await getTokenBalance(token.tokenAddress);
        return { address: token.tokenAddress, balance };
      });
      const tokenBalances = await Promise.all(balancePromises);
      setBalances(tokenBalances);
    } catch (error) {
      console.error('Error fetching user tokens:', error);
      setTokens([]);
      setBalances([]);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, aaAddress, getTokenBalance, isLoading]);

  return {
    tokens,
    balances,
    isLoading,
    getUserTokens,
  };
};