import { encodeFunctionData, Hex, parseUnits, formatUnits } from "viem"
import { SimpleAccountABI } from "../abi/simpleAccount"
import { publicClient } from "../utils/client"
import { useUserOperationExecutor } from "./useUserOpExecutor"
import { DAI_ADDRESS, UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ADDRESS, USDC_ADDRESS, WRAPPED_SEPOLIA_ADDRESS } from "../constants/addresses"
import { erc20Abi } from "../abi/erc20"
import { dexRouterAbi } from "../abi/dexRouter"
import { wrappedSepolia } from "../abi/wrappedSepolia"

interface SwapOptions {
  fromToken: string;  // トークンのアドレス
  toToken: string;    // トークンのアドレス
  amount: string;     // 入力金額
  slippage: number;   // スリッページ許容値（パーセント）
  deadline: number;   // 期限（秒）
}

interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

// Token decimal mapping
const TOKEN_DECIMALS: Record<string, number> = {
  [USDC_ADDRESS]: 6,
  [DAI_ADDRESS]: 18,
  [WRAPPED_SEPOLIA_ADDRESS]: 18,
  'SEP': 18,
};

export function useSwap(aaAddress: Hex) {
  const { executeCallData } = useUserOperationExecutor(aaAddress);
  
  const getTokenDecimals = async (tokenAddress: string): Promise<number> => {
    if (TOKEN_DECIMALS[tokenAddress]) {
      return TOKEN_DECIMALS[tokenAddress];
    }
    
    try {
      const decimals = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals'
      }) as number;
      
      return decimals;
    } catch (error) {
      console.error(`Failed to get token decimals for ${tokenAddress}:`, error);
      return 18;
    }
  };
  
  const checkPairExists = async (fromAddress: string, toAddress: string): Promise<{exists: boolean; pairAddress: string}> => {
    try {
      let pairAddress = '0x';
  
      if ((fromAddress === DAI_ADDRESS && toAddress === USDC_ADDRESS) || (fromAddress === USDC_ADDRESS && toAddress === DAI_ADDRESS)) {
        pairAddress = '0xb272ec9B463564b7813c4b4F7d2F6bec83728b15';
      } else {
        pairAddress = await publicClient.readContract({
          address: UNISWAP_FACTORY_ADDRESS as `0x${string}`,
          abi: dexRouterAbi,
          functionName: 'getPair',
          args: [fromAddress, toAddress]
        }) as `0x${string}`;
      }
  
      const exists = pairAddress !== '0x0000000000000000000000000000000000000000';
      console.log('Pair address:', pairAddress);
      
      return { exists, pairAddress };
    } catch (error) {
      console.error("Failed to check pair existence:", error);
      return { exists: false, pairAddress: '0x' };
    }
  };

  const isSupportedPair = async (fromAddress: string, toAddress: string): Promise<boolean> => {
    const actualFromAddress = fromAddress === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : fromAddress;
    const actualToAddress = toAddress === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : toAddress;
    
    const { exists } = await checkPairExists(actualFromAddress, actualToAddress);
    console.log('Pair support:', exists);
    return exists;
  };

  const swap = async (options: SwapOptions): Promise<TransactionResult> => {
    try {
      const { fromToken, toToken, amount, slippage, deadline } = options;
      console.log('From token:', fromToken);
      
      // ペアの存在確認
      const fromTokenAddress = fromToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : fromToken;
      const toTokenAddress = toToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : toToken;
      
      const pairSupported = await isSupportedPair(fromTokenAddress, toTokenAddress);
      if (!pairSupported) {
        throw new Error("This token pair doesn't have a liquidity pool.");
      }

      if (parseFloat(amount) <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // Get input token decimals
      const fromDecimals = await getTokenDecimals(fromTokenAddress);
      
      // Parse input amount with correct decimals
      const inputAmount = parseUnits(amount, fromDecimals);
      
      // Get swap estimate
      const estimatedOut = await getSwapEstimate(fromTokenAddress, toTokenAddress, amount);
      if (parseFloat(estimatedOut) <= 0) {
        throw new Error("Could not estimate output amount. The pool may have insufficient liquidity.");
      }

      // Calculate minimum output with slippage
      const amountOutMin = parseFloat(estimatedOut) * (1 - slippage / 100);
      
      // Get output token decimals
      const toDecimals = await getTokenDecimals(toTokenAddress);
      
      // Parse minimum output amount with correct decimals
      const amountOutMinBigInt = parseUnits(amountOutMin.toString(), toDecimals);
      
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline;

      if (fromToken === 'SEP') {
        console.log('SEP to ERC20');

        const depositWETHData = encodeFunctionData({
          abi: wrappedSepolia,
          functionName: 'deposit',
          args: []
        });

        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [UNISWAP_ROUTER_ADDRESS, inputAmount]
        });

        const swapData = encodeFunctionData({
          abi: dexRouterAbi,
          functionName: 'swapExactTokensForTokens',
          args: [
            inputAmount,
            amountOutMinBigInt,
            [WRAPPED_SEPOLIA_ADDRESS, toToken],
            aaAddress,
            BigInt(deadlineTimestamp)
          ]
        });

        const targets = [
          WRAPPED_SEPOLIA_ADDRESS,
          WRAPPED_SEPOLIA_ADDRESS,
          UNISWAP_ROUTER_ADDRESS
        ];

        const values = [
          inputAmount, // Send ETH with the deposit call
          BigInt(0),
          BigInt(0)
        ];

        const datas = [
          depositWETHData,
          approveData,
          swapData
        ];

        const callData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'executeBatch',
          args: [targets, values, datas]
        });

        return await executeCallData(callData);
      }
      
      else if (toToken === 'SEP') {
        console.log('ERC20 to SEP');
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [UNISWAP_ROUTER_ADDRESS, inputAmount]
        });

        const swapData = encodeFunctionData({
          abi: dexRouterAbi,
          functionName: 'swapExactTokensForETH',
          args: [
            inputAmount,
            amountOutMinBigInt,
            [fromToken, WRAPPED_SEPOLIA_ADDRESS],
            aaAddress,
            BigInt(deadlineTimestamp)
          ]
        });

        const targets = [
          fromToken,
          UNISWAP_ROUTER_ADDRESS
        ];
        
        const values = [
          BigInt(0),
          BigInt(0)
        ];
        
        const datas = [
          approveData,
          swapData
        ];

        const callData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'executeBatch',
          args: [targets, values, datas]
        });

        return await executeCallData(callData);
      }
      
      else {
        console.log('ERC20 to ERC20');

        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [UNISWAP_ROUTER_ADDRESS, inputAmount]
        });

        const swapData = encodeFunctionData({
          abi: dexRouterAbi,
          functionName: 'swapExactTokensForTokens',
          args: [
            inputAmount,
            amountOutMinBigInt,
            [fromToken, toToken],
            aaAddress,
            BigInt(deadlineTimestamp)
          ]
        });

        const targets = [
          fromToken,
          UNISWAP_ROUTER_ADDRESS
        ];
        
        const values = [
          BigInt(0),
          BigInt(0)
        ];
        
        const datas = [
          approveData,
          swapData
        ];

        // 4. executeBatchの実行
        const callData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'executeBatch',
          args: [targets, values, datas]
        });

        return await executeCallData(callData);
      }
    } catch (error) {
      console.error("Swap error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to swap tokens"
      };
    }
  };

  const getSwapEstimate = async (fromToken: string, toToken: string, amount: string): Promise<string> => {
    try {
      if (!amount || parseFloat(amount) <= 0) {
        return "0";
      }

      const pairSupported = await isSupportedPair(fromToken, toToken);
      if (!pairSupported) {
        console.warn("This token pair doesn't have a liquidity pool");
        return "0";
      }

      try {
        // Parse amount with correct decimals
        const fromDecimals = await getTokenDecimals(fromToken);
        const inputAmount = parseUnits(amount, fromDecimals);
        
        const amountsOut = await publicClient.readContract({
          address: UNISWAP_ROUTER_ADDRESS as `0x${string}`,
          abi: dexRouterAbi,
          functionName: 'getAmountsOut',
          args: [inputAmount, [fromToken, toToken]]
        }) as bigint[];
        
        if (amountsOut && amountsOut.length > 1) {
          // Format with correct decimals
          const toDecimals = await getTokenDecimals(toToken);
          return formatUnits(amountsOut[1], toDecimals);
        }
        return "0";
      } catch (error) {
        console.error("Failed to get amounts out:", error);
        
        // フォールバック: シンプルなダミーレートを使用
        // 実際の実装では削除
        const estimatedAmount = parseFloat(amount) * 1.5;
        return estimatedAmount.toString();
      }
    } catch (error) {
      console.error("Failed to get swap estimate:", error);
      return "0";
    }
  };

  const getTokenSymbol = async (tokenAddress: string): Promise<string> => {
    try {
      const symbol = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol'
      }) as string;
      
      return symbol;
    } catch (error) {
      console.error(`Failed to get token symbol for ${tokenAddress}:`, error);
      return "UNKNOWN";
    }
  };

  const getTokenBalance = async (tokenAddress: string): Promise<string> => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [aaAddress]
      }) as bigint;
      
      // Format with correct decimals
      const decimals = await getTokenDecimals(tokenAddress);
      return formatUnits(balance, decimals);
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress}:`, error);
      return "0";
    }
  };

  return {
    swap,
    getSwapEstimate,
    isSupportedPair,
    checkPairExists,
    getTokenBalance,
    getTokenSymbol
  };
}