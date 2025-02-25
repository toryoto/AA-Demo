import React, { useState, useEffect } from 'react';
import { 
  ArrowDownUp, 
  RefreshCw, 
  Settings, 
  ArrowDown, 
  Info, 
  Loader2, 
  AlertCircle,
  PiggyBank,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { formatEther, parseEther, Hex } from 'viem';
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
import { TokenSelector } from './TokenSelector';
import { useAA } from '../hooks/useAA';
import { useFetchAABalance } from '../hooks/useFetchAABalance';
import { TokenInfo } from '../hooks/useTokenManagement';
import { WRAPPED_SEPOLIA_ADDRESS } from '../constants/addresses';

interface SwapProps {
  isDeployed: boolean;
  userTokens: TokenInfo[];
  onSwapComplete?: () => void;
}

export const Swap: React.FC<SwapProps> = ({ isDeployed, userTokens, onSwapComplete }) => {
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
  const [showNoLiquidityWarning, setShowNoLiquidityWarning] = useState<boolean>(false);
  
  // Reset state when tokens are changed
  useEffect(() => {
    setFromAmount('');
    setToAmount('');
    setSwapStatus({ status: null, message: '' });
    
    // Simulate checking for liquidity
    if (fromToken && toToken && fromToken !== toToken) {
      const timer = setTimeout(() => {
        // In a real implementation, check if there's a liquidity pool for the selected tokens
        const hasLiquidity = Math.random() > 0.3; // Simulate 70% chance of having liquidity
        setShowNoLiquidityWarning(!hasLiquidity);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [fromToken, toToken]);

  // Simulate price calculation when fromAmount changes
  useEffect(() => {
    if (fromAmount && fromToken && toToken && fromToken !== toToken) {
      // Simple simulation - in real implementation, call router contract for quote
      const delay = setTimeout(() => {
        const rate = fromToken === 'ETH' ? 100 + Math.random() * 50 : 0.005 + Math.random() * 0.003;
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
        setSwapStatus({
          status: 'success',
          message: `Successfully swapped ${fromAmount} ${fromToken} for ${toAmount} ${toToken}`
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

  const getMaxBalance = () => {
    if (fromToken === 'ETH') {
      // Leave some ETH for gas
      const maxEth = Math.max(0, parseFloat(ethBalance) - 0.01);
      return maxEth > 0 ? maxEth.toFixed(6) : '0';
    } else {
      const token = userTokens.find(t => t.address === fromToken);
      return token ? token.balance : '0';
    }
  };

  const handleMaxButtonClick = () => {
    const maxAmount = getMaxBalance();
    setFromAmount(maxAmount);
  };

  const getTokenOptions = () => {
    // Start with ETH and WETH
    const options = [
      { value: 'ETH', label: 'ETH' },
      { value: WRAPPED_SEPOLIA_ADDRESS, label: 'WETH' }
    ];
    
    // Add user tokens
    userTokens.forEach(token => {
      options.push({
        value: token.address,
        label: `${token.symbol} - ${token.name}`
      });
    });
    
    return options;
  };

  const getTokenLabel = (value: string) => {
    if (value === 'ETH') return 'ETH';
    if (value === WRAPPED_SEPOLIA_ADDRESS) return 'WETH';
    
    const token = userTokens.find(t => t.address === value);
    return token ? token.symbol : value.slice(0, 6) + '...' + value.slice(-4);
  };

  const getTokenBalance = (tokenValue: string) => {
    if (tokenValue === 'ETH') return ethBalance;
    const token = userTokens.find(t => t.address === tokenValue);
    return token ? token.balance : '0';
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
          Swap between ETH and your custom tokens
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
              Balance: {parseFloat(getTokenBalance(fromToken)).toFixed(6)} {getTokenLabel(fromToken)}
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
                  tokens={userTokens}
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
              Balance: {parseFloat(getTokenBalance(toToken || '')).toFixed(6)} {getTokenLabel(toToken || '')}
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
                  tokens={userTokens}
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
                1 {getTokenLabel(fromToken)} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {getTokenLabel(toToken)}
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

        {/* Liquidity Warning */}
        {showNoLiquidityWarning && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <AlertDescription>
                  <span className="font-medium">Low liquidity detected</span>
                  <p className="text-xs mt-1">
                    This pool has low liquidity, so your swap might have high price impact. Consider adding liquidity first.
                  </p>
                </AlertDescription>
                <Button 
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200"
                >
                  <PiggyBank className="h-3 w-3 mr-1" />
                  Add Liquidity
                </Button>
              </div>
            </div>
          </Alert>
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
            `Swap ${getTokenLabel(fromToken)} for ${getTokenLabel(toToken)}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};