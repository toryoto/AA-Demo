'use client'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  concat, 
  encodeFunctionData, 
  getContract,
  Hex,
} from 'viem'
import { accountFactoryAbi } from '../abi/accountFactory'
import { FACTORY_ADDRESS } from '../constants/addresses'
import { publicClient } from '../utils/client'
import { usePaymasterData } from '../hooks/usePaymasterData'
import useUserOperation from '../hooks/useUserOperation'
import { useExecuteUserOperation } from '../hooks/useExecuteUserOperation'
import { useFetchAABalance } from '../hooks/useFetchAABalance'
import { Card, CardContent } from './ui/card'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Wallet, Check, Loader2 } from 'lucide-react'
import { SendTransaction } from './SendTransaction'

export default function AAWallet() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [aaAddress, setAaAddress] = useState<Hex>('0x')
  const [isDeployed, setIsDeployed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const { getPaymasterAndData } = usePaymasterData();
  const { createUserOperation } = useUserOperation();
  const { execute } = useExecuteUserOperation();
  const { balance, isBalanceLoading } = useFetchAABalance(aaAddress);

  useEffect(() => {
    const initializeAA = async () => {
      if (!walletClient || !address) return
      
      setLoading(true)
      try {
        const factory = getContract({
          address: FACTORY_ADDRESS,
          abi: accountFactoryAbi,
          client: publicClient
        })

        const salt = 0
        const predictedAddress = await factory.read.getAddress([address, BigInt(salt)]) as Hex

        setAaAddress(predictedAddress)
        
        const code = await publicClient.getCode({ address: predictedAddress })
        setIsDeployed(Boolean(code?.length))
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAA()
  }, [walletClient, address])

  const deployAccount = async () => {
    if (!address || !walletClient || !aaAddress) return
    setDeploying(true)
    try {
      const initCode = concat([
        FACTORY_ADDRESS,
        encodeFunctionData({
          abi: accountFactoryAbi,
          functionName: 'createAccount',
          args: [address, 0]
        })
      ])
      const userOperation = await createUserOperation(aaAddress, initCode)

      const paymasterAndData = await getPaymasterAndData(userOperation)
      userOperation.paymasterAndData = paymasterAndData
      console.log(userOperation.paymasterAndData)

      const userOpHash = await execute(userOperation)
      console.log('UserOperation Hash:', userOpHash)

      setIsDeployed(true)
    } catch (error) {
      console.error('Deploy error:', error)
    } finally {
      setDeploying(false)
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-end">
        <ConnectButton />
      </div>

      {address && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Wallet className="h-6 w-6" />
                Account Info
              </h2>
              
              <div className="grid gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <Label className="text-sm text-gray-500">EOA Address</Label>
                  <p className="font-mono text-sm break-all">{address}</p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <Label className="text-sm text-gray-500">Smart Account Address</Label>
                  <p className="font-mono text-sm break-all">
                    {loading ? 'Loading...' : aaAddress || 'Not created'}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Button
                      onClick={deployAccount}
                      disabled={deploying || isDeployed || loading}
                      variant={isDeployed ? "secondary" : "default"}
                      className={`w-full ${isDeployed ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}`}
                    >
                      {isDeployed ? (
                        <><Check className="h-4 w-4 mr-2" /> Deployed</>
                      ) : deploying ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deploying...</>
                      ) : (
                        <>Deploy via Bundler</>
                      )}
                    </Button>
                  </div>

                  {isDeployed && !isBalanceLoading && (
                    <div className="bg-gray-50 px-4 py-2 rounded-lg">
                      <Label className="text-sm text-gray-500">Balance</Label>
                      <p className="font-medium">{balance} ETH</p>
                    </div>
                  )}
                </div>
              </div>

              {isDeployed && (
                <SendTransaction isDeployed={isDeployed} />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}