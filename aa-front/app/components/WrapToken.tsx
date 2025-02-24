import React, { useState, useEffect, useCallback } from 'react';
import { formatEther } from 'viem';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWrapSepolia } from '../hooks/useWrapSepolia';
import { useAA } from '../hooks/useAA';

export const WrapToken = ({ 
  isDeployed,
}: { 
  isDeployed: boolean;
}) => {
  const [wrapAmount, setWrapAmount] = useState('');
  const [unwrapAmount, setUnwrapAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [balance, setBalance] = useState('0');

  const { aaAddress } = useAA()

  const {
    deposit,
    withdraw,
    balanceOf
  } = useWrapSepolia(aaAddress);

  const updateBalance = useCallback(async () => {
    if (isDeployed && aaAddress) {
      try {
        const bal = await balanceOf();
        setBalance(formatEther(bal));
      } catch (error) {
        console.log(error)
        toast.error('Failed to update balance', {
          description: 'Please check your network connection'
        });
      }
    }
  }, [isDeployed, aaAddress, balanceOf]);

  useEffect(() => {
    updateBalance();
  }, [updateBalance]);

  const handleWrap = async () => {
    if (!wrapAmount || parseFloat(wrapAmount) <= 0) {
      toast.error('Invalid amount', {
        description: 'Please enter a valid amount to wrap'
      });
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Processing wrap transaction...');

    try {
      const result = await deposit(wrapAmount);
      if (result.success) {
        toast.success('Transaction successful', {
          description: `Successfully wrapped ${wrapAmount} ETH`,
          id: toastId
        });
        setWrapAmount('');
        await updateBalance();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Transaction failed', {
        description: error instanceof Error ? error.message : 'Failed to wrap ETH',
        id: toastId
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
    const toastId = toast.loading('Processing unwrap transaction...');

    try {
      const result = await withdraw(unwrapAmount);
      if (result.success) {
        toast.success('Transaction successful', {
          description: `Successfully unwrapped ${unwrapAmount} WSEP`,
          id: toastId
        });
        setUnwrapAmount('');
        await updateBalance();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Transaction failed', {
        description: error instanceof Error ? error.message : 'Failed to unwrap WSEP',
        id: toastId
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualRefresh = async () => {
    const toastId = toast.loading('Updating balance...');
    await updateBalance();
    toast.success('Balance updated', {
      id: toastId
    });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6" />
              Wrap/Unwrap ETH
            </h2>
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-500">
                WSEP Balance: {parseFloat(balance).toFixed(4)}
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleManualRefresh}
                disabled={isProcessing}
              >
                <Loader2 className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Wrap ETH to WSEP</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount of ETH to wrap"
                  value={wrapAmount}
                  onChange={(e) => setWrapAmount(e.target.value)}
                  min="0"
                  step="0.0001"
                  disabled={isProcessing}
                />
                <Button 
                  onClick={handleWrap}
                  disabled={!wrapAmount || isProcessing}
                  className="min-w-[140px]"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Wrap ETH'
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unwrap WSEP to ETH</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount of WSEP to unwrap"
                  value={unwrapAmount}
                  onChange={(e) => setUnwrapAmount(e.target.value)}
                  min="0"
                  step="0.0001"
                  disabled={isProcessing}
                />
                <Button 
                  onClick={handleUnwrap}
                  disabled={!unwrapAmount || isProcessing || parseFloat(unwrapAmount) > parseFloat(balance)}
                  className="min-w-[140px]"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Unwrap WSEP'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};