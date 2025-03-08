// hooks/useExecuteUserOperation.ts
import { getContract, Hex } from 'viem'
import { entryPointAbi } from '../abi/entryPoint'
import { ENTRY_POINT_ADDRESS } from '../constants/addresses'
import { bundlerClient, publicClient } from '../utils/client'
import { UserOperation } from '../lib/userOperationType'
import { useWalletClient } from 'wagmi'
import { eip7702Actions } from 'viem/experimental'
import { useAA } from './useAA'

export function useExecuteUserOperation() {
  const { data: walletClient } = useWalletClient()
  const { addressMode } = useAA()

  const executeBatch = async (userOperations: UserOperation[]): Promise<Hex[]> => {
    if (!walletClient) {
      return ['0x']
    }

    const entryPoint = getContract({
      address: ENTRY_POINT_ADDRESS,
      abi: entryPointAbi,
      client: publicClient
    })

    // EOA モードでは EIP-7702 を使用
    if (addressMode === 'eoa') {
      try {
        // EIP-7702 拡張クライアントを作成
        const eip7702Client = walletClient.extend(eip7702Actions())
        
        // エントリーポイントのコントラクトアドレスに対する認証を取得
        const authorization = await eip7702Client.signAuthorization({
          contractAddress: ENTRY_POINT_ADDRESS,
        })

        // ユーザーオペレーションのハッシュを先に計算
        const userOpHashes = await Promise.all(
          userOperations.map(async (userOp) => {
            return entryPoint.read.getUserOpHash([userOp]) as Promise<Hex>
          })
        )
        
        // BigInt 型に変換
        const formattedUserOps = userOperations.map(userOp => ({
          ...userOp,
          callGasLimit: BigInt(userOp.callGasLimit),
          verificationGasLimit: BigInt(userOp.verificationGasLimit),
          preVerificationGas: BigInt(userOp.preVerificationGas),
          maxFeePerGas: BigInt(userOp.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
          nonce: BigInt(userOp.nonce),
        }))
        
        // beneficiary アドレス
        const beneficiary = walletClient.account.address
        
        // handleOps を直接呼び出す（バンドラーを通さずに直接エントリーポイントと対話）
        await eip7702Client.writeContract({
          address: ENTRY_POINT_ADDRESS,
          abi: entryPointAbi,
          functionName: 'handleOps',
          args: [formattedUserOps, beneficiary],
          authorizationList: [authorization],
        })
        
        // 計算したユーザーオペレーションハッシュを返す
        return userOpHashes
      } catch (error) {
        console.error('EIP-7702 execution error:', error)
        throw error
      }
    }

    // 通常の AA の実行（既存のコード）
    const signedUserOps = await Promise.all(
      userOperations.map(async (userOp) => {
        const userOpHashForSign = await entryPoint.read.getUserOpHash([userOp])
        const signature = await walletClient.signMessage({
          message: { raw: userOpHashForSign as `0x${string}` }
        })
        return { ...userOp, signature }
      })
    )

    const userOpHashes = await Promise.all(
      signedUserOps.map(async (userOp) => {
        return bundlerClient.request({
          method: 'eth_sendUserOperation',
          params: [userOp, ENTRY_POINT_ADDRESS]
        })
      })
    )

    return userOpHashes
  }

  const execute = async (userOperation: UserOperation): Promise<Hex> => {
    const [hash] = await executeBatch([userOperation])
    return hash
  }

  return { execute, executeBatch }
}