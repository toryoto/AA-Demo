import { getContract, Hex } from 'viem'
import { entryPointAbi } from '../abi/entryPoint'
import { ENTRY_POINT_ADDRESS } from '../constants/addresses'
import { bundlerClient, publicClient } from '../utils/client'
import { UserOperation } from '../lib/userOperationType'
import { useWalletClient } from 'wagmi'


export function useUserOperationManager() {
  const { data: walletClient } = useWalletClient()

  const signAndSendUserOperation = async (userOperation: UserOperation): Promise<Hex> => {
    if (!walletClient) {
      return '0x'
    }

    const entryPoint = getContract({
      address: ENTRY_POINT_ADDRESS,
      abi: entryPointAbi,
      client: publicClient
    })
    const userOpHashForSign = await entryPoint.read.getUserOpHash([userOperation])

    const signature = await walletClient.signMessage({
      message: { raw: userOpHashForSign as `0x${string}` }
    })
    userOperation.signature = signature

    const userOpHash = await bundlerClient.request({
      method: 'eth_sendUserOperation',
      params: [userOperation, ENTRY_POINT_ADDRESS]
    })

    return userOpHash;
  }

  return { signAndSendUserOperation };
}