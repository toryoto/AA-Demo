import React, { useState } from 'react'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useExecuteUserOperation } from '../hooks/useExecuteUserOperation'
import useUserOperation from '../hooks/useUserOperation'
import { usePaymasterData } from '../hooks/usePaymasterData'
import { useAA } from '../hooks/useAA'
import { encodeFunctionData, Hex, parseEther } from 'viem'
import { bundlerClient } from '../utils/client'

interface SendTransactionProps {
  isDeployed: boolean;
}

export const SendTransaction: React.FC<SendTransactionProps> = ({ isDeployed }) => {
  const [sending, setSending] = useState(false)
  const [recipient, setRecipient] = useState<Hex>('0x')
  const [amount, setAmount] = useState('')
  const { createUserOperation } = useUserOperation()
  const { getPaymasterAndData } = usePaymasterData()
  const { execute } = useExecuteUserOperation()
  const { aaAddress } = useAA()
  

  const handleSend = async () => {
    setSending(true);
    try {
      console.log(`Sending ${amount} ETH to ${recipient}`)
      const callData = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'execute',
            inputs: [
              { type: 'address', name: 'dest' },
              { type: 'uint256', name: 'value' },
              { type: 'bytes', name: 'func' }
            ],
            outputs: [{ type: 'bytes', name: 'ret' }],
            stateMutability: 'payable'
          }
        ],
        functionName: 'execute',
        args: [
          recipient,
          parseEther(amount),
          '0x'
        ]
      })

      const userOp = await createUserOperation({ aaAddress, callData})
      console.log("userOp", userOp)

      const paymasterAndData = await getPaymasterAndData(userOp)
      userOp.paymasterAndData = paymasterAndData

      const userOpHash = await execute(userOp)
      console.log('UserOperation Hash:', userOpHash)

      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash
      })

      console.log(receipt)

      setRecipient('0x')
      setAmount('')
      console.log('Transaction successful!')
    } catch (error) {
      console.error('Transaction failed:', error)
    } finally {
      setSending(false)
    }
  };

  if (!isDeployed) return null

  return (
    <div className="pt-4 border-t space-y-4">
      <h3 className="text-lg font-semibold">Send Transaction</h3>
      <div className="space-y-3">
        <div>
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value as Hex)}
            placeholder="0x..."
          />
        </div>
        <div>
          <Label htmlFor="amount">Amount (ETH)</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.0001"
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={sending || !recipient || !amount}
          className="w-full"
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
          ) : (
            <>
              Send
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}