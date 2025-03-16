import React, { useState } from 'react';
import { 
  ArrowRight, 
  Loader2, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2,
  Send,
  X
} from 'lucide-react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { useAA } from '../hooks/useAA';
import { encodeFunctionData, Hex, parseEther } from 'viem';
import { SimpleAccountABI } from '../abi/simpleAccount';
import { useUserOperationExecutor } from '../hooks/useUserOpExecutor';

interface TransactionInput {
  recipient: Hex | '';
  amount: string;
}

interface SendTransactionProps {
  isDeployed: boolean;
  onTransactionComplete: () => void;
}

export const SendTransaction: React.FC<SendTransactionProps> = ({ 
  isDeployed, 
  onTransactionComplete
}) => {
  const [sending, setSending] = useState(false);
  const [transactions, setTransactions] = useState<TransactionInput[]>([
    { recipient: '', amount: '' }
  ]);
  const [result, setResult] = useState<{success?: boolean; hash?: string; error?: string} | null>(null);
  
  const { aaAddress } = useAA();
  const { executeCallData } = useUserOperationExecutor(aaAddress);


  const addTransaction = () => {
    setTransactions([...transactions, { recipient: '', amount: '' }]);
    setResult(null);
  };

  const removeTransaction = (index: number) => {
    setTransactions(transactions.filter((_, i) => i !== index));
    setResult(null);
  };

  const updateTransaction = (index: number, field: keyof TransactionInput, value: string) => {
    const newTransactions = [...transactions];
    newTransactions[index] = {
      ...newTransactions[index],
      [field]: field === 'recipient' ? value as Hex : value
    };
    setTransactions(newTransactions);
    setResult(null);
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    
    try {      
      if (transactions.length === 1) {
        const { recipient, amount } = transactions[0];
        const callData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'execute',
          args: [recipient, parseEther(amount), '0x']
        });
        
        const result = await executeCallData(callData);
        
        if (result.success) {
          setResult({
            success: true,
            hash: result.txHash
          });
          
          onTransactionComplete();
        } else {
          throw new Error(result.error || 'Transaction failed');
        }
      } else {
        const targets = transactions.map(tx => tx.recipient);
        const values = transactions.map(tx => parseEther(tx.amount));
        const datas = transactions.map(() => '0x' as Hex);
        const callData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'executeBatch',
          args: [targets, values, datas]
        });
        
        const result = await executeCallData(callData);
        
        if (result.success) {
          setResult({
            success: true,
            hash: result.txHash
          });
          
          onTransactionComplete();
        } else {
          throw new Error(result.error || 'Transaction failed');
        }
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setSending(false);
    }
  };

  const isValid = transactions.every(tx => 
    tx.recipient.length > 3 && tx.amount && parseFloat(tx.amount) > 0
  );

  const resetForm = () => {
    setTransactions([{ recipient: '', amount: '' }]);
    setResult(null);
  };

  if (!isDeployed) return null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Send Transactions</CardTitle>
          </div>
          {transactions.length > 1 && (
            <div className="bg-blue-50 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-200">
              Batch Mode
            </div>
          )}
        </div>
        <CardDescription className="text-sm text-slate-500 mt-1">
          {transactions.length > 1 
            ? 'Send multiple transactions in a single operation' 
            : 'Send ETH from your smart account'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {result && (
          <Alert className={result.success 
            ? "bg-green-50 border-green-100 text-green-800" 
            : "bg-red-50 border-red-100 text-red-800"
          }>
            <div className="flex items-start gap-3">
              {result.success 
                ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              }
              <AlertDescription>
                {result.success 
                  ? (
                    <div className="space-y-1">
                      <p className="font-medium">Transaction successful!</p>
                      {result.hash && (
                        <a 
                          href={`https://sepolia.etherscan.io/tx/${result.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:text-green-800 underline text-sm flex items-center gap-1"
                        >
                          View on Etherscan
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )
                  : (
                    <div className="space-y-1">
                      <p className="font-medium">Transaction failed</p>
                      <p className="text-sm">{result.error}</p>
                    </div>
                  )
                }
              </AlertDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full" 
              onClick={() => setResult(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Alert>
        )}

        <div className="space-y-4">
          {transactions.map((tx, index) => (
            <div 
              key={index} 
              className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200 relative"
            >
              {transactions.length > 1 && (
                <div className="absolute right-2 top-2 flex items-center gap-2">
                  <div className="bg-slate-200 text-slate-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    #{index + 1}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    onClick={() => removeTransaction(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <div>
                <Label htmlFor={`recipient-${index}`} className="text-xs font-medium text-slate-500 mb-1 block">
                  Recipient Address
                </Label>
                <Input
                  id={`recipient-${index}`}
                  value={tx.recipient}
                  onChange={(e) => updateTransaction(index, 'recipient', e.target.value)}
                  placeholder="0x..."
                  className="font-mono"
                />
              </div>
              
              <div>
                <Label htmlFor={`amount-${index}`} className="text-xs font-medium text-slate-500 mb-1 block">
                  Amount (ETH)
                </Label>
                <div className="relative">
                  <Input
                    id={`amount-${index}`}
                    type="number"
                    value={tx.amount}
                    onChange={(e) => updateTransaction(index, 'amount', e.target.value)}
                    placeholder="0.0"
                    step="0.0001"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="text-sm text-slate-500">ETH</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {transactions.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addTransaction}
                className="sm:w-40"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Recipient
              </Button>
            )}
            
            {result?.success && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="sm:w-40"
              >
                <Loader2 className="h-4 w-4 mr-2" />
                New Transaction
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="bg-slate-50 border-t border-slate-200 pt-4 pb-4">
        <Button
          onClick={handleSend}
          disabled={sending || !isValid}
          className="w-full relative"
          size="lg"
        >
          {sending ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <span className="opacity-0">Send Transaction</span>
            </>
          ) : (
            <>
              {transactions.length > 1 ? 'Send Batch Transaction' : 'Send Transaction'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};