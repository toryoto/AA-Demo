import React, { useState, useEffect } from 'react';
import { 
  ArrowDownUp, 
  Settings, 
  ArrowDown, 
  Info, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
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
import Image from 'next/image';
import { TOKEN_OPTIONS } from '../constants/tokenList';
import { useSwap } from '../hooks/useSwap'; // Import the custom hook

interface SwapProps {
  isDeployed: boolean;
  onSwapComplete?: () => void;
}

// Token Selector Component
const TokenSelector = ({ 
  value, 
  onChange, 
  disabled = [] 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  disabled?: string[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectToken = (tokenValue: string) => {
    onChange(tokenValue);
    setIsOpen(false);
  };

  const selectedToken = TOKEN_OPTIONS.find(t => t.address === value);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between text-left font-normal"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedToken ? (
          <div className="flex items-center">
            <Image 
              width={24}
              height={24}
              src={selectedToken.logo} 
              alt={selectedToken.symbol} 
              className="w-5 h-5 mr-2 rounded-full"
            />
            {selectedToken.symbol}
          </div>
        ) : (
          "Select token"
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 z-10 mt-1 w-60 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="p-1">
            {TOKEN_OPTIONS.map((option) => (
              <button
                key={option.address}
                className={`
                  w-full flex items-center px-2 py-2 text-sm rounded-md
                  ${value === option.address ? 'bg-slate-100' : 'hover:bg-slate-50'}
                  ${disabled.includes(option.address) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onClick={() => !disabled.includes(option.address) && handleSelectToken(option.address)}
                disabled={disabled.includes(option.address)}
              >
                <Image
                  width={24}
                  height={24}
                  src={option.logo} 
                  alt={option.symbol} 
                  className="w-6 h-6 mr-2 rounded-full"
                />
                <div className="flex flex-col items-start">
                  <div className="font-medium">{option.symbol}</div>
                  <div className="text-xs text-slate-500">{option.name}</div>
                </div>
                {value === option.address && (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const Swap: React.FC<SwapProps> = ({ isDeployed, onSwapComplete }) => {
  const { aaAddress } = useAA();
  const { balance: ethBalance, fetchBalance } = useFetchAABalance(aaAddress);
  
  // Initialize the useSwap hook
  const { 
    swap, 
    getSwapEstimate, 
    isSupportedPair, 
    approveToken, 
    getTokenBalance, 
    getAllowance,
    getTokenSymbol
  } = useSwap(aaAddress);

  const [fromToken, setFromToken] = useState<string>('ETH');
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
  const [tokenApproved, setTokenApproved] = useState<boolean>(false);
  const [isCheckingPair, setIsCheckingPair] = useState<boolean>(false);
  // Add states to store token balances to prevent infinite loops
  const [fromTokenBalance, setFromTokenBalance] = useState<string>('0');
  const [toTokenBalance, setToTokenBalance] = useState<string>('0');
  
  // Fetch token balances when tokens change
  useEffect(() => {
    const updateTokenBalances = async () => {
      if (fromToken) {
        if (fromToken === 'ETH') {
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
        if (toToken === 'ETH') {
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
          const fromTokenAddress = fromToken === 'ETH' ? WRAPPED_SEPOLIA_ADDRESS : fromToken;
          const toTokenAddress = toToken === 'ETH' ? WRAPPED_SEPOLIA_ADDRESS : toToken;
          
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

  // Check token approval when from token and amount change
  useEffect(() => {
    const checkTokenApproval = async () => {
      if (fromToken && fromToken !== 'ETH' && fromAmount && parseFloat(fromAmount) > 0) {
        try {
          const allowance = await getAllowance(fromToken);
          setTokenApproved(parseFloat(allowance) >= parseFloat(fromAmount));
        } catch (error) {
          console.error("Error checking token approval:", error);
          setTokenApproved(false);
        }
      } else if (fromToken === 'ETH') {
        // ETH doesn't need approval
        setTokenApproved(true);
      }
    };
    
    if (fromToken && fromAmount && parseFloat(fromAmount) > 0) {
      checkTokenApproval();
    }
  }, [fromToken, fromAmount]);

  // Get swap estimate when fromAmount changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken && fromToken !== toToken && pairSupported) {
      const getEstimate = async () => {
        try {
          // Handle ETH by using Wrapped ETH address
          const fromTokenAddress = fromToken === 'ETH' ? WRAPPED_SEPOLIA_ADDRESS : fromToken;
          const toTokenAddress = toToken === 'ETH' ? WRAPPED_SEPOLIA_ADDRESS : toToken;
          
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
    // Don't switch if one of the tokens is not selected
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
      // Handle ETH by using Wrapped ETH address
      const fromTokenAddress = fromToken === 'ETH' ? WRAPPED_SEPOLIA_ADDRESS : fromToken;
      const toTokenAddress = toToken === 'ETH' ? WRAPPED_SEPOLIA_ADDRESS : toToken;
      
      // Approve token if necessary (only for non-ETH tokens)
      if (fromToken !== 'ETH' && !tokenApproved) {
        const approvalResult = await approveToken(fromTokenAddress, fromAmount);
        
        if (!approvalResult.success) {
          throw new Error(`Failed to approve token: ${approvalResult.error}`);
        }
        
        setTokenApproved(true);
      }
      
      // Execute swap
      const swapResult = await swap({
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        amount: fromAmount,
        slippage: slippage,
        deadline: 600 // 10 minutes deadline
      });
      
      if (swapResult.success) {
        const fromTokenSymbol = fromToken === 'ETH' ? 'ETH' : await getTokenSymbol(fromTokenAddress);
        const toTokenSymbol = toToken === 'ETH' ? 'ETH' : await getTokenSymbol(toTokenAddress);
        
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
    if (fromToken === 'ETH') {
      const maxEth = Math.max(0, parseFloat(fromTokenBalance) - 0.01);
      setFromAmount(maxEth.toFixed(6));
    } else {
      setFromAmount(fromTokenBalance);
    }
  };

  const getTokenSymbolLocal = (tokenAddress: string): string => {
    if (tokenAddress === 'ETH') return 'ETH';
    
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
        <CardDescription className="text-sm text-slate-500 mt-1">
          Swap between ETH and popular ERC-20 tokens
        </CardDescription>
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
              Balance: {fromToken === 'ETH' ? parseFloat(ethBalance).toFixed(6) : parseFloat(fromTokenBalance).toFixed(6)} {getTokenSymbolLocal(fromToken)}
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
              Balance: <span className="balance-placeholder">0.00</span> {getTokenSymbolLocal(toToken || '')}
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
              <span>Swapping...</span>
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
          ) : fromToken !== 'ETH' && !tokenApproved ? (
            `Approve ${getTokenSymbolLocal(fromToken)} first`
          ) : (
            `Swap ${getTokenSymbolLocal(fromToken)} for ${getTokenSymbolLocal(toToken)}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default Swap;