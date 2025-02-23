import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Coins, ArrowUpRight } from 'lucide-react';
import { formatEther, Hex, PublicClient } from 'viem';

// TokenInfo型の定義
interface TokenInfo {
  tokenAddress: string;
  name: string;
  symbol: string;
  initialSupply: bigint;
  timestamp: number;
}

interface TokenBalance {
  address: string;
  balance: bigint;
}

export const TokenList = ({ 
  aaAddress,
  publicClient,
  tokenCreationFactoryContract
}: { 
  aaAddress: Hex;
  publicClient: PublicClient;
  tokenCreationFactoryContract: any;
}) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // トークン残高を取得する関数
  const getTokenBalance = async (tokenAddress: string): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: 'balance', type: 'uint256' }]
        }],
        functionName: 'balanceOf',
        args: [aaAddress]
      });
      return balance as bigint;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return BigInt(0);
    }
  };

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setIsLoading(true);
        // ユーザーのトークン一覧を取得
        const userTokens = await tokenCreationFactoryContract.getUserTokens(aaAddress);
        setTokens(userTokens);

        // 各トークンの残高を取得
        const balancePromises = userTokens.map(async (token: TokenInfo) => {
          const balance = await getTokenBalance(token.tokenAddress);
          return { address: token.tokenAddress, balance };
        });
        const tokenBalances = await Promise.all(balancePromises);
        setBalances(tokenBalances);
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (aaAddress) {
      fetchTokens();
    }
  }, [aaAddress, tokenCreationFactoryContract, publicClient]);

  // アドレスを省略して表示する関数
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // タイムスタンプを読みやすい形式に変換する関数
  // const formatTimestamp = (timestamp: number) => {
  //   const date = new Date(timestamp * 1000);
  //   return date.toLocaleDateString('ja-JP', {
  //     year: 'numeric',
  //     month: 'short',
  //     day: 'numeric',
  //     hour: '2-digit',
  //     minute: '2-digit'
  //   });
  // };

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
                    {/* <TableCell>
                      {formatTimestamp(token.timestamp)}
                    </TableCell> */}
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