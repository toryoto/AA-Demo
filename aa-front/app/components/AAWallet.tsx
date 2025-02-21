// components/AAWallet.tsx
'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, Check, Loader2 } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { SendTransaction } from './SendTransaction'
import { useAA } from '../hooks/useAA';
import { useFetchAABalance } from '../hooks/useFetchAABalance'

export default function AAWallet() {
  const { address } = useAccount()
  const { aaAddress, isDeployed, loading, deployAccount } = useAA()
  const [deploying, setDeploying] = useState(false)
  const { balance, isBalanceLoading } = useFetchAABalance(aaAddress)

  const handleDeploy = async () => {
    setDeploying(true)
    try {
      await deployAccount()
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
                      onClick={handleDeploy}
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