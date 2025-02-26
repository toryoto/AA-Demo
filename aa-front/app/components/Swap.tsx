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
  DAI_ADDRESS, 
  USDC_ADDRESS, 
  JPYC_ADDRESS, 
  WRAPPED_SEPOLIA_ADDRESS 
} from '../constants/addresses';
import Image from 'next/image';
import { TOKEN_OPTIONS } from '../constants/tokenList';

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
  
  // Reset state when tokens are changed
  useEffect(() => {
    setFromAmount('');
    setToAmount('');
    setSwapStatus({ status: null, message: '' });
    
    // Simulate price quote
    if (fromToken && toToken && fromToken !== toToken) {
      setPriceImpact((Math.random() * 1.5).toFixed(2));
    }
  }, [fromToken, toToken]);

  // Simulate price calculation when fromAmount changes
  useEffect(() => {
    if (fromAmount && fromToken && toToken && fromToken !== toToken) {
      // Simple simulation - in real implementation, this would call a price oracle
      const delay = setTimeout(() => {
        let rate: number;
        
        // Different rate based on token pairs
        if (fromToken === 'ETH' && toToken === DAI_ADDRESS) {
          rate = 3000 + Math.random() * 100;
        } else if (fromToken === 'ETH' && toToken === USDC_ADDRESS) {
          rate = 3000 + Math.random() * 100;
        } else if (fromToken === 'ETH' && toToken === JPYC_ADDRESS) {
          rate = 450000 + Math.random() * 5000;
        } else if (fromToken === 'ETH' && toToken === WRAPPED_SEPOLIA_ADDRESS) {
          rate = 1; // 1:1 peg
        } else if (fromToken === WRAPPED_SEPOLIA_ADDRESS && toToken === 'ETH') {
          rate = 1; // 1:1 peg
        } else if (fromToken === DAI_ADDRESS && toToken === USDC_ADDRESS) {
          rate = 0.99 + Math.random() * 0.02; // Slightly fluctuating around 1
        } else if (fromToken === USDC_ADDRESS && toToken === DAI_ADDRESS) {
          rate = 0.99 + Math.random() * 0.02; // Slightly fluctuating around 1
        } else if (fromToken === JPYC_ADDRESS && toToken === USDC_ADDRESS) {
          rate = 0.0066 + Math.random() * 0.0002;
        } else {
          rate = 1 + Math.random(); // Generic rate for other pairs
        }
        
        const calculatedAmount = parseFloat(fromAmount) * rate;
        setToAmount(calculatedAmount.toFixed(6));
        
        // Set a random price impact between 0.1% and 2%
        const impact = (0.1 + Math.random() * 1.9).toFixed(2);
        setPriceImpact(impact);
      }, 300);
      
      return () => clearTimeout(delay);
    } else {
      setToAmount('');
      setPriceImpact('0.00');
    }
  }, [fromAmount, fromToken, toToken]);

  const switchTokens = () => {
    // Don't switch if one of the tokens is not selected
    if (!fromToken || !toToken) return;
    
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) return;
    
    setSwapping(true);
    setSwapStatus({ status: null, message: '' });
    
    try {
      // Simulate swap transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 80% chance of success for demo purposes
      const isSuccess = Math.random() > 0.2;
      
      if (isSuccess) {
        const fromTokenInfo = TOKEN_OPTIONS.find(t => t.address === fromToken);
        const toTokenInfo = TOKEN_OPTIONS.find(t => t.address === toToken);
        
        setSwapStatus({
          status: 'success',
          message: `Successfully swapped ${fromAmount} ${fromTokenInfo?.symbol} for ${toAmount} ${toTokenInfo?.symbol}`
        });
        
        // Reset form after successful swap
        setFromAmount('');
        setToAmount('');
        
        // Refresh balances
        fetchBalance();
        if (onSwapComplete) onSwapComplete();
      } else {
        throw new Error('Swap failed: Insufficient liquidity');
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

  const getTokenBalance = (tokenAddress: string): string => {
    if (tokenAddress === 'ETH') return ethBalance;
    
    // In a real app, you would fetch these balances from the blockchain
    // For demo purposes, return simulated balances
    switch (tokenAddress) {
      case WRAPPED_SEPOLIA_ADDRESS:
        return '0.5';
      case DAI_ADDRESS:
        return '1500.00';
      case USDC_ADDRESS:
        return '1000.00';
      case JPYC_ADDRESS:
        return '15000.00';
      default:
        return '0';
    }
  };

  const handleMaxButtonClick = () => {
    const maxAmount = getTokenBalance(fromToken);
    // Leave some ETH for gas if ETH is selected
    if (fromToken === 'ETH') {
      const ethBalance = parseFloat(maxAmount);
      const maxEth = Math.max(0, ethBalance - 0.01);
      setFromAmount(maxEth.toFixed(6));
    } else {
      setFromAmount(maxAmount);
    }
  };

  const getTokenSymbol = (tokenAddress: string): string => {
    const token = TOKEN_OPTIONS.find(t => t.address === tokenAddress);
    return token ? token.symbol : tokenAddress.slice(0, 6) + '...' + tokenAddress.slice(-4);
  };

  const isValidSwap = () => {
    if (!fromToken || !toToken || fromToken === toToken) return false;
    if (!fromAmount || parseFloat(fromAmount) <= 0) return false;
    
    // Check if user has enough balance
    const balance = getTokenBalance(fromToken);
    return parseFloat(fromAmount) <= parseFloat(balance);
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
              Balance: {parseFloat(getTokenBalance(fromToken)).toFixed(6)} {getTokenSymbol(fromToken)}
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
              Balance: {parseFloat(getTokenBalance(toToken || '')).toFixed(6)} {getTokenSymbol(toToken || '')}
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
        {fromToken && toToken && fromToken !== toToken && fromAmount && toAmount && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600">Rate</span>
              <span className="font-medium">
                1 {getTokenSymbol(fromToken)} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {getTokenSymbol(toToken)}
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
          disabled={!isValidSwap() || swapping}
          onClick={handleSwap}
        >
          {swapping ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Swapping...</span>
            </div>
          ) : !fromToken || !toToken ? (
            "Select tokens"
          ) : fromToken === toToken ? (
            "Select different tokens"
          ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
            "Enter an amount"
          ) : parseFloat(fromAmount) > parseFloat(getTokenBalance(fromToken)) ? (
            "Insufficient balance"
          ) : (
            `Swap ${getTokenSymbol(fromToken)} for ${getTokenSymbol(toToken)}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default Swap;