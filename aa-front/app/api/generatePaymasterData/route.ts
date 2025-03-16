import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { getContract, Hex } from 'viem'
import { verifyingPaymasterAbi } from '@/app/abi/verifyingPaymaster'
import { publicClient } from '@/app/utils/client'
import type { UserOperation } from '@/app/lib/userOperationType'
import { PAYMASTER_ADDRESS } from '@/app/constants/addresses'

const PAYMASTER_PRIVATE_KEY = process.env.PAYMASTER_PRIVATE_KEY

if (!PAYMASTER_PRIVATE_KEY || !PAYMASTER_ADDRESS) {
  throw new Error('Required environment variables are not set')
}

const paymasterAccount = privateKeyToAccount(PAYMASTER_PRIVATE_KEY as `0x${string}`)

const encodePaymasterAndData = ({ paymaster, data }: { paymaster: Hex; data: Hex }) => {
  const encoded = `${paymaster.replace('0x', '')}${data.replace('0x', '')}`
  return `0x${encoded}` as Hex
}

const validateUserOp = (userOp: UserOperation): boolean => {
  const requiredFields = [
    'sender',
    'nonce',
    'initCode',
    'callData',
    'callGasLimit',
    'verificationGasLimit',
    'preVerificationGas',
    'maxFeePerGas',
    'maxPriorityFeePerGas',
    'signature',
  ]

  return requiredFields.every(field => field in userOp)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userOp } = body
    console.log(userOp)

    if (!userOp || !validateUserOp(userOp)) {
      return NextResponse.json({ error: 'Invalid UserOperation provided' }, { status: 400 })
    }

    const verifyingPaymaster = getContract({
      address: PAYMASTER_ADDRESS,
      abi: verifyingPaymasterAbi,
      client: publicClient,
    })

    const userOpHash = await verifyingPaymaster.read.getHash([userOp])

    const signature = await paymasterAccount.signMessage({
      message: {
        raw: userOpHash as `0x${string}`,
      },
    })

    const paymasterAndData = encodePaymasterAndData({
      paymaster: PAYMASTER_ADDRESS,
      data: signature,
    })

    return NextResponse.json({
      paymasterAndData,
      hash: userOpHash,
      signature,
    })
  } catch (error) {
    console.error('Error in paymaster API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
