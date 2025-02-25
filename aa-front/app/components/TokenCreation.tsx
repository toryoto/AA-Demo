import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, Plus } from 'lucide-react';
import { encodeFunctionData, parseEther } from 'viem';
import { tokenCreationFactoryAbi } from '../abi/tokenCreationFactory';
import { TOKEN_CREATION_FACTORY_ADDRESS } from '../constants/addresses';
import { SimpleAccountABI } from '../abi/simpleAccount';
import useUserOperation from '../hooks/useUserOperation';
import { usePaymasterData } from '../hooks/usePaymasterData';
import { useExecuteUserOperation } from '../hooks/useExecuteUserOperation';
import { useAA } from '../hooks/useAA';
import { bundlerClient, publicClient } from '../utils/client';
import { TokenList } from './TokenList';
import { useTokenContract } from '../hooks/useTokenContract';
import { toast } from 'sonner';

export const TokenCreation = ({isDeployed}: {isDeployed: boolean}) => {
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [tokenSupply, setTokenSupply] = useState<string>('');
  const [isCreatingToken, setIsCreatingToken] = useState(false);

  const { createUserOperation } = useUserOperation();
  const { getPaymasterAndData } = usePaymasterData();
  const { execute } = useExecuteUserOperation();
  const { aaAddress } = useAA();
  const { getUserTokens } = useTokenContract(publicClient, aaAddress);

  const handleCreateToken = async () => {
    setIsCreatingToken(true);
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

      const userOp = await createUserOperation({ aaAddress, callData });
      const paymasterAndData = await getPaymasterAndData(userOp);
      userOp.paymasterAndData = paymasterAndData;

      const userOpHash = await execute(userOp);
      toast.loading('Waiting for confirmation...', {
        id: toastId
      });

      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
      
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

        await getUserTokens();
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
    } finally {
      setIsCreatingToken(false);
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
                disabled={!tokenName || !tokenSymbol || !tokenSupply || isCreatingToken}
              >
                {isCreatingToken ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </div>
                ) : (
                  'Create Token'
                )}
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