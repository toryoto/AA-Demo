import React, { useState, useEffect } from 'react';
import { 
  ArrowDownUp, 
  Settings, 
  ArrowDown, 
  Info, 
  Loader2, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from './ui/card';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from './ui/tooltip';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { useAA } from '../hooks/useAA';
import { useFetchAABalance } from '../hooks/useFetchAABalance';
import { 
  WRAPPED_SEPOLIA_ADDRESS 
} from '../constants/addresses';
import { TOKEN_OPTIONS } from '../constants/tokenList';
import { useSwap } from '../hooks/useSwap';
import TokenSelector from './TokenSelector';

interface SwapProps {
  isDeployed: boolean;
  onSwapComplete?: () => void;
}

export const Swap: React.FC<SwapProps> = ({ isDeployed, onSwapComplete }) => {
  const { aaAddress } = useAA();
  const { balance: ethBalance, fetchBalance } = useFetchAABalance(aaAddress);
  
  const { 
    swap, 
    getSwapEstimate, 
    isSupportedPair, 
    getTokenBalance, 
    getTokenSymbol
  } = useSwap(aaAddress);

  const [fromToken, setFromToken] = useState<string>('SEP');
  const [toToken, setToToken] = useState<string>('');
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [swapping, setSwapping] = useState<boolean>(false);
  const [swapStatus, setSwapStatus] = useState<{status: 'success' | 'error' | null; message: string}>({
    status: null,
    message: ''
  });
  const [priceImpact, setPriceImpact] = useState<string>('0.00');
  const [pairSupported, setPairSupported] = useState<boolean>(false);
  const [isCheckingPair, setIsCheckingPair] = useState<boolean>(false);
  // Add states to store token balances to prevent infinite loops
  const [fromTokenBalance, setFromTokenBalance] = useState<string>('0');
  const [toTokenBalance, setToTokenBalance] = useState<string>('0');
  
  // Fetch token balances when tokens change
  useEffect(() => {
    const updateTokenBalances = async () => {
      if (fromToken) {
        if (fromToken === 'SEP') {
          setFromTokenBalance(ethBalance);
        } else {
          try {
            const balance = await getTokenBalance(fromToken);
            setFromTokenBalance(balance);
          } catch (error) {
            console.error("Error fetching from token balance:", error);
            setFromTokenBalance('0');
          }
        }
      }
      
      if (toToken) {
        if (toToken === 'SEP') {
          setToTokenBalance(ethBalance);
        } else {
          try {
            const balance = await getTokenBalance(toToken);
            setToTokenBalance(balance);
          } catch (error) {
            console.error("Error fetching to token balance:", error);
            setToTokenBalance('0');
          }
        }
      }
    };
    
    updateTokenBalances();
  }, [fromToken, toToken, ethBalance]);

  // Check if pair is supported when tokens change
  useEffect(() => {
    const checkPairSupport = async () => {
      if (fromToken && toToken && fromToken !== toToken) {
        setIsCheckingPair(true);
        setFromAmount('');
        setToAmount('');
        setSwapStatus({ status: null, message: '' });
        setPairSupported(false);
        
        try {
          // Handle ETH by using Wrapped ETH address
          const fromTokenAddress = fromToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : fromToken;
          const toTokenAddress = toToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : toToken;
          
          // Check if pair is supported (only WSEP and DAI have liquidity)
          const supported = await isSupportedPair(fromTokenAddress, toTokenAddress);
          setPairSupported(supported);
          
          // If not supported, show an alert
          if (!supported) {
            setSwapStatus({
              status: 'error',
              message: 'This token pair does not have a liquidity pool available.'
            });
          } else {
            // Set a random price impact between 0.1% and 2% for supported pairs
            const impact = (0.1 + Math.random() * 1.9).toFixed(2);
            setPriceImpact(impact);
          }
        } catch (error) {
          console.error("Error checking pair support:", error);
          setPairSupported(false);
          setSwapStatus({
            status: 'error',
            message: 'Error checking pair support. Please try again.'
          });
        } finally {
          setIsCheckingPair(false);
        }
      }
    };
    
    if (fromToken && toToken && fromToken !== toToken) {
      checkPairSupport();
    }
  }, [fromToken, toToken]);

  // Get swap estimate when fromAmount changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken && fromToken !== toToken && pairSupported) {
      const getEstimate = async () => {
        try {
          // Handle ETH by using Wrapped ETH address
          const fromTokenAddress = fromToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : fromToken;
          const toTokenAddress = toToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : toToken;
          
          const estimate = await getSwapEstimate(fromTokenAddress, toTokenAddress, fromAmount);
          setToAmount(estimate);
        } catch (error) {
          console.error("Error getting swap estimate:", error);
          setToAmount('0');
        }
      };
      
      timeoutId = setTimeout(() => {
        getEstimate();
      }, 300);
    } else {
      setToAmount('');
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fromAmount, fromToken, toToken, pairSupported]);

  const switchTokens = () => {
    if (!fromToken || !toToken) return;
    
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0 || !pairSupported) return;
    
    setSwapping(true);
    setSwapStatus({ status: null, message: '' });
    
    try {
      // 状態表示用のメッセージを作成
      let actionMessage = "";
      if (fromToken === 'SEP') {
        actionMessage = "SEP to token swap";
      } else if (toToken === 'SEP') {
        actionMessage = "Token to SEP swap with approval";
      } else {
        actionMessage = "Token to token swap with approval";
      }
      
      console.log(`Executing ${actionMessage}`);
      
      // Execute swap with batch processing
      const swapResult = await swap({
        fromToken: fromToken,
        toToken: toToken,
        amount: fromAmount,
        slippage: slippage,
        deadline: 600
      });
      
      if (swapResult.success) {
        const fromTokenAddress = fromToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : fromToken;
        const toTokenAddress = toToken === 'SEP' ? WRAPPED_SEPOLIA_ADDRESS : toToken;
        const fromTokenSymbol = fromToken === 'SEP' ? 'SEP' : await getTokenSymbol(fromTokenAddress);
        const toTokenSymbol = toToken === 'SEP' ? 'SEP' : await getTokenSymbol(toTokenAddress);
        
        setSwapStatus({
          status: 'success',
          message: `Successfully swapped ${fromAmount} ${fromTokenSymbol} for ${toAmount} ${toTokenSymbol}`
        });
        
        // Reset form after successful swap
        setFromAmount('');
        setToAmount('');
        
        // Refresh balances
        fetchBalance();
        if (onSwapComplete) onSwapComplete();
      } else {
        throw new Error(swapResult.error || 'Swap failed');
      }
    } catch (error) {
      setSwapStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setSwapping(false);
    }
  };

  const handleMaxButtonClick = () => {
    // Handle ETH differently to leave some for gas
    if (fromToken === 'SEP') {
      const maxEth = Math.max(0, parseFloat(fromTokenBalance) - 0.01);
      setFromAmount(maxEth.toFixed(6));
    } else {
      setFromAmount(fromTokenBalance);
    }
  };

  const getTokenSymbolLocal = (tokenAddress: string): string => {
    if (tokenAddress === 'SEP') return 'SEP';
    
    const token = TOKEN_OPTIONS.find(t => t.address === tokenAddress);
    return token ? token.symbol : tokenAddress.slice(0, 6) + '...' + tokenAddress.slice(-4);
  };

  const isValidSwap = () => {
    if (!fromToken || !toToken || fromToken === toToken) return false;
    if (!fromAmount || parseFloat(fromAmount) <= 0) return false;
    if (!pairSupported) return false;
    
    return true;
  };

  if (!isDeployed) return null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Swap Tokens</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-slate-500" 
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Swap settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {swapStatus.status && (
          <Alert className={`${swapStatus.status === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-start gap-2">
              {swapStatus.status === 'success' 
                ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> 
                : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
              <AlertDescription>{swapStatus.message}</AlertDescription>
            </div>
          </Alert>
        )}

        {showSettings && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-2">
            <h3 className="text-sm font-medium mb-3">Swap Settings</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Slippage Tolerance</Label>
                  <Badge variant="outline" className="font-mono">{slippage}%</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Slider 
                    value={[slippage]} 
                    min={0.1} 
                    max={5} 
                    step={0.1}
                    onValueChange={(values) => setSlippage(values[0])}
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Transaction will revert if price changes by more than {slippage}%</span>
              </div>
            </div>
          </div>
        )}

        {/* From Token Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">From</Label>
            <div className="text-xs text-slate-500">
              Balance: {fromToken === 'SEP' ? parseFloat(ethBalance).toFixed(6) : parseFloat(fromTokenBalance).toFixed(6)} {getTokenSymbolLocal(fromToken)}
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-[140px]">
                <TokenSelector
                  value={fromToken}
                  onChange={(value) => {
                    if (value === toToken) {
                      setToToken('');
                    }
                    setFromToken(value);
                  }}
                  disabled={toToken ? [toToken] : []}
                />
              </div>
              
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="pr-16 bg-white"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 px-2 text-xs text-primary"
                  onClick={handleMaxButtonClick}
                >
                  MAX
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-8 w-8 p-0 border-dashed border-slate-300"
            onClick={switchTokens}
            disabled={!fromToken || !toToken}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">To</Label>
            <div className="text-xs text-slate-500">
              Balance: {toToken === 'SEP' ? parseFloat(ethBalance).toFixed(6) : parseFloat(toTokenBalance).toFixed(6)} {getTokenSymbolLocal(toToken)}
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-[140px]">
                <TokenSelector
                  value={toToken}
                  onChange={(value) => {
                    if (value === fromToken) {
                      setFromToken('');
                    }
                    setToToken(value);
                  }}
                  disabled={fromToken ? [fromToken] : []}
                />
              </div>
              
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={toAmount}
                  disabled
                  className="bg-slate-100 text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Swap Information */}
        {fromToken && toToken && fromToken !== toToken && fromAmount && toAmount && pairSupported && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600">Rate</span>
              <span className="font-medium">
                1 {getTokenSymbolLocal(fromToken)} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {getTokenSymbolLocal(toToken)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <span className="text-slate-600">Price Impact</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">The difference between the market price and estimated price due to trade size</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className={`font-medium ${parseFloat(priceImpact) > 1 ? 'text-amber-600' : 'text-slate-700'}`}>
                {priceImpact}%
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-slate-100 pt-4">
        <Button
          className="w-full relative"
          size="lg"
          disabled={!isValidSwap() || swapping || isCheckingPair}
          onClick={handleSwap}
        >
          {swapping ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing transaction...</span>
            </div>
          ) : isCheckingPair ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking pair...</span>
            </div>
          ) : !fromToken || !toToken ? (
            "Select tokens"
          ) : fromToken === toToken ? (
            "Select different tokens"
          ) : !pairSupported ? (
            "No liquidity for this pair"
          ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
            "Enter an amount"
          ) : (
            `Swap ${getTokenSymbolLocal(fromToken)} for ${getTokenSymbolLocal(toToken)}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default Swap;