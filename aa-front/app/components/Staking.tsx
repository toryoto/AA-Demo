import React, { useState, useEffect } from 'react'
import { LIDO_CONTRACT_NAMES, LidoSDK } from '@lidofinance/lido-ethereum-sdk'
import { sepolia } from 'viem/chains'
import { Coins, ArrowRight, Loader2, BarChart3, Bell, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { useAA } from '../hooks/useAA'

interface StakingProps {
  isDeployed: boolean
  onStakeComplete?: () => void
}

export const Staking: React.FC<StakingProps> = ({ isDeployed, onStakeComplete }) => {
  const { aaAddress } = useAA()
  const [amount, setAmount] = useState<string>('')
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('')
  const [isStaking, setIsStaking] = useState(false)
  const [isUnstaking, setIsUnstaking] = useState(false)
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake')
  const [txStatus, setTxStatus] = useState<{ status: 'success' | 'error'; message: string } | null>(
    null
  )

  // State for Lido staking data
  const stakedBalance = '0.0000'
  const rewards = '0.0000'
  const [apr, setApr] = useState<string>('0.00')
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  
  // Initialize Lido SDK and fetch APR
  useEffect(() => {
    const fetchLidoStats = async () => {
      setIsLoadingStats(true)
      try {
        const lidoSDK = new LidoSDK({
          rpcUrls: [`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`],
          chainId: sepolia.id,
        })
        
        const aprValue = await lidoSDK.statistics.apr.getSmaApr({ days: 7 });
        console.log("apr:", aprValue)
        setApr(aprValue.toString())
      } catch (error) {
        console.error('Error fetching Lido stats:', error)
      } finally {
        setIsLoadingStats(false)
      }
    }
    
    fetchLidoStats()
  }, [])

  const handleStake = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    
    setIsStaking(true)
    setTxStatus(null)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setTxStatus({
        status: 'success',
        message: `Successfully staked ${amount} ETH with Lido`
      })
      
      if (onStakeComplete) onStakeComplete()
      setAmount('')
    } catch (error) {
      setTxStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to stake ETH'
      })
    } finally {
      setIsStaking(false)
    }
  }

  const handleUnstake = async () => {
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) return
    
    setIsUnstaking(true)
    setTxStatus(null)
    
    try {
      // Simulate a successful transaction after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setTxStatus({
        status: 'success',
        message: `Unstake request for ${withdrawalAmount} stETH has been submitted`
      })
      
      if (onStakeComplete) onStakeComplete()
      setWithdrawalAmount('')
    } catch (error) {
      setTxStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to unstake ETH'
      })
    } finally {
      setIsUnstaking(false)
    }
  }

  if (!isDeployed) return null

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Lido Staking</CardTitle>
          </div>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
            {isLoadingStats ? (
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading APR...</span>
              </div>
            ) : (
              <>{apr}% APR</>
            )}
          </Badge>
        </div>
        <CardDescription className="text-sm text-slate-500 mt-1">
          Stake your ETH with Lido on Sepolia testnet
        </CardDescription>
      </CardHeader>

      <div className="flex border-b border-slate-100">
        <Button
          variant="ghost"
          className={`flex-1 rounded-none border-b-2 ${
            activeTab === 'stake'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => {
            setActiveTab('stake')
            setTxStatus(null)
          }}
        >
          <Coins className="h-4 w-4 mr-2" />
          Stake ETH
        </Button>
        <Button
          variant="ghost"
          className={`flex-1 rounded-none border-b-2 ${
            activeTab === 'unstake'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => {
            setActiveTab('unstake')
            setTxStatus(null)
          }}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Unstake stETH
        </Button>
      </div>

      <CardContent className="p-6 space-y-4">
        {txStatus && (
          <Alert
            className={`${txStatus.status === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}
          >
            <div className="flex items-start gap-2">
              {txStatus.status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              )}
              <AlertDescription>{txStatus.message}</AlertDescription>
            </div>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-500 mb-1">Total Staked</p>
            <p className="text-lg font-semibold">{stakedBalance} stETH</p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <p className="text-xs text-green-500 mb-1">Current APR</p>
            {isLoadingStats ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                <p className="text-sm text-green-600">Fetching from Lido...</p>
              </div>
            ) : (
              <p className="text-lg font-semibold">{apr}%</p>
            )}
          </div>
          
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-xs text-purple-500 mb-1">Earned Rewards</p>
            <p className="text-lg font-semibold">{rewards} stETH</p>
          </div>
        </div>

        {activeTab === 'stake' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-800">Liquid Staking</p>
                  <p className="text-sm text-slate-600">
                    Receive stETH tokens while your ETH is being staked
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stakeAmount" className="text-sm font-medium">
                Amount to Stake
              </Label>
              <div className="relative">
                <Input
                  id="stakeAmount"
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pr-16"
                  min="0"
                  step="0.001"
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <span className="text-slate-500 text-sm font-medium">ETH</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                You will receive {amount ? parseFloat(amount).toFixed(4) : '0'} stETH tokens
              </p>
            </div>

            <Button
              onClick={handleStake}
              disabled={!amount || parseFloat(amount) <= 0 || isStaking}
              className="w-full"
              size="lg"
            >
              {isStaking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Staking...
                </>
              ) : (
                <>
                  Stake ETH with Lido
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-full">
                  <Bell className="h-5 w-5 text-amber-600" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-800">Withdrawal Process</p>
                  <p className="text-sm text-slate-600">
                    Withdrawals can take up to 3-5 days to process
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unstakeAmount" className="text-sm font-medium">
                Amount to Unstake
              </Label>
              <div className="relative">
                <Input
                  id="unstakeAmount"
                  type="number"
                  placeholder="0.0"
                  value={withdrawalAmount}
                  onChange={e => setWithdrawalAmount(e.target.value)}
                  className="pr-16"
                  min="0"
                  step="0.001"
                  max={stakedBalance}
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <span className="text-slate-500 text-sm font-medium">stETH</span>
                </div>
              </div>
              
              <div className="text-xs text-slate-500 flex justify-between">
                <span>Available: {stakedBalance} stETH</span>
                <button 
                  className="text-primary hover:underline" 
                  onClick={() => setWithdrawalAmount(stakedBalance)}
                >
                  Max
                </button>
              </div>
            </div>

            <Tabs defaultValue="request" className="w-full space-y-2">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1">
                <TabsTrigger value="request" className="data-[state=active]:bg-white">
                  <span>Request Withdrawal</span>
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="data-[state=active]:bg-white">
                  <span>Complete Withdrawal</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="request" className="space-y-4">
                <div className="text-sm text-slate-600 p-3 bg-slate-50 rounded border border-slate-200">
                  Step 1: Request withdrawal to get an NFT representing your position
                </div>
                
                <Button
                  onClick={handleUnstake}
                  disabled={!withdrawalAmount || parseFloat(withdrawalAmount) <= 0 || isUnstaking}
                  className="w-full"
                  size="lg"
                >
                  {isUnstaking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Request Withdrawal
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="withdraw" className="space-y-4">
                <div className="text-sm text-slate-600 p-3 bg-slate-50 rounded border border-slate-200">
                  Step 2: Complete withdrawal after the request is finalized (3-5 days)
                </div>
                
                <Button
                  disabled={true}
                  className="w-full"
                  size="lg"
                >
                  No Withdrawals Available
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default Staking