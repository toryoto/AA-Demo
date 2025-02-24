import React, { useState } from 'react'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { useExecuteUserOperation } from '../hooks/useExecuteUserOperation'
import useUserOperation from '../hooks/useUserOperation'
import { usePaymasterData } from '../hooks/usePaymasterData'
import { useAA } from '../hooks/useAA'
import { encodeFunctionData, Hex, parseEther } from 'viem'
import { bundlerClient } from '../utils/client'
import { SimpleAccountABI } from '../abi/simpleAccount'

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
  const [sending, setSending] = useState(false)
  const [transactions, setTransactions] = useState<TransactionInput[]>([
    { recipient: '', amount: '' }
  ])
  
  const { createUserOperation } = useUserOperation()
  const { getPaymasterAndData } = usePaymasterData()
  const { execute } = useExecuteUserOperation()
  const { aaAddress } = useAA()

  const addTransaction = () => {
    setTransactions([...transactions, { recipient: '', amount: '' }])
  }

  const removeTransaction = (index: number) => {
    setTransactions(transactions.filter((_, i) => i !== index))
  }

  const updateTransaction = (index: number, field: keyof TransactionInput, value: string) => {
    const newTransactions = [...transactions]
    newTransactions[index] = {
      ...newTransactions[index],
      [field]: field === 'recipient' ? value as Hex : value
    }
    setTransactions(newTransactions)
  }

  const handleSend = async () => {
    setSending(true)
    try {
      if (transactions.length === 1) {
        // Single transaction
        const { recipient, amount } = transactions[0]
        const callData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'execute',
          args: [recipient, parseEther(amount), '0x']
        })
        console.log(callData)
        return

        const userOp = await createUserOperation({ aaAddress, callData })
        const paymasterAndData = await getPaymasterAndData(userOp)
        userOp.paymasterAndData = paymasterAndData

        const userOpHash = await execute(userOp)
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
      } else {
        // Batch transaction
        const targets = transactions.map(tx => tx.recipient)
        const values = transactions.map(tx => parseEther(tx.amount))
        const datas = transactions.map(() => '0x' as Hex)  // 単純な送金なので空のデータ

        const callData = encodeFunctionData({
          abi: SimpleAccountABI,
          functionName: 'executeBatch',
          args: [targets, values, datas]
        })

        const userOp = await createUserOperation({ aaAddress, callData })
        const paymasterAndData = await getPaymasterAndData(userOp)
        userOp.paymasterAndData = paymasterAndData

        const userOpHash = await execute(userOp)
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
      }
      onTransactionComplete();

      setTransactions([{ recipient: '', amount: '' }])
      console.log('Transaction successful!')
    } catch (error) {
      console.error('Transaction failed:', error)
    } finally {
      setSending(false)
    }
  }

  const isValid = transactions.every(tx => 
    tx.recipient.length > 3 && tx.amount && parseFloat(tx.amount) > 0
  )

  if (!isDeployed) return null

  return (
    <div className="pt-4 border-t space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Send Transaction</h3>
        {transactions.length < 5 && (
          <Button
            variant="outline"
            size="sm"
            onClick={addTransaction}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Recipient
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {transactions.map((tx, index) => (
          <div key={index} className="space-y-3 p-4 bg-gray-50 rounded-lg relative">
            {transactions.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 text-gray-500 hover:text-red-500"
                onClick={() => removeTransaction(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            
            <div>
              <Label htmlFor={`recipient-${index}`}>Recipient Address</Label>
              <Input
                id={`recipient-${index}`}
                value={tx.recipient}
                onChange={(e) => updateTransaction(index, 'recipient', e.target.value)}
                placeholder="0x..."
              />
            </div>
            
            <div>
              <Label htmlFor={`amount-${index}`}>Amount (ETH)</Label>
              <Input
                id={`amount-${index}`}
                type="number"
                value={tx.amount}
                onChange={(e) => updateTransaction(index, 'amount', e.target.value)}
                placeholder="0.0"
                step="0.0001"
              />
            </div>
          </div>
        ))}

        <Button
          onClick={handleSend}
          disabled={sending || !isValid}
          className="w-full"
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
          ) : (
            <>
              {transactions.length > 1 ? 'Send Batch Transaction' : 'Send Transaction'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}