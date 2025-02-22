// components/TokenCreation.tsx
import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus } from 'lucide-react';

export const TokenCreation = ({ isDeployed }: { isDeployed: boolean }) => {
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenSupply, setTokenSupply] = useState('');
  const [isCreatingToken, setIsCreatingToken] = useState(false);

  const handleCreateToken = async () => {
    setIsCreatingToken(true);
    try {
      console.log('Creating token:', {
        name: tokenName,
        symbol: tokenSymbol,
        supply: tokenSupply
      });
    } catch (error) {
      console.error('Token creation error:', error);
    } finally {
      setIsCreatingToken(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Plus className="h-6 w-6" />
            Create New Token
          </h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Token Name</Label>
              <Input
                placeholder="e.g. My Token"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Token Symbol</Label>
              <Input
                placeholder="e.g. MTK"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Initial Supply</Label>
              <Input
                type="number"
                placeholder="e.g. 1000000"
                value={tokenSupply}
                onChange={(e) => setTokenSupply(e.target.value)}
              />
            </div>

            <Button 
              className="w-full"
              onClick={handleCreateToken}
              disabled={!tokenName || !tokenSymbol || !tokenSupply || isCreatingToken}
            >
              Create Token
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};