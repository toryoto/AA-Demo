import React, { useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Coins, ArrowUpRight } from 'lucide-react';
import { formatEther, PublicClient } from 'viem';
import { useTokenContract } from '../hooks/useTokenContract';

interface TokenListProps {
  aaAddress: string;
  publicClient: PublicClient;
}

export const TokenList: React.FC<TokenListProps> = ({ 
  aaAddress,
  publicClient,
}) => {
  const {
    tokens,
    balances,
    isLoading,
    getUserTokens
  } = useTokenContract(publicClient, aaAddress);

  useEffect(() => {
    console.log('TokenList useEffect triggered');
    if (aaAddress && aaAddress !== '0x') {
      getUserTokens();
    }
  }, [aaAddress]);

  const shortenAddress = useCallback((address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  // タイムスタンプを読みやすい形式に変換するメソッド
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
        </div>
      </CardContent>
    </Card>
  );
};