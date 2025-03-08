import React, { useState, useEffect, useCallback } from 'react';
import { formatEther } from 'viem';
import { 
  ArrowRightLeft, 
  Loader2,
  ArrowUp, 
  ArrowDown,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useWrapSepolia } from '../hooks/useWrapSepolia';
import { useAA } from '../hooks/useAA';
import { 
  Card, 
  CardContent, 
  CardDescription,  
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useWalletClient } from 'wagmi';
import { Hex } from 'viem';
import { AddressMode } from '../contexts/AAContext';
import { WRAPPED_SEPOLIA_ADDRESS } from '../constants/addresses';
import { publicClient } from '../utils/client';

export const WrapToken = ({ 
  isActive,
  activeAddress,
  addressMode,
}: { 
  isActive: boolean;
  activeAddress: Hex;
  addressMode: AddressMode;
}) => {
  const [wrapAmount, setWrapAmount] = useState('');
  const [unwrapAmount, setUnwrapAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [balance, setBalance] = useState('0');
  const [activeTab, setActiveTab] = useState<'wrap' | 'unwrap'>('wrap');
  const [txStatus, setTxStatus] = useState<{status: 'success' | 'error', message: string} | null>(null);
  
  const { aaAddress } = useAA();
  const { data: walletClient } = useWalletClient();

  const {
    deposit: aaDeposit,
    withdraw: aaWithdraw,
    balanceOf
  } = useWrapSepolia(aaAddress);

  // Reset form when address mode changes
  useEffect(() => {
    setWrapAmount('');
    setUnwrapAmount('');
    setTxStatus(null);
    updateBalance();
  }, [addressMode, activeAddress]);

  const updateBalance = useCallback(async () => {
    if (isActive && activeAddress) {
      try {
        let bal;
        if (addressMode === 'aa') {
          bal = await balanceOf();
        } else {
          bal = await publicClient.readContract({
            address: WRAPPED_SEPOLIA_ADDRESS,
            abi: [{
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }]
            }],
            functionName: 'balanceOf',
            args: [activeAddress]
          }) as bigint;
        }
        setBalance(formatEther(bal));
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  }, [isActive, activeAddress, addressMode, balanceOf]);

  useEffect(() => {
    updateBalance();
  }, [updateBalance]);

  // EOAモードでのデポジット
  const eoaDeposit = async (amount: string) => {
    if (!walletClient || !activeAddress) {
      throw new Error('Wallet client not available');
    }

    const tx = await walletClient.writeContract({
      address: WRAPPED_SEPOLIA_ADDRESS,
      abi: [{
        name: 'deposit',
        type: 'function',
        stateMutability: 'payable',
        inputs: [],
        outputs: []
      }],
      functionName: 'deposit',
      value: BigInt(parseFloat(amount) * 10**18)
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    return {
      success: receipt.status === 'success',
      hash: receipt.transactionHash
    };
  };

  // EOAモードでの引き出し
  const eoaWithdraw = async (amount: string) => {
    if (!walletClient || !activeAddress) {
      throw new Error('Wallet client not available');
    }

    const tx = await walletClient.writeContract({
      address: WRAPPED_SEPOLIA_ADDRESS,
      abi: [{
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'wad', type: 'uint256' }],
        outputs: []
      }],
      functionName: 'withdraw',
      args: [BigInt(parseFloat(amount) * 10**18)]
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    return {
      success: receipt.status === 'success',
      hash: receipt.transactionHash
    };
  };

  const handleWrap = async () => {
    if (!wrapAmount || parseFloat(wrapAmount) <= 0) {
      toast.error('Invalid amount', {
        description: 'Please enter a valid amount to wrap'
      });
      return;
    }

    setIsProcessing(true);
    setTxStatus(null);

    try {
      let result;
      
      if (addressMode === 'eoa') {
        result = await eoaDeposit(wrapAmount);
      } else {
        result = await aaDeposit(wrapAmount);
      }
      
      if (result.success) {
        setTxStatus({
          status: 'success',
          message: `Successfully wrapped ${wrapAmount} ETH to WSEP`
        });
        setWrapAmount('');
        await updateBalance();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      setTxStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to wrap ETH'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnwrap = async () => {
    if (!unwrapAmount || parseFloat(unwrapAmount) <= 0) {
      toast.error('Invalid amount', {
        description: 'Please enter a valid amount to unwrap'
      });
      return;
    }

    if (parseFloat(unwrapAmount) > parseFloat(balance)) {
      toast.error('Insufficient balance', {
        description: 'You don\'t have enough WSEP to unwrap'
      });
      return;
    }

    setIsProcessing(true);
    setTxStatus(null);

    try {
      let result;
      
      if (addressMode === 'eoa') {
        result = await eoaWithdraw(unwrapAmount);
      } else {
        result = await aaWithdraw(unwrapAmount);
      }
      
      if (result.success) {
        setTxStatus({
          status: 'success',
          message: `Successfully unwrapped ${unwrapAmount} WSEP to ETH`
        });
        setUnwrapAmount('');
        await updateBalance();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      setTxStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to unwrap WSEP'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isActive) return null;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Wrap/Unwrap ETH</CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            {addressMode === 'aa' && (
              <Badge className="bg-primary text-white">Smart Account Mode</Badge>
            )}
            {addressMode === 'eoa' && (
              <Badge className="bg-slate-700 text-white">EOA Mode</Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-sm text-slate-500 mt-1">
          Convert between ETH and Wrapped Sepolia ETH (WSEP)
        </CardDescription>
      </CardHeader>
      
      <div className="flex border-b border-slate-100">
        <Button
          variant="ghost"
          className={`flex-1 rounded-none border-b-2 ${activeTab === 'wrap' 
            ? 'border-primary text-primary' 
            : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          onClick={() => setActiveTab('wrap')}
        >
          <ArrowDown className="h-4 w-4 mr-2" />
          Wrap ETH
        </Button>
        <Button
          variant="ghost"
          className={`flex-1 rounded-none border-b-2 ${activeTab === 'unwrap' 
            ? 'border-primary text-primary' 
            : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          onClick={() => setActiveTab('unwrap')}
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          Unwrap WSEP
        </Button>
      </div>
      
      <CardContent className="p-6 space-y-4">
        {txStatus && (
          <Alert className={`${txStatus.status === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-start gap-2">
              {txStatus.status === 'success' 
                ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> 
                : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
              <AlertDescription>{txStatus.message}</AlertDescription>
            </div>
          </Alert>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full">
                <span className="text-sm font-medium text-slate-800">Balance: {parseFloat(balance).toFixed(4)} WSEP</span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6 rounded-full p-0 text-slate-500 hover:text-primary hover:bg-slate-200" 
                  onClick={updateBalance}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">Your Wrapped Sepolia ETH balance</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {activeTab === 'wrap' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <ArrowDown className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">Wrap ETH to WSEP</p>
                    <p className="text-sm text-slate-600">Convert native ETH to wrapped ERC-20 token</p>
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-sm">
                        <Info className="h-4 w-4 text-blue-500" />
                        <span className="text-blue-600">Why wrap ETH?</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">Wrapped ETH (WSEP) is an ERC-20 token that represents ETH 1:1, allowing you to use ETH in DeFi applications that require ERC-20 tokens.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="wrapAmount" className="text-sm font-medium">Amount to Wrap</Label>
              <div className="relative">
                <Input
                  id="wrapAmount"
                  type="number"
                  placeholder="0.0"
                  value={wrapAmount}
                  onChange={(e) => setWrapAmount(e.target.value)}
                  className="pr-16"
                  min="0"
                  step="0.0001"
                  disabled={isProcessing}
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <span className="text-slate-500 text-sm font-medium">ETH</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                You will receive {wrapAmount ? parseFloat(wrapAmount).toFixed(4) : '0'} WSEP
              </p>
            </div>
            
            <Button
              onClick={handleWrap}
              disabled={!wrapAmount || isProcessing || parseFloat(wrapAmount) <= 0}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wrapping...
                </>
              ) : (
                <>Wrap ETH to WSEP</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <ArrowUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">Unwrap WSEP to ETH</p>
                    <p className="text-sm text-slate-600">Convert WSEP tokens back to native ETH</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Balance: {parseFloat(balance).toFixed(4)} WSEP
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unwrapAmount" className="text-sm font-medium">Amount to Unwrap</Label>
              <div className="relative">
                <Input
                  id="unwrapAmount"
                  type="number"
                  placeholder="0.0"
                  value={unwrapAmount}
                  onChange={(e) => setUnwrapAmount(e.target.value)}
                  className="pr-16"
                  min="0"
                  max={balance}
                  step="0.0001"
                  disabled={isProcessing}
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <span className="text-slate-500 text-sm font-medium">WSEP</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                You will receive {unwrapAmount ? parseFloat(unwrapAmount).toFixed(4) : '0'} ETH
              </p>
            </div>
            
            <Button
              onClick={handleUnwrap}
              disabled={!unwrapAmount || isProcessing || parseFloat(unwrapAmount) <= 0 || parseFloat(unwrapAmount) > parseFloat(balance)}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unwrapping...
                </>
              ) : (
                <>Unwrap WSEP to ETH</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};