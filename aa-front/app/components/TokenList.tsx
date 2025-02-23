import React, { useEffect, useCallback, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Coins, ArrowUpRight, ArrowRight, Loader2 } from 'lucide-react';
import { formatEther, Hex, PublicClient } from 'viem';
import { useTokenContract } from '../hooks/useTokenContract';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface TokenListProps {
  aaAddress: Hex;
  publicClient: PublicClient;
  isDeployed: boolean;
}

interface TransferInput {
  tokenAddress: string;
  recipient: string;
  amount: string;
}

export const TokenList: React.FC<TokenListProps> = ({ 
  aaAddress,
  publicClient,
  isDeployed
}) => {
  const {
    tokens,
    balances,
    isLoading,
    getUserTokens,
    sendToken
  } = useTokenContract(publicClient, aaAddress);

  const [sending, setSending] = useState(false);
  const [transferInput, setTransferInput] = useState<TransferInput>({
    tokenAddress: '',
    recipient: '',
    amount: ''
  });

  useEffect(() => {
    if (aaAddress && aaAddress !== '0x') {
      getUserTokens();
    }
  }, [aaAddress]);

  const shortenAddress = useCallback((address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const formatTimestamp = useCallback((timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const handleSend = async () => {
    setSending(true);
    try {
      await sendToken(
        transferInput.tokenAddress,
        transferInput.recipient,
        transferInput.amount
      );
      await getUserTokens();
      
      // フォームをリセット
      setTransferInput({
        tokenAddress: '',
        recipient: '',
        amount: ''
      });
      
      console.log('Token transfer successful!');
    } catch (error) {
      console.error('Token transfer failed:', error);
    } finally {
      setSending(false);
    }
  };

  const getSelectedTokenSymbol = () => {
    const token = tokens.find(t => t.tokenAddress === transferInput.tokenAddress);
    return token?.symbol || '';
  };

  const getSelectedTokenBalance = () => {
    const index = tokens.findIndex(t => t.tokenAddress === transferInput.tokenAddress);
    if (index === -1) return '0';
    return balances[index] ? formatEther(balances[index].balance) : '0';
  };

  const isValid = 
    transferInput.tokenAddress !== '' && 
    transferInput.recipient.length > 3 && 
    transferInput.amount && 
    parseFloat(transferInput.amount) > 0 &&
    parseFloat(transferInput.amount) <= parseFloat(getSelectedTokenBalance());

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6" />
            Your Tokens
          </h2>

          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No tokens created yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token, index) => (
                  <TableRow key={token.tokenAddress} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell>{token.symbol}</TableCell>
                    <TableCell>
                      {balances[index] ? 
                        formatEther(balances[index].balance) : '0'} {token.symbol}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://sepolia.etherscan.io/address/${token.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
                      >
                        {shortenAddress(token.tokenAddress)}
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(token.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {isDeployed && tokens.length > 0 && (
            <div className="pt-4 border-t space-y-4">
              <h3 className="text-lg font-semibold">Send Tokens</h3>
              
              <div className="space-y-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <Label htmlFor="token">Select Token</Label>
                  <Select
                    value={transferInput.tokenAddress}
                    onValueChange={(value) => 
                      setTransferInput(prev => ({ ...prev, tokenAddress: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a token" />
                    </SelectTrigger>
                    <SelectContent>
                      {tokens.map((token, index) => (
                        <SelectItem 
                          key={token.tokenAddress} 
                          value={token.tokenAddress}
                          disabled={!balances[index] || balances[index].balance === BigInt(0)}
                        >
                          {token.symbol} ({balances[index] ? 
                            formatEther(balances[index].balance) : '0'} available)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="recipient">Recipient Address</Label>
                  <Input
                    id="recipient"
                    value={transferInput.recipient}
                    onChange={(e) => 
                      setTransferInput(prev => ({ ...prev, recipient: e.target.value }))
                    }
                    placeholder="0x..."
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      value={transferInput.amount}
                      onChange={(e) => 
                        setTransferInput(prev => ({ ...prev, amount: e.target.value }))
                      }
                      placeholder="0.0"
                      step="0.0001"
                    />
                    {transferInput.tokenAddress && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        {getSelectedTokenSymbol()}
                      </div>
                    )}
                  </div>
                  {transferInput.tokenAddress && (
                    <p className="text-sm text-gray-500 mt-1">
                      Available: {getSelectedTokenBalance()} {getSelectedTokenSymbol()}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sending || !isValid}
                  className="w-full"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending {getSelectedTokenSymbol()}...</>
                  ) : (
                    <>
                      Send {getSelectedTokenSymbol() || 'Tokens'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};