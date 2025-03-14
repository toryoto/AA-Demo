import { useState, useCallback } from 'react';
import { Hex, toHex } from 'viem';
import { bundlerClient, publicClient } from '../utils/client';
import { ENTRY_POINT_ADDRESS } from '../constants/addresses';
import { entryPointAbi } from '../abi/entryPoint';
import { UserOperation } from '../lib/userOperationType';
import { usePaymasterData } from './usePaymasterData';
import { useExecuteUserOperation } from './useExecuteUserOperation';

interface ExecuteOptions {
  initCode?: Hex;
  waitForReceipt?: boolean;
  timeout?: number;
  usePaymaster?: boolean;
  customPaymasterAndData?: Hex;
}

interface ExecuteResult {
  success: boolean;
  userOpHash?: Hex;
  txHash?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  receipt?: any;
  error?: string;
}

export function useUserOperationExecutor(aaAddress: Hex) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { getPaymasterAndData } = usePaymasterData();
  const { execute } = useExecuteUserOperation();

  /**
   * UserOperation を作成するメソッド
   * @param aaAddress
   * @param initCode
   * @param callData
   * @returns UserOperation
   */
  const createUserOperation = useCallback(async ({ 
    aaAddress, 
    initCode = '0x', 
    callData = '0x' 
  }: { 
    aaAddress: Hex, 
    initCode?: Hex, 
    callData?: Hex 
  }): Promise<UserOperation> => {
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
        initCode,
        callData,
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
  }, []);

  /**
   * callData から UserOperation を作成して実行するメソッド
   * @param callData 実行するコントラクト関数のコールデータ
   * @param options 実行オプション
   * @returns 実行結果
   */
  const executeCallData = useCallback(async (
    callData: Hex,
    options: ExecuteOptions = {}
  ): Promise<ExecuteResult> => {
    const { 
      initCode = '0x', 
      waitForReceipt = true, 
      timeout = 60000,
      usePaymaster = true,
      customPaymasterAndData
    } = options;
    
    if (!aaAddress || aaAddress === '0x') {
      return { success: false, error: 'Smart account address not available' };
    }

    setIsProcessing(true);

    try {
      const userOp = await createUserOperation({ 
        aaAddress, 
        callData,
        initCode 
      });
      
      if (customPaymasterAndData) {
        userOp.paymasterAndData = customPaymasterAndData;
      } else if (usePaymaster) {
        const paymasterAndData = await getPaymasterAndData(userOp);
        userOp.paymasterAndData = paymasterAndData;
      }

      const userOpHash = await execute(userOp);
      
      if (!waitForReceipt) {
        return {
          success: true,
          userOpHash
        };
      }
      
      const receipt = await bundlerClient.waitForUserOperationReceipt({ 
        hash: userOpHash,
        timeout
      });
      
      return {
        success: receipt.success,
        userOpHash,
        txHash: receipt.receipt.transactionHash,
        receipt
      };
    } catch (error) {
      console.error('UserOperation execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [aaAddress, createUserOperation, getPaymasterAndData, execute]);

  return {
    executeCallData,
    createUserOperation,
    isProcessing,
  };
}