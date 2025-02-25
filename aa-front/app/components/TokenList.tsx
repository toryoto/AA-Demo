import React, { useEffect, useCallback, useState } from 'react';
import { 
  Coins, 
  ArrowUpRight, 
  Send, 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { formatEther, Hex, PublicClient, isAddress } from 'viem';
import { erc20Abi } from '../abi/erc20';
import { toast } from 'sonner';
import { useTokenContract } from '../hooks/useTokenContract';

interface TokenListProps {
  aaAddress: Hex;
  publicClient: PublicClient;
  isDeployed: boolean;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  balance: string;
}

export const TokenList: React.FC<TokenListProps> = ({ 
  aaAddress,
  publicClient,
  isDeployed
}) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [txStatus, setTxStatus] = useState<{status: 'success' | 'error', message: string} | null>(null);

  const { sendToken } = useTokenContract(publicClient, aaAddress);

  useEffect(() => {
    if (aaAddress && aaAddress !== '0x') {
      loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aaAddress]);

  useEffect(() => {
    if (tokens.length > 0 && aaAddress && aaAddress !== '0x') {
      updateTokenBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length, aaAddress]);

  const loadTokens = () => {
    if (!aaAddress) return;
    
    const storedTokens = localStorage.getItem(`imported_tokens_${aaAddress}`);
    if (storedTokens) {
      try {
        setTokens(JSON.parse(storedTokens));
      } catch (error) {
        console.error('Error parsing stored tokens:', error);
        setTokens([]);
      }
    }
  };

  const updateTokenBalances = async () => {
    if (!aaAddress || tokens.length === 0) return;
    
    setIsLoading(true);
    
    try {
      const updatedTokens = await Promise.all(
        tokens.map(async (token) => {
          try {
            const balance = await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [aaAddress]
            });
            
            return {
              ...token,
              balance: formatEther(balance as bigint)
            };
          } catch (error) {
            console.error(`Error fetching balance for token ${token.address}:`, error);
            return {
              ...token,
              balance: '0'
            };
          }
        })
      );
      
      setTokens(updatedTokens);
      localStorage.setItem(`imported_tokens_${aaAddress}`, JSON.stringify(updatedTokens));
    } catch (error) {
      console.error('Error updating token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const importToken = async () => {
    if (!newTokenAddress || !aaAddress) return;
    
    if (!isAddress(newTokenAddress)) {
      setImportError('Invalid address format');
      return;
    }

    setImporting(true);
    setImportError('');

    try {
      if (tokens.some(t => t.address.toLowerCase() === newTokenAddress.toLowerCase())) {
        setImportError('Token already imported');
        setImporting(false);
        return;
      }

      const [name, symbol, balance] = await Promise.all([
        publicClient.readContract({
          address: newTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name'
        }),
        publicClient.readContract({
          address: newTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol'
        }),
        publicClient.readContract({
          address: newTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [aaAddress]
        })
      ]);

      const newToken = {
        address: newTokenAddress,
        name: name as string,
        symbol: symbol as string,
        balance: formatEther(balance as bigint)
      };

      const updatedTokens = [...tokens, newToken];
      setTokens(updatedTokens);
      localStorage.setItem(`imported_tokens_${aaAddress}`, JSON.stringify(updatedTokens));
      
      setNewTokenAddress('');
      toast.success(`Imported ${name} (${symbol}) successfully`);
    } catch (error) {
      console.error('Error importing token:', error);
      setImportError('Invalid token address or not an ERC-20 token');
    } finally {
      setImporting(false);
    }
  };

  const removeToken = (address: string) => {
    const updatedTokens = tokens.filter(token => token.address.toLowerCase() !== address.toLowerCase());
    setTokens(updatedTokens);
    localStorage.setItem(`imported_tokens_${aaAddress}`, JSON.stringify(updatedTokens));
    
    if (selectedToken === address) {
      setSelectedToken(null);
      setRecipient('');
      setAmount('');
    }
    
    toast.success('Token removed');
  };

  const handleSendToken = async () => {
    if (!selectedToken || !recipient || !amount) return;
    
    setSending(true);
    setTxStatus(null);
    
    try {
      await sendToken(selectedToken, recipient, amount);
      
      const selectedTokenInfo = tokens.find(t => t.address === selectedToken);
      
      setTxStatus({
        status: 'success',
        message: `Successfully sent ${amount} ${selectedTokenInfo?.symbol || ''} to ${shortenAddress(recipient)}`
      });
      
      await updateTokenBalances();
      
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

  const shortenAddress = useCallback((address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const selectToken = (address: string) => {
    setSelectedToken(address);
    setTxStatus(null);
  };

  const resetForm = () => {
    setSelectedToken(null);
    setRecipient('');
    setAmount('');
    setTxStatus(null);
  };

  const filteredTokens = searchTerm
    ? tokens.filter(token => 
        token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : tokens;

  const getSelectedTokenInfo = () => {
    return tokens.find(token => token.address === selectedToken);
  };

  const getSelectedTokenBalance = () => {
    const token = getSelectedTokenInfo();
    return token ? token.balance : '0';
  };

  const isValid = 
    selectedToken !== null && 
    recipient.length > 3 && 
    amount && 
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(getSelectedTokenBalance());

  if (!isDeployed) return null;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Your Tokens</CardTitle>
          </div>
          <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200">
            {tokens.length} Token{tokens.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <CardDescription className="text-sm text-slate-500 mt-1">
          Import and manage your ERC-20 tokens
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
              onClick={updateTokenBalances}
              className="whitespace-nowrap"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Updating...' : 'Refresh'}
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
                  onClick={importToken}
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

        {/* トークン送金フォーム (選択されたトークンがある場合のみ表示) */}
        {selectedToken && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Send className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Send {getSelectedTokenInfo()?.symbol}</h3>
              <Badge className="ml-auto">
                Balance: {parseFloat(getSelectedTokenBalance()).toFixed(4)} {getSelectedTokenInfo()?.symbol}
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
                      {getSelectedTokenInfo()?.symbol}
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {getSelectedTokenInfo()?.symbol}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {isLoading && tokens.length === 0 ? (
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
                : 'Import existing tokens to get started'}
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
                  <TableHead className="w-1/3">Token</TableHead>
                  <TableHead className="w-1/6">Balance</TableHead>
                  <TableHead className="w-1/4">Contract</TableHead>
                  <TableHead className="w-1/4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.map((token) => {
                  const isSelected = selectedToken === token.address;
                  const formattedBalance = parseFloat(token.balance).toFixed(4);
                  
                  return (
                    <TableRow 
                      key={token.address} 
                      className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center">
                          <div className="bg-slate-100 p-2 rounded-full mr-3">
                            <Coins className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <div className="font-medium flex items-center">
                              {token.name}
                              {isSelected && <Badge className="ml-2 bg-blue-100 text-blue-800 border-blue-200">Selected</Badge>}
                            </div>
                            <div className="text-sm text-slate-500">
                              <Badge variant="outline" className="bg-slate-50 font-mono">
                                {token.symbol}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formattedBalance}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://sepolia.etherscan.io/address/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:text-primary/80 font-mono text-xs"
                        >
                          {shortenAddress(token.address)}
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            variant={isSelected ? "secondary" : "ghost"}
                            size="sm"
                            className={`${isSelected 
                              ? "bg-blue-200 text-blue-800 hover:bg-blue-300" 
                              : "text-primary hover:text-primary/80 hover:bg-primary/10"} h-8`}
                            onClick={() => selectToken(token.address)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            {isSelected ? "Selected" : "Send"}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8"
                            onClick={() => removeToken(token.address)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
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