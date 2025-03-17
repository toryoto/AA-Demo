import { useState, useCallback, useEffect } from 'react'
import { UserOperation } from '../lib/userOperationType'
import { Address, Hex, getContract } from 'viem'
import { multiTokenPaymasterAbi } from '../abi/multiTokenPaymaster' 
import { publicClient } from '../utils/client'
import { MULTI_TOKEN_PAYMASTER_ADDRESS } from '../constants/addresses'
import { erc20Abi } from '../abi/erc20'

export type SupportedToken = {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export const useMultiTokenPaymasterData = (aaAddress: Hex) => {  
  const [selectedToken, setSelectedToken] = useState<SupportedToken | null>(null)
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchSupportedTokens = useCallback(async () => {
    setLoading(true)
    try {
      const paymaster = getContract({
        address: MULTI_TOKEN_PAYMASTER_ADDRESS,
        abi: multiTokenPaymasterAbi,
        client: publicClient,
      })
      console.log(paymaster)

      // Paymasterからサポートされているトークンのアドレスを取得
      const tokenAddresses = await paymaster.read.getSupportedTokens() as Address[];      
      if (!tokenAddresses) return

      console.log(tokenAddresses)

      const tokensPromises = tokenAddresses.map(async (tokenAddress: Hex) => {
        const tokenContract = getContract({
          address: tokenAddress,
          abi: erc20Abi,
          client: publicClient,
        })

        const [name, symbol, decimals, isActive] = await Promise.all([
          tokenContract.read.name(),
          tokenContract.read.symbol(),
          tokenContract.read.decimals(),
          paymaster.read.isTokenSupported([tokenAddress])
        ])

        if (isActive) {
          return {
            address: tokenAddress,
            name,
            symbol,
            decimals,
            logo: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png'
          } as SupportedToken
        }
        return null
      })

      const tokens = (await Promise.all(tokensPromises)).filter(Boolean) as SupportedToken[]
      setSupportedTokens(tokens)
      
      const daiToken = tokens.find(token => token.symbol === 'DAI')
      if (daiToken || tokens.length > 0) {
        setSelectedToken(daiToken || tokens[0])
      }
      
      return tokens
    } catch (err) {
      console.error('Error fetching supported tokens:', err)
      setError(err as Error)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSupportedTokens()
  }, [fetchSupportedTokens])

  const checkTokenAllowance = useCallback(async (
    tokenAddress: Address,
    requiredAmount?: bigint
  ): Promise<boolean> => {
    if (!aaAddress) return false

    try {
      const tokenContract = getContract({
        address: tokenAddress,
        abi: erc20Abi,
        client: publicClient,
      })

      const allowance = await tokenContract.read.allowance([
        aaAddress,
        MULTI_TOKEN_PAYMASTER_ADDRESS
      ]) as bigint

      // 必要な量が指定されていない場合は、承認があるかどうかだけをチェック
      if (!requiredAmount) return allowance > 0
      
      return allowance >= requiredAmount
    } catch (err) {
      console.error('Error checking token allowance:', err)
      return false
    }
  }, [aaAddress])

  const estimateTokenAmount = useCallback(async (
    tokenAddress: Address,
    ethAmount: bigint
  ): Promise<bigint> => {
    try {
      const paymaster = getContract({
        address: MULTI_TOKEN_PAYMASTER_ADDRESS,
        abi: multiTokenPaymasterAbi,
        client: publicClient,
      })

      // コントラクトのethToToken関数を呼び出してトークン量を計算
      const tokenAmount = await paymaster.read.ethToToken([
        tokenAddress,
        ethAmount
      ]) as bigint

      return tokenAmount
    } catch (err) {
      console.error('Error estimating token amount:', err)
      return BigInt(0)
    }
  }, [])

  // MultiTokenPaymasterのpaymasterAndDataを生成
  const getMultiTokenPaymasterAndData = useCallback(async (
    userOp: UserOperation,
    tokenAddress?: Address
  ): Promise<Hex> => {
    const tokenToUse = tokenAddress || (selectedToken?.address as Address)
    
    if (!tokenToUse) {
      throw new Error('No token selected')
    }

    try {
      // paymasterAddress(20バイト) + tokenAddress(20バイト)
      const paymasterAndData = `${MULTI_TOKEN_PAYMASTER_ADDRESS}${tokenToUse.slice(2)}` as Hex
      
      return paymasterAndData
    } catch (err) {
      console.error('Error generating paymasterAndData:', err)
      setError(err as Error)
      throw err
    }
  }, [selectedToken])

  return {
    supportedTokens,
    selectedToken,
    setSelectedToken,
    fetchSupportedTokens,
    checkTokenAllowance,
    estimateTokenAmount,
    getMultiTokenPaymasterAndData,
    loading,
    error
  }
}