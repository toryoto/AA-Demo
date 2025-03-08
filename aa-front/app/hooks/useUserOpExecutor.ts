// hooks/useUserOpExecutor.ts
import { useState, useCallback } from 'react';
import { Hex } from 'viem';
import { bundlerClient } from '../utils/client';
import useUserOperation from './useUserOperation';
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
  const { createUserOperation } = useUserOperation();
  const { getPaymasterAndData } = usePaymasterData();
  const { execute } = useExecuteUserOperation();

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
    isProcessing,
  };
}