import { Hex, toHex } from 'viem';
import { UserOperation } from '../lib/userOperationType';
import { publicClient } from '../utils/client';
import { ENTRY_POINT_ADDRESS } from '../constants/addresses';
import { entryPointAbi } from '../abi/entryPoint';

function useUserOperation() {
  const createUserOperation = async (aaAddress: Hex, initCode?: Hex): Promise<UserOperation> => {
    try {
      const nonce = await publicClient.readContract({
        address: ENTRY_POINT_ADDRESS,
        abi: entryPointAbi,
        functionName: 'getNonce',
        args: [aaAddress, BigInt(0)],
      }) as bigint;
      if (nonce === null) {
        throw new Error('Nonce is not fetched yet.');
      }

      return {
        sender: aaAddress,
        nonce: toHex(nonce),
        initCode: initCode || '0x',
        callData: '0x',
        callGasLimit: toHex(3_000_000),
        verificationGasLimit: toHex(3_000_000),
        preVerificationGas: toHex(3_000_000),
        maxFeePerGas: toHex(2_000_000_000),
        maxPriorityFeePerGas: toHex(2_000_000_000),
        paymasterAndData: '0x',
        signature: '0x',
      };
    } catch (error) {
      console.error('Error fetching nonce:', error);
      throw error; 
    }
  };

  return { createUserOperation };
}

export default useUserOperation;