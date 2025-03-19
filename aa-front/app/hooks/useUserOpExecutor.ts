import { useState, useCallback } from 'react'
import { encodeFunctionData, erc20Abi, Hex, toHex } from 'viem'
import { bundlerClient, publicClient } from '../utils/client'
import { ENTRY_POINT_ADDRESS, MULTI_TOKEN_PAYMASTER_ADDRESS } from '../constants/addresses'
import { entryPointAbi } from '../abi/entryPoint'
import { UserOperation } from '../lib/userOperationType'
import { usePaymasterData } from './usePaymasterData'
import { useExecuteUserOperation } from './useExecuteUserOperation'
import { useUserOpConfirmation } from '../contexts/UserOpConfirmationContext'
import { useMultiTokenPaymasterData } from './useMultiTokenPaymasterData'
import { SimpleAccountABI } from '../abi/simpleAccount'

interface ExecuteOptions {
  initCode?: Hex
  waitForReceipt?: boolean
  timeout?: number
  usePaymaster?: boolean
  multiTokenPaymaster? : boolean
  customPaymasterAndData?: Hex
  skipConfirmation?: boolean
  tokenAddress?: string 
}

interface ExecuteResult {
  success: boolean
  userOpHash?: Hex
  txHash?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  receipt?: any
  error?: string
}

export function useUserOperationExecutor(aaAddress: Hex) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { getPaymasterAndData } = usePaymasterData()
  const { execute } = useExecuteUserOperation()
  const { confirmUserOp } = useUserOpConfirmation()
  const { getMultiTokenPaymasterAndData, selectedToken, checkTokenAllowance } = useMultiTokenPaymasterData(aaAddress)

  /**
   * UserOperation を作成するメソッド
   */
  const createUserOperation = useCallback(
    async ({
      aaAddress,
      initCode = '0x',
      callData = '0x',
    }: {
      aaAddress: Hex
      initCode?: Hex
      callData?: Hex
    }): Promise<UserOperation> => {
      try {
        const nonce = (await publicClient.readContract({
          address: ENTRY_POINT_ADDRESS,
          abi: entryPointAbi,
          functionName: 'getNonce',
          args: [aaAddress, BigInt(0)],
        })) as bigint

        if (nonce === null) {
          throw new Error('Nonce is not fetched yet.')
        }

        return {
          sender: aaAddress,
          nonce: toHex(nonce),
          initCode,
          callData,
          callGasLimit: toHex(300_000),
          verificationGasLimit: toHex(200_000),
          preVerificationGas: toHex(50_000),
          maxFeePerGas: toHex(500_000_000),
          maxPriorityFeePerGas: toHex(200_000_000),
          paymasterAndData: '0x',
          signature: '0x',
        }
      } catch (error) {
        console.error('Error fetching nonce:', error)
        throw error
      }
    },
    []
  )

  const approveTokenForPaymaster = useCallback(
    async (tokenAddress: Hex): Promise<ExecuteResult> => {
      try {
        const maxApprovalAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        
        const approveCallData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [MULTI_TOKEN_PAYMASTER_ADDRESS, maxApprovalAmount]
        });
        
        const executeCallData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'execute',
          args: [tokenAddress, BigInt(0), approveCallData]
        });
        
        const userOp = await createUserOperation({
          aaAddress,
          callData: executeCallData,
        });
        console.log(userOp)
        const paymasterAndData = await getPaymasterAndData(userOp);
        userOp.paymasterAndData = paymasterAndData;
        const userOpHash = await execute(userOp);
        
        const receipt = await bundlerClient.waitForUserOperationReceipt({
          hash: userOpHash,
          timeout: 60000,
        });
        
        return {
          success: receipt.success,
          userOpHash,
          txHash: receipt.receipt.transactionHash,
          receipt,
        };
        
      } catch (error) {
        console.error('Token approval failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
    [aaAddress, createUserOperation, execute, getPaymasterAndData]
  );

  /**
   * 実際のUserOp実行処理を行う内部関数
   */
  const performExecution = useCallback(
    async (callData: Hex, options: ExecuteOptions = {}): Promise<ExecuteResult> => {
      const {
        initCode = '0x',
        waitForReceipt = true,
        timeout = 60000,
        usePaymaster = false,
        multiTokenPaymaster = false,
        customPaymasterAndData,
        tokenAddress,
      } = options;
  
      if (!aaAddress || aaAddress === '0x') {
        return { success: false, error: 'Smart account address not available' }
      }
  
      setIsProcessing(true);
  
      try {
        const userOp = await createUserOperation({
          aaAddress,
          callData,
          initCode,
        });
  
        if (customPaymasterAndData) {
          userOp.paymasterAndData = customPaymasterAndData;
        } else if (usePaymaster) {
          const paymasterAndData = await getPaymasterAndData(userOp);
          userOp.paymasterAndData = paymasterAndData;
        } else if (multiTokenPaymaster) {
          // トークンで支払う場合
          // tokenAddressが指定されている場合はそれを使用、そうでなければselectedToken
          const tokenToUse = tokenAddress || (selectedToken ? selectedToken.address : null);
          
          if (!tokenToUse) {
            return { success: false, error: 'No token selected for gas payment' };
          }
  
          // トークンの許可を確認
          const hasAllowance = await checkTokenAllowance(tokenToUse as Hex);
  
          if (!hasAllowance) {
            // approveがない場合は承認トランザクションを実行
            const approveResult = await approveTokenForPaymaster(tokenToUse as Hex);
            if (!approveResult.success) {
              return ({
                success: false,
                error: `Failed to approve token: ${approveResult.error}`
              });
            }
            console.log('Token approval successful:', approveResult);
          }
  
          const paymasterAndData = await getMultiTokenPaymasterAndData(userOp, tokenToUse as Hex);
          userOp.paymasterAndData = paymasterAndData;
        }
        // ネイティブ通貨で支払う場合は paymasterAndData は '0x' のまま
  
        const userOpHash = await execute(userOp);
  
        if (!waitForReceipt) {
          return {
            success: true,
            userOpHash,
          };
        }
  
        const receipt = await bundlerClient.waitForUserOperationReceipt({
          hash: userOpHash,
          timeout,
        });
  
        return {
          success: receipt.success,
          userOpHash,
          txHash: receipt.receipt.transactionHash,
          receipt,
        };
      } catch (error) {
        console.error('UserOperation execution failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [aaAddress, createUserOperation, getPaymasterAndData, execute, getMultiTokenPaymasterAndData, checkTokenAllowance, approveTokenForPaymaster, selectedToken]
  );

  const executeCallData = useCallback(
    async (callData: Hex, options: ExecuteOptions = {}): Promise<ExecuteResult> => {
      return new Promise<ExecuteResult>((resolve, reject) => {
        confirmUserOp(callData, async (userSelection) => {
          try {
            const updatedOptions: ExecuteOptions = {
              ...options,
              usePaymaster: userSelection.paymentOption === 'paymaster',
              multiTokenPaymaster: userSelection.paymentOption === 'token',
            };
            
            if (userSelection.paymentOption === 'token' && userSelection.tokenAddress) {
              updatedOptions.tokenAddress = userSelection.tokenAddress;
            }
            
            const result = await performExecution(callData, updatedOptions);
            resolve(result);
          } catch (error) {
            console.error('実行中にエラーが発生しました:', error);
            reject(error);
          }
        });
      });
    },
    [performExecution, confirmUserOp]
  );

  return {
    executeCallData,
    createUserOperation,
    isProcessing,
  };
}