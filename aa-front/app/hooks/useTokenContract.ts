import { useState, useCallback } from 'react'
import { encodeFunctionData, Hex, PublicClient } from 'viem'
import { tokenCreationFactoryAbi } from '../abi/tokenCreationFactory'
import { TOKEN_CREATION_FACTORY_ADDRESS } from '../constants/addresses'
import { erc20Abi } from '../abi/erc20'
import { SimpleAccountABI } from '../abi/simpleAccount'
import useUserOperation from './useUserOperation'
import { usePaymasterData } from './usePaymasterData'
import { useExecuteUserOperation } from './useExecuteUserOperation'
import { bundlerClient } from '../utils/client'

export interface TokenInfo {
  tokenAddress: string
  name: string
  symbol: string
  initialSupply: bigint
  timestamp: bigint
}

export interface TokenBalance {
  address: string
  balance: bigint
}

export const useTokenContract = (
  publicClient: PublicClient,
  aaAddress: Hex
) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const { createUserOperation } = useUserOperation()
  const { getPaymasterAndData } = usePaymasterData()
  const { execute } = useExecuteUserOperation()

  // トークン残高を取得する関数
  const getTokenBalance = useCallback(async (tokenAddress: string): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [aaAddress]
      })
      return balance as bigint;
    } catch (error) {
      console.error('Error fetching token balance:', error)
      return BigInt(0)
    }
  }, [publicClient, aaAddress])

  // ユーザーのトークン一覧を取得する関数
  const getUserTokens = useCallback(async (): Promise<void> => {
    if (!aaAddress || isLoading) return;
    
    try {
      setIsLoading(true);
      
      const userTokens = await publicClient.readContract({
        address: TOKEN_CREATION_FACTORY_ADDRESS as `0x${string}`,
        abi: tokenCreationFactoryAbi,
        functionName: 'getUserTokens',
        args: [aaAddress]
      }) as TokenInfo[]

      setTokens(userTokens)

      // 各トークンの残高を取得
      const balancePromises = userTokens.map(async (token: TokenInfo) => {
        const balance = await getTokenBalance(token.tokenAddress)
        return { address: token.tokenAddress, balance }
      })
      const tokenBalances = await Promise.all(balancePromises)
      setBalances(tokenBalances)
    } catch (error) {
      console.error('Error fetching user tokens:', error)
      setTokens([])
      setBalances([])
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, aaAddress, getTokenBalance, isLoading])

  const sendToken = async (tokenAddress: string, toAddress: string, amount: bigint): Promise<boolean> => {
    try {
      const func = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress, amount]
      })

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [tokenAddress, '0x0', func]
      })

      const userOp = await createUserOperation({ aaAddress, callData })
      const paymasterAndData = await getPaymasterAndData(userOp);
      userOp.paymasterAndData = paymasterAndData

      const userOpHash = await execute(userOp)
      await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })

      return true
    } catch (error) {
      console.error('Error sending token:', error)
      return false
    }
  }

  return {
    tokens,
    balances,
    isLoading,
    getUserTokens,
    sendToken
  };
};