import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus } from 'lucide-react';
import { encodeFunctionData, parseEther } from 'viem';
import { tokenCreationFactoryAbi } from '../abi/tokenCreationFactory';
import { TOKEN_CREATION_FACTORY_ADDRESS } from '../constants/addresses';
import { SimpleAccountABI } from '../abi/simpleAccount';
import { useAA } from '../hooks/useAA';
import { publicClient } from '../utils/client';
import { TokenList } from './TokenList';
import { useTokenManagement } from '../hooks/useTokenManagement';
import { toast } from 'sonner';
import { useUserOperationExecutor } from '../hooks/useUserOpExecutor';

export const TokenCreation = ({isDeployed}: {isDeployed: boolean}) => {
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [tokenSupply, setTokenSupply] = useState<string>('');

  const { aaAddress } = useAA();
  const { executeCallData } = useUserOperationExecutor(aaAddress);
  
  const { updateTokenBalances } = useTokenManagement(publicClient, aaAddress);

  const handleCreateToken = async () => {
    const toastId = toast.loading('Creating your token...', {
      description: `${tokenName} (${tokenSymbol})`
    });

    try {
      const func = encodeFunctionData({
        abi: tokenCreationFactoryAbi,
        functionName: 'createToken',
        args: [tokenName, tokenSymbol, parseEther(tokenSupply)]
      });

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [TOKEN_CREATION_FACTORY_ADDRESS, '0x0', func]
      });

      const { receipt } = await executeCallData(callData)
      
      if (receipt.success) {
        toast.success('Token created successfully', {
          id: toastId,
          description: (
            <div className="space-y-1">
              <p>Name: {tokenName}</p>
              <p>Symbol: {tokenSymbol}</p>
              <p>Supply: {tokenSupply}</p>
            </div>
          )
        });

        await updateTokenBalances();
        
        setTokenName('');
        setTokenSymbol('');
        setTokenSupply('');
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Token creation error:', error);
      toast.error('Failed to create token', {
        id: toastId,
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  return (
    <>
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
                disabled={!tokenName || !tokenSymbol || !tokenSupply}
              >
                Create Token
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TokenList 
        aaAddress={aaAddress}
        publicClient={publicClient}
        isDeployed={isDeployed}
      />
    </>
  );
};