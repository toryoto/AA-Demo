import { getContract, Hex } from 'viem'
import { entryPointAbi } from '../abi/entryPoint'
import { ENTRY_POINT_ADDRESS } from '../constants/addresses'
import { bundlerClient, publicClient } from '../utils/client'
import { UserOperation } from '../lib/userOperationType'
import { useWalletClient } from 'wagmi'

export function useExecuteUserOperation() {
  const { data: walletClient } = useWalletClient()

  const executeBatch = async (userOperations: UserOperation[]): Promise<Hex[]> => {
    if (!walletClient) {
      return ['0x']
    }

    const entryPoint = getContract({
      address: ENTRY_POINT_ADDRESS,
      abi: entryPointAbi,
      client: publicClient,
    })

    const signedUserOps = await Promise.all(
      userOperations.map(async userOp => {
        const userOpHashForSign = await entryPoint.read.getUserOpHash([userOp])
        const signature = await walletClient.signMessage({
          message: { raw: userOpHashForSign as `0x${string}` },
        })
        return { ...userOp, signature }
      })
    )

    const userOpHashes = await Promise.all(
      signedUserOps.map(async userOp => {
        return bundlerClient.request({
          method: 'eth_sendUserOperation',
          params: [userOp, ENTRY_POINT_ADDRESS],
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
