import { encodeFunctionData, Hex, parseEther, formatEther } from "viem"
import { SimpleAccountABI } from "../abi/simpleAccount"
import { publicClient } from "../utils/client"
import { useUserOperationExecutor } from "./useUserOpExecutor"
import { UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ADDRESS } from "../constants/addresses"
import { erc20Abi } from "../abi/erc20"
import { dexRouterAbi } from "../abi/dexRouter"

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

interface PoolInfo {
  tokenA: { symbol: string; address: string; reserve: string };
  tokenB: { symbol: string; address: string; reserve: string };
  pairAddress: string;
  exists: boolean;
}

export function useSwap(aaAddress: Hex) {
  const { executeCallData } = useUserOperationExecutor(aaAddress);

  // ペアが存在するかどうかを確認
  const checkPairExists = async (fromAddress: string, toAddress: string): Promise<{exists: boolean; pairAddress: string}> => {
    try {
      // Factoryコントラクトを使用
      const pairAddress = await publicClient.readContract({
        address: UNISWAP_FACTORY_ADDRESS as `0x${string}`,
        abi: dexRouterAbi,
        functionName: 'getPair',
        args: [fromAddress, toAddress]
      }) as `0x${string}`;
      
      // アドレスがゼロアドレスでなければ、ペアは存在する
      const exists = pairAddress !== '0x0000000000000000000000000000000000000000';
      console.log(pairAddress)
      
      return { exists, pairAddress };
    } catch (error) {
      console.error("Failed to check pair existence:", error);
      return { exists: false, pairAddress: '0x' };
    }
  };

  // サポートされているトークンペアかどうかを確認（プール存在確認）
  const isSupportedPair = async (fromAddress: string, toAddress: string): Promise<boolean> => {
    const { exists } = await checkPairExists(fromAddress, toAddress);
    return exists;
  };

  const approveToken = async (tokenAddress: string, amount: string): Promise<TransactionResult> => {
    try {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [UNISWAP_ROUTER_ADDRESS, parseEther(amount)]
      });

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [tokenAddress, '0x0', approveData]
      });

      return await executeCallData(callData);
    } catch (error) {
      console.error("Token approval error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve token"
      };
    }
  };

  // スワップ処理
  const swap = async (options: SwapOptions): Promise<TransactionResult> => {
    try {
      const { fromToken, toToken, amount, slippage, deadline } = options;
      
      // ペアの存在確認
      const pairSupported = await isSupportedPair(fromToken, toToken);
      if (!pairSupported) {
        throw new Error("This token pair doesn't have a liquidity pool.");
      }

      if (parseFloat(amount) <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // 入力トークンに対する承認
      const approvalResult = await approveToken(fromToken, amount);
      if (!approvalResult.success) {
        throw new Error(`Failed to approve token: ${approvalResult.error}`);
      }

      // 見積もり額の取得
      const estimatedOut = await getSwapEstimate(fromToken, toToken, amount);
      if (parseFloat(estimatedOut) <= 0) {
        throw new Error("Could not estimate output amount. The pool may have insufficient liquidity.");
      }

      // 最小受け取り額の計算（スリッページを考慮）
      const amountOutMin = parseFloat(estimatedOut) * (1 - slippage / 100);
      
      // スワップ関数の呼び出し
      const path = [fromToken, toToken];
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline;
      
      const swapData = encodeFunctionData({
        abi: dexRouterAbi,
        functionName: 'swapExactTokensForTokens',
        args: [
          parseEther(amount),
          parseEther(amountOutMin.toString()),
          path,
          aaAddress,
          BigInt(deadlineTimestamp)
        ]
      });

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [UNISWAP_ROUTER_ADDRESS, '0x0', swapData]
      });

      return await executeCallData(callData);
    } catch (error) {
      console.error("Swap error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to swap tokens"
      };
    }
  };

  // スワップレート見積もり
  const getSwapEstimate = async (fromToken: string, toToken: string, amount: string): Promise<string> => {
    try {
      if (!amount || parseFloat(amount) <= 0) {
        return "0";
      }

      // ペアの存在確認
      const pairSupported = await isSupportedPair(fromToken, toToken);
      if (!pairSupported) {
        console.warn("This token pair doesn't have a liquidity pool");
        return "0";
      }

      try {
        // 実際のDEXルーターを使用して見積もりを取得
        const amountsOut = await publicClient.readContract({
          address: UNISWAP_ROUTER_ADDRESS as `0x${string}`,
          abi: dexRouterAbi,
          functionName: 'getAmountsOut',
          args: [parseEther(amount), [fromToken, toToken]]
        }) as bigint[];
        
        if (amountsOut && amountsOut.length > 1) {
          return formatEther(amountsOut[1]);
        }
        return "0";
      } catch (error) {
        console.error("Failed to get amounts out:", error);
        
        // フォールバック: シンプルなダミーレートを使用
        // 実際の実装では削除してください
        const estimatedAmount = parseFloat(amount) * 1.5;
        return estimatedAmount.toString();
      }
    } catch (error) {
      console.error("Failed to get swap estimate:", error);
      return "0";
    }
  };

  // トークンのシンボルを取得
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

  // プール情報取得
  const getPoolInfo = async (tokenA: string, tokenB: string): Promise<PoolInfo> => {
    try {
      // ペアの確認
      const { exists, pairAddress } = await checkPairExists(tokenA, tokenB);
      
      if (!exists || pairAddress === '0x') {
        return {
          tokenA: { symbol: await getTokenSymbol(tokenA), address: tokenA, reserve: "0" },
          tokenB: { symbol: await getTokenSymbol(tokenB), address: tokenB, reserve: "0" },
          pairAddress: '0x',
          exists: false
        };
      }

      try {
        // プールの流動性情報を取得
        const [reserve0, reserve1] = await publicClient.readContract({
          address: pairAddress as `0x${string}`,
          abi: dexRouterAbi,
          functionName: 'getReserves'
        }) as [bigint, bigint, number];
        
        // トークンのシンボルを取得
        const symbolA = await getTokenSymbol(tokenA);
        const symbolB = await getTokenSymbol(tokenB);
        
        return {
          tokenA: { 
            symbol: symbolA, 
            address: tokenA, 
            reserve: formatEther(reserve0) 
          },
          tokenB: { 
            symbol: symbolB, 
            address: tokenB, 
            reserve: formatEther(reserve1) 
          },
          pairAddress,
          exists: true
        };
      } catch (error) {
        console.error("Failed to get reserves:", error);
        
        // フォールバック: ダミーデータを返す
        return {
          tokenA: { 
            symbol: await getTokenSymbol(tokenA), 
            address: tokenA, 
            reserve: "1000" 
          },
          tokenB: { 
            symbol: await getTokenSymbol(tokenB), 
            address: tokenB, 
            reserve: "1500" 
          },
          pairAddress,
          exists: true
        };
      }
    } catch (error) {
      console.error("Failed to get pool info:", error);
      return {
        tokenA: { symbol: "UNKNOWN", address: tokenA, reserve: "0" },
        tokenB: { symbol: "UNKNOWN", address: tokenB, reserve: "0" },
        pairAddress: '0x',
        exists: false
      };
    }
  };

  // トークンの残高を取得
  const getTokenBalance = async (tokenAddress: string): Promise<string> => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [aaAddress]
      }) as bigint;
      
      return formatEther(balance);
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress}:`, error);
      return "0";
    }
  };

  // トークンの許可残高を取得
  const getAllowance = async (tokenAddress: string): Promise<string> => {
    try {
      const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [aaAddress, UNISWAP_ROUTER_ADDRESS]
      }) as bigint;
      
      return formatEther(allowance);
    } catch (error) {
      console.error(`Failed to get allowance for ${tokenAddress}:`, error);
      return "0";
    }
  };

  return {
    swap,
    getSwapEstimate,
    getPoolInfo,
    isSupportedPair,
    checkPairExists,
    approveToken,
    getTokenBalance,
    getAllowance,
    getTokenSymbol
  };
}