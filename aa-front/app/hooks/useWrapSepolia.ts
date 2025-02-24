import { encodeFunctionData, Hex, parseEther, formatEther } from "viem"
import { wrappedSepolia } from "../abi/wrappedSepolia"
import { SimpleAccountABI } from "../abi/simpleAccount"
import useUserOperation from "./useUserOperation"
import { usePaymasterData } from "./usePaymasterData"
import { useExecuteUserOperation } from "./useExecuteUserOperation"
import { bundlerClient, publicClient } from "../utils/client"
import { WRAPPED_SEPOLIA_ADDRESS } from "../constants/addresses"

interface TransactionResult {
  success: boolean
  hash?: string
  error?: string
}

export function useWrapSepolia(aaAddress: Hex) {
  const { createUserOperation } = useUserOperation()
  const { getPaymasterAndData } = usePaymasterData()
  const { execute } = useExecuteUserOperation()

  const executeUserOp = async (callData: Hex): Promise<TransactionResult> => {
    try {
      const userOp = await createUserOperation({ aaAddress, callData })
      const paymasterAndData = await getPaymasterAndData(userOp)
      userOp.paymasterAndData = paymasterAndData

      const userOpHash = await execute(userOp)
      const receipt = await bundlerClient.waitForUserOperationReceipt({ 
        hash: userOpHash,
        timeout: 30000,
      })
      console.log(receipt)

      return {
        success: true,
        hash: receipt.receipt.transactionHash
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }
    }
  }

  const deposit = async (amount: string): Promise<TransactionResult> => {
    try {
      if (parseFloat(amount) <= 0) {
        throw new Error("Amount must be greater than 0")
      }

      const func = encodeFunctionData({
        abi: wrappedSepolia,
        functionName: 'deposit',
        args: []
      })

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [WRAPPED_SEPOLIA_ADDRESS, parseEther(amount), func]
      })

      return await executeUserOp(callData)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to deposit"
      }
    }
  }

  const withdraw = async (amount: string): Promise<TransactionResult> => {
    try {
      if (parseFloat(amount) <= 0) {
        throw new Error("Amount must be greater than 0")
      }

      const balance = await balanceOf()
      if (parseFloat(formatEther(balance)) < parseFloat(amount)) {
        throw new Error("Insufficient balance")
      }

      const func = encodeFunctionData({
        abi: wrappedSepolia,
        functionName: 'withdraw',
        args: [parseEther(amount)]
      })

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [WRAPPED_SEPOLIA_ADDRESS, '0x0', func]
      })

      return await executeUserOp(callData)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to withdraw"
      }
    }
  }

  const balanceOf = async (): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: WRAPPED_SEPOLIA_ADDRESS,
        abi: wrappedSepolia,
        functionName: 'balanceOf',
        args: [aaAddress]
      }) as bigint
      
      return balance
    } catch (error) {
      console.error("Failed to fetch balance:", error)
      throw error
    }
  }

  const transfer = async (to: string, amount: string): Promise<TransactionResult> => {
    try {
      if (parseFloat(amount) <= 0) {
        throw new Error("Amount must be greater than 0")
      }

      const balance = await balanceOf()
      if (parseFloat(formatEther(balance)) < parseFloat(amount)) {
        throw new Error("Insufficient balance")
      }

      const func = encodeFunctionData({
        abi: wrappedSepolia,
        functionName: 'transfer',
        args: [to, parseEther(amount)]
      })

      const callData = encodeFunctionData({
        abi: SimpleAccountABI,
        functionName: 'execute',
        args: [WRAPPED_SEPOLIA_ADDRESS, '0x0', func]
      })

      return await executeUserOp(callData)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transfer"
      }
    }
  }

  return {
    deposit,
    withdraw,
    balanceOf,
    transfer
  }
}