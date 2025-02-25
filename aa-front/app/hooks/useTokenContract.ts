import { useState } from 'react'
import { encodeFunctionData, Hex, parseEther, PublicClient } from 'viem'
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

  const getTokenBalance = async (tokenAddress: string): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [aaAddress]
      })
      console.log(tokenAddress)
      return balance as bigint;
    } catch (error) {
      console.error('Error fetching token balance:', error)
      return BigInt(0)
    }
  }

  const getImportedTokens = () => {
    const stored = localStorage.getItem(`importedTokens_${aaAddress}`)
    if (!stored) return []
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }

  const getUserTokens = async (): Promise<void> => {
    if (!aaAddress || isLoading) return

    try {
      setIsLoading(true)

      // 作成したトークンを取得
      const userTokens = await publicClient.readContract({
        address: TOKEN_CREATION_FACTORY_ADDRESS,
        abi: tokenCreationFactoryAbi,
        functionName: 'getUserTokens',
        args: [aaAddress]
      }) as TokenInfo[]

      const importedTokens = getImportedTokens()

      // すべてのトークンアドレスを集約
      const allTokenAddresses = new Set([
        ...userTokens.map((t: TokenInfo) => t.tokenAddress.toLowerCase()),
        ...importedTokens.map((t: { address: string }) => t.address.toLowerCase())
      ])

      // 全トークンの残高を取得
      const balancePromises = Array.from(allTokenAddresses).map(async (address) => {
        const balance = await getTokenBalance(address)
        return { address, balance }
      });

      const tokenBalances = await Promise.all(balancePromises)
      
      setTokens(userTokens)
      setBalances(tokenBalances)
    } catch (error) {
      console.error('Error fetching user tokens:', error)
      setTokens([])
      setBalances([])
    } finally {
      setIsLoading(false)
    }
  };

  const sendToken = async (tokenAddress: string, toAddress: string, amount: string): Promise<boolean> => {
    try {
      // const func1 = encodeFunctionData({
      //   abi: erc20Abi,
      //   functionName: 'approve',
      //   args: [toAddress, amount]
      // })
      const func = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress, parseEther(amount)]
      })
      // const destinations = [tokenAddress, tokenAddress]
      // const values = ['0x0', '0x0']

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
    getTokenBalance,
    getUserTokens,
    sendToken
  };
};