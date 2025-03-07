import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { 
  Wallet, 
  Check, 
  Loader2, 
  Send, 
  Layers,
  Coins,
  ArrowRightLeft,
  Shield,
  RefreshCw,
  ExternalLink,
  ArrowDownUp
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { useAA } from '../hooks/useAA';
import { useFetchAABalance } from '../hooks/useFetchAABalance';
import { SendTransaction } from './SendTransaction';
import { WrapToken } from './WrapToken';
import { TokenCreation } from './TokenCreation';
import { Hex } from 'viem';
import { Swap } from './Swap';

export default function AAWallet() {
  const { address, isConnected } = useAccount();
  const { aaAddress, isDeployed, loading, deployAccount } = useAA();
  const [deploying, setDeploying] = useState(false);
  const { balance, isBalanceLoading, fetchBalance } = useFetchAABalance(aaAddress);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await deployAccount();
      fetchBalance();
    } catch (error) {
      console.error('Deploy error:', error);
    } finally {
      setDeploying(false);
    }
  };

  const shortenAddress = (addr: Hex) => {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="text-center max-w-lg space-y-6">
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-full shadow-sm">
              <Shield className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ERC-4337 Smart Account</h1>
          <p className="text-slate-600">
            Experience the next generation of Ethereum accounts with gasless transactions,
            batch operations, and advanced token management.
          </p>
          <div className="flex justify-center mt-4">
            <ConnectButton label="Get Started" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="bg-primary/10 p-2 rounded-full">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Account Dashboard</h1>
        </div>
        <ConnectButton />
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Wallet className="h-5 w-5 text-primary" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <Label className="text-xs font-medium text-slate-500 mb-1 block">EOA Address</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono break-all text-slate-800">
                  {address ? shortenAddress(address) : ''}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0" 
                  onClick={() => address && navigator.clipboard.writeText(address)}
                  title="Copy address"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-slate-500 hover:text-primary">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <Label className="text-xs font-medium text-slate-500 mb-1 block">Smart Account Address</Label>
              {loading ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading address...</span>
                </div>
              ) : aaAddress && aaAddress !== '0x' ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono break-all text-slate-800">{shortenAddress(aaAddress)}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={() => navigator.clipboard.writeText(aaAddress)}
                    title="Copy address"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-slate-500 hover:text-primary">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </Button>
                  <a 
                    href={`https://sepolia.etherscan.io/address/${aaAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                    title="View on Etherscan"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ) : (
                <span className="text-sm text-slate-600">Not yet created</span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
            <div className="flex-1 w-full">
              {!isDeployed ? (
                <Button
                  onClick={handleDeploy}
                  disabled={deploying || isDeployed || loading}
                  size="lg"
                  className="w-full font-medium"
                >
                  {deploying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                      Deploying Smart Account...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" /> 
                      Deploy Smart Account
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-md px-4 py-2 border border-green-200">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Smart Account Deployed</span>
                </div>
              )}
            </div>

            {isDeployed && (
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 w-full sm:w-auto">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Balance</div>
                  <div className="flex items-center gap-2">
                    {isBalanceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    ) : (
                      <span className="font-semibold text-lg">{parseFloat(balance).toFixed(4)}</span>
                    )}
                    <span className="text-slate-600">ETH</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={fetchBalance}
                      title="Refresh balance"
                    >
                      <RefreshCw className="h-3 w-3 text-slate-500 hover:text-primary" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isDeployed && (
        <Tabs defaultValue="transactions" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1">
            <TabsTrigger value="transactions" className="data-[state=active]:bg-white">
              <Send className="h-4 w-4 mr-2" />
              <span>Send</span>
            </TabsTrigger>
            <TabsTrigger value="wrap" className="data-[state=active]:bg-white">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              <span>Wrap</span>
            </TabsTrigger>
            <TabsTrigger value="swap" className="data-[state=active]:bg-white">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              <span>Swap</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="data-[state=active]:bg-white">
              <Coins className="h-4 w-4 mr-2" />
              <span>Tokens</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4 mt-6">
            <SendTransaction 
              isDeployed={isDeployed} 
              onTransactionComplete={fetchBalance} 
            />
          </TabsContent>

          <TabsContent value="wrap" className="space-y-4 mt-6">
            <WrapToken isDeployed={isDeployed} />
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-6">
            <TokenCreation isDeployed={isDeployed} />
          </TabsContent>

          <TabsContent value="swap" className="space-y-4 mt-6">
            <Swap
              isDeployed={isDeployed} 
              onSwapComplete={fetchBalance}
            />
          </TabsContent>
        </Tabs>
      )}

      {!isDeployed && (
        <Card className="bg-slate-50 border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-6">
              <div className="bg-slate-100 p-3 rounded-full">
                <Layers className="h-10 w-10 text-slate-400" />
              </div>
              <CardTitle className="text-xl font-semibold text-slate-700">Features Awaiting</CardTitle>
              <CardDescription className="max-w-md text-slate-600">
                Deploy your smart account to unlock advanced features like sending transactions, creating tokens,
                and managing assets with ERC-4337 account abstraction.
              </CardDescription>
              <Button
                onClick={handleDeploy}
                disabled={deploying || loading}
                className="mt-2"
              >
                {deploying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    <span>Deploy Now</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}