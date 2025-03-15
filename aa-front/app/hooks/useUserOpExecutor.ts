import { useState, useCallback } from 'react';
import { createWalletClient, Hex, http } from 'viem';
import { bundlerClient, publicClient } from '../utils/client';
import useUserOperation from './useUserOperation';
import { usePaymasterData } from './usePaymasterData';
import { useExecuteUserOperation } from './useExecuteUserOperation';
import { ENTRY_POINT_ADDRESS, SIMPLE_ACCOUNT_ADDRESS } from '../constants/addresses';
import { entryPointAbi } from '../abi/entryPoint';
import { privateKeyToAccount, nonceManager } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { eip7702Actions } from 'viem/experimental';

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


export function useUserOperationExecutor(aaAddress: Hex, addressMode: 'aa' | 'eoa') {
  const [isProcessing, setIsProcessing] = useState(false);
  const { createUserOperation } = useUserOperation();
  const { getPaymasterAndData } = usePaymasterData();
  const { execute } = useExecuteUserOperation();

  /**
   * callData から UserOperation を作成して実行する
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

    if (addressMode === 'eoa') {
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

        const account = privateKeyToAccount('');
    
        const walletClient = createWalletClient({
          chain: sepolia,
          account: privateKeyToAccount(''),
          transport: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
        }).extend(eip7702Actions());
        

        const authorizatio = await walletClient.signAuthorization({
          contractAddress: SIMPLE_ACCOUNT_ADDRESS,
          delegate: true,
        });

        const authorization = await account.experimental_signAuthorization(
          authorizatio
        );

        const bundler = privateKeyToAccount(
          ''
        , {nonceManager});

        const bundlerWalletClient = createWalletClient({
          account: bundler,
          chain: sepolia,
          transport: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
        });
        

        const beneficiary = bundler.address;

        const args = [
          [userOp],
          beneficiary
        ];

        const hash = await bundlerWalletClient.writeContract({
          address: ENTRY_POINT_ADDRESS,
          abi: entryPointAbi,
          functionName: 'handleOps',
          account: bundler,
          args: [
            [userOp].map(usrOp => ({
              ...usrOp,
              callGasLimit: BigInt(usrOp.callGasLimit),
              verificationGasLimit: BigInt(usrOp.verificationGasLimit),
              preVerificationGas: BigInt(usrOp.preVerificationGas),
            })),
            beneficiary, // beneficiaryを追加
          ],
          maxFeePerGas: BigInt('1000000000'), // 1 Gwei
          maxPriorityFeePerGas: BigInt('500000000'), // 0.5 Gwei
          gas: BigInt('500000'),
          authorizationList: [authorization], // authorizationListを追加
        });

        console.log(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(receipt);

        return {
          success: true,
          userOpHash: hash,
        };
      } catch (error) {
        console.error('EOA execution error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }

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