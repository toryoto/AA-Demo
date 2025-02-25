import React, { useEffect, useCallback, useState } from 'react';
import { 
  Coins, 
  ArrowUpRight, 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Send
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { formatEther, Hex, PublicClient, isAddress } from 'viem';
import { useTokenContract } from '../hooks/useTokenContract';
import { useImportedTokens } from '../hooks/useImportedToken';
import { toast } from 'sonner';

interface TokenListProps {
  aaAddress: Hex;
  publicClient: PublicClient;
  isDeployed: boolean;
}

export const TokenList: React.FC<TokenListProps> = ({ 
  aaAddress,
  publicClient,
}) => {
  const {
    tokens,
    balances,
    isLoading,
    getUserTokens,
    sendToken
  } = useTokenContract(publicClient, aaAddress);

  const {
    importedTokens,
    importToken,
    removeToken
  } = useImportedTokens(publicClient, aaAddress);

  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // トークン送金用の状態
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [txStatus, setTxStatus] = useState<{status: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    if (aaAddress && aaAddress !== '0x') {
      getUserTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aaAddress]);

  // 作成したトークンとインポートしたトークンを結合
  const allTokens = React.useMemo(() => {
    const createdTokenAddresses = new Set(tokens.map(t => t.tokenAddress.toLowerCase()));
    
    const importedTokenInfos = importedTokens
      .filter(t => !createdTokenAddresses.has(t.address.toLowerCase()))
      .map(t => ({
        tokenAddress: t.address,
        name: t.name,
        symbol: t.symbol,
        initialSupply: BigInt(0),
        timestamp: BigInt(0)
      }));

    return [...tokens, ...importedTokenInfos];
  }, [tokens, importedTokens]);

  // 検索フィルター
  const filteredTokens = React.useMemo(() => {
    if (!searchTerm) return allTokens;
    
    const term = searchTerm.toLowerCase();
    return allTokens.filter(token => 
      token.name.toLowerCase().includes(term) ||
      token.symbol.toLowerCase().includes(term) ||
      token.tokenAddress.toLowerCase().includes(term)
    );
  }, [allTokens, searchTerm]);

  const handleImport = async () => {
    if (!isAddress(newTokenAddress)) {
      setImportError('Invalid address format');
      return;
    }

    setImporting(true);
    setImportError('');

    try {
      const success = await importToken(newTokenAddress);
      if (success) {
        setNewTokenAddress('');
        toast.success('Token imported successfully');
      } else {
        setImportError('Token already imported or invalid token contract');
      }
    } catch (error) {
      console.error(error);
      setImportError('Failed to import token');
    } finally {
      setImporting(false);
    }
  };

  const shortenAddress = useCallback((address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const formatTimestamp = useCallback((timestamp: bigint) => {
    if (timestamp === BigInt(0)) return '-';
    
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const handleSendToken = async () => {
    if (!selectedToken || !recipient || !amount) return;
    
    setSending(true);
    setTxStatus(null);
    
    try {
      await sendToken(
        selectedToken,
        recipient,
        amount
      );
      
      const selectedTokenInfo = allTokens.find(t => t.tokenAddress === selectedToken);
      
      setTxStatus({
        status: 'success',
        message: `Successfully sent ${amount} ${selectedTokenInfo?.symbol || ''} to ${shortenAddress(recipient)}`
      });
      
      await getUserTokens();
      
      setTimeout(() => {
        resetForm();
      }, 3000);
      
    } catch (error) {
      console.error('Token transfer failed:', error);
      setTxStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setSending(false);
    }
  };

  const getSelectedTokenSymbol = () => {
    if (!selectedToken) return '';
    const token = allTokens.find(t => t.tokenAddress === selectedToken);
    return token?.symbol || '';
  };

  const getSelectedTokenBalance = () => {
    if (!selectedToken) return '0';
    const balance = balances.find(b => 
      b.address.toLowerCase() === selectedToken.toLowerCase()
    )?.balance;
    return balance ? formatEther(balance) : '0';
  };

  const selectToken = (tokenAddress: string) => {
    setSelectedToken(tokenAddress);
    setTxStatus(null);
  };

  const resetForm = () => {
    setSelectedToken(null);
    setRecipient('');
    setAmount('');
    setTxStatus(null);
  };

  const isValid = 
    selectedToken !== null && 
    recipient.length > 3 && 
    amount && 
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(getSelectedTokenBalance());

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Your Tokens</CardTitle>
          </div>
          <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200">
            {allTokens.length} Token{allTokens.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <CardDescription className="text-sm text-slate-500 mt-1">
          Manage and transfer your ERC-20 tokens
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, symbol or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={getUserTokens}
              className="whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <div className="flex-1 md:w-auto">
              <div className="relative flex items-center">
                <Input
                  placeholder="Import token (0x...)"
                  value={newTokenAddress}
                  onChange={(e) => {
                    setNewTokenAddress(e.target.value);
                    setImportError('');
                  }}
                  className="pr-20"
                  disabled={importing}
                />
                <Button
                  onClick={handleImport}
                  disabled={importing || !newTokenAddress}
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Import
                    </>
                  )}
                </Button>
              </div>
              {importError && (
                <p className="text-xs text-red-500 mt-1">{importError}</p>
              )}
            </div>
          </div>
        </div>

        {selectedToken && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Send className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Send {getSelectedTokenSymbol()}</h3>
              <Badge className="ml-auto">
                Balance: {parseFloat(getSelectedTokenBalance()).toFixed(4)} {getSelectedTokenSymbol()}
              </Badge>
            </div>
            
            {txStatus && (
              <Alert className={`mb-4 ${txStatus.status === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div className="flex items-start gap-2">
                  {txStatus.status === 'success' 
                    ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> 
                    : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                  <AlertDescription>{txStatus.message}</AlertDescription>
                </div>
              </Alert>
            )}
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipient" className="text-sm font-medium">Recipient Address</Label>
                <Input
                  id="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="font-mono"
                  disabled={sending}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
                </div>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.0001"
                    className="pr-16"
                    disabled={sending}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <span className="text-sm text-slate-500 font-medium">
                      {getSelectedTokenSymbol()}
                    </span>
                  </div>
                </div>
                
                {parseFloat(amount || '0') > parseFloat(getSelectedTokenBalance()) && (
                  <p className="text-xs text-red-500">
                    Insufficient balance
                  </p>
                )}
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setAmount(getSelectedTokenBalance());
                    }}
                    disabled={sending}
                  >
                    Max
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const half = parseFloat(getSelectedTokenBalance()) / 2;
                      setAmount(half.toString());
                    }}
                    disabled={sending}
                  >
                    Half
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-4 gap-2">
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendToken}
                disabled={sending || !isValid}
                className="relative"
              >
                {sending ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <span className="opacity-0">Send</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {getSelectedTokenSymbol()}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex justify-center mb-3">
              <div className="bg-slate-100 p-3 rounded-full">
                <Coins className="h-8 w-8 text-slate-400" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-slate-700 mb-1">No tokens found</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm 
                ? 'Try a different search term or clear the search' 
                : 'Import existing tokens or create a new one'}
            </p>
            {searchTerm && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-1/5">Name</TableHead>
                  <TableHead className="w-1/6">Symbol</TableHead>
                  <TableHead className="w-1/6">Balance</TableHead>
                  <TableHead className="w-1/5">Contract</TableHead>
                  <TableHead className="w-1/6">Created</TableHead>
                  <TableHead className="w-1/5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.map((token) => {
                  const isImported = importedTokens.some(
                    t => t.address.toLowerCase() === token.tokenAddress.toLowerCase()
                  );
                  
                  const tokenBalance = balances.find(b => 
                    b.address.toLowerCase() === token.tokenAddress.toLowerCase()
                  )?.balance || BigInt(0);
                  
                  const formattedBalance = formatEther(tokenBalance);
                  const isSelected = selectedToken === token.tokenAddress;
                  
                  return (
                    <TableRow 
                      key={token.tokenAddress} 
                      className={`hover:bg-slate-50 group ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    >
                      <TableCell className="font-medium">
                        {token.name}
                        {isSelected && <Badge className="ml-2 bg-blue-100 text-blue-800 border-blue-200">Selected</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 font-mono">
                          {token.symbol}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {parseFloat(formattedBalance).toFixed(4)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://sepolia.etherscan.io/address/${token.tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:text-primary/80 font-mono text-xs"
                        >
                          {shortenAddress(token.tokenAddress)}
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        {token.timestamp > 0 ? (
                          <div className="text-sm text-slate-600">{formatTimestamp(token.timestamp)}</div>
                        ) : (
                          <Badge variant="outline" className="bg-slate-50 text-slate-500">Imported</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          {parseFloat(formattedBalance) > 0 && (
                            <Button
                              variant={isSelected ? "secondary" : "ghost"}
                              size="sm"
                              className={`${isSelected 
                                ? "bg-blue-200 text-blue-800 hover:bg-blue-300" 
                                : "text-primary hover:text-primary/80 hover:bg-primary/10"} h-8`}
                              onClick={() => selectToken(token.tokenAddress)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {isSelected ? "Selected" : "Send"}
                            </Button>
                          )}
                          
                          {isImported && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8"
                              onClick={() => removeToken(token.tokenAddress)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};