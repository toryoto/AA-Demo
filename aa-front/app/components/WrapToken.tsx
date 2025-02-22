// components/TokenOperations.tsx
import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowRightLeft } from 'lucide-react';

export const WrapToken = ({ isDeployed }: { isDeployed: boolean }) => {
  const [wrapAmount, setWrapAmount] = useState('');
  const [unwrapAmount, setUnwrapAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(false);

  const handleWrap = async () => {
    setIsWrapping(true);
    try {
      console.log('Wrapping', wrapAmount, 'ETH');
    } catch (error) {
      console.error('Wrap error:', error);
    } finally {
      setIsWrapping(false);
    }
  };

  const handleUnwrap = async () => {
    setIsWrapping(true);
    try {
      console.log('Unwrapping', unwrapAmount, 'WETH');
    } catch (error) {
      console.error('Unwrap error:', error);
    } finally {
      setIsWrapping(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6" />
            Wrap/Unwrap ETH
          </h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Wrap ETH to WETH</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount of ETH to wrap"
                  value={wrapAmount}
                  onChange={(e) => setWrapAmount(e.target.value)}
                />
                <Button 
                  onClick={handleWrap}
                  disabled={!wrapAmount || isWrapping}
                >
                  Wrap ETH
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unwrap WETH to ETH</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount of WETH to unwrap"
                  value={unwrapAmount}
                  onChange={(e) => setUnwrapAmount(e.target.value)}
                />
                <Button 
                  onClick={handleUnwrap}
                  disabled={!unwrapAmount || isWrapping}
                >
                  Unwrap WETH
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};