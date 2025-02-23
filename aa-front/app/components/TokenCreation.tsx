// components/TokenCreation.tsx
import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus } from 'lucide-react';
import { encodeFunctionData } from 'viem';
import { tokenCreationFactoryAbi } from '../abi/tokenCreationFactory';
import { TOKEN_CREATION_FACTORY_ADDRESS } from '../constants/addresses';
import { SimpleAccountABI } from '../abi/simpleAccount';
import useUserOperation from '../hooks/useUserOperation';
import { usePaymasterData } from '../hooks/usePaymasterData';
import { useExecuteUserOperation } from '../hooks/useExecuteUserOperation';
import { useAA } from '../hooks/useAA';
import { bundlerClient } from '../utils/client';

export const TokenCreation = () => {
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [tokenSupply, setTokenSupply] = useState<string>('');
  const [isCreatingToken, setIsCreatingToken] = useState(false);

  const { createUserOperation } = useUserOperation()
  const { getPaymasterAndData } = usePaymasterData()
  const { execute } = useExecuteUserOperation()
  const { aaAddress } = useAA()

  const handleCreateToken = async () => {
    setIsCreatingToken(true);
    try {
      // executeに渡すfuncは呼び出すメソッドと引数をエンコードしたデータ（calldata）
      const func = encodeFunctionData({
          abi: tokenCreationFactoryAbi,
          functionName: 'createToken',
          args: [tokenName, tokenSymbol, tokenSupply]
        })

      // createTokenを実行するためのcallDataを生成
      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [TOKEN_CREATION_FACTORY_ADDRESS, '0x0', func]
      })

      // ウォレットアドレスと実行データのcallDataをもとにUserOpを作成
      const userOp = await createUserOperation({ aaAddress, callData })
      // 作成したUserOpをもとにPaymasterDataを作成
      const paymasterAndData = await getPaymasterAndData(userOp)
      userOp.paymasterAndData = paymasterAndData
      console.log(userOp)

      console.log({
        tokenName,
        tokenSymbol,
        tokenSupply,
        TOKEN_CREATION_FACTORY_ADDRESS,
        encodedFunc: func,
        encodedCallData: callData
      });

      // UserOpの実行
      const userOpHash = await execute(userOp)
      const transactionHash = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
      console.log(transactionHash)
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