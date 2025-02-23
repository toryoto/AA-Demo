import { useState, useEffect } from 'react'
import { PublicClient } from 'viem'
import { erc20Abi } from '../abi/erc20'

export interface ImportedToken {
  address: string;
  name: string;
  symbol: string;
}

const STORAGE_KEY = 'importedTokens'

export const useImportedTokens = (publicClient: PublicClient, accountAddress: string) => {
  const [importedTokens, setImportedTokens] = useState<ImportedToken[]>([])

  // ローカルストレージからトークンを読み込む
  useEffect(() => {
    const loadTokens = () => {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${accountAddress}`)
      if (stored) {
        setImportedTokens(JSON.parse(stored))
      }
    }
    loadTokens()
  }, [accountAddress])

  // トークン情報を検証して取得
  const validateAndGetTokenInfo = async (address: string): Promise<ImportedToken | null> => {
    try {
      const [name, symbol] = await Promise.all([
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name'
        }),
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol'
        })
      ]);

      return {
        address,
        name: name as string,
        symbol: symbol as string
      };
    } catch (error) {
      console.error('Invalid token address:', error)
      return null
    }
  }

  const importToken = async (address: string): Promise<boolean> => {
    // アドレスが既に存在するかチェック
    if (importedTokens.some(token => token.address.toLowerCase() === address.toLowerCase())) {
      return false
    }

    const tokenInfo = await validateAndGetTokenInfo(address)
    if (!tokenInfo) return false

    const updatedTokens = [...importedTokens, tokenInfo]
    setImportedTokens(updatedTokens)
    localStorage.setItem(`${STORAGE_KEY}_${accountAddress}`, JSON.stringify(updatedTokens))
    return true
  }

  const removeToken = (address: string) => {
    const updatedTokens = importedTokens.filter(
      token => token.address.toLowerCase() !== address.toLowerCase()
    )
    setImportedTokens(updatedTokens)
    localStorage.setItem(`${STORAGE_KEY}_${accountAddress}`, JSON.stringify(updatedTokens))
  }

  return {
    importedTokens,
    importToken,
    removeToken
  }
}