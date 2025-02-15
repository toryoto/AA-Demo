import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { concat, encodeAbiParameters, Hex, toBytes } from 'viem'

const PAYMASTER_PRIVATE_KEY = process.env.PAYMASTER_PRIVATE_KEY
if (!PAYMASTER_PRIVATE_KEY) {
  throw new Error('PAYMASTER_PRIVATE_KEY is not set')
}

// Paymasterの署名を行う権限を持つEOAアカウントを作成
const paymasterAccount = privateKeyToAccount(PAYMASTER_PRIVATE_KEY as Hex)

// 
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hash, validUntil, validAfter } = body
    console.log("body: ", hash, validUntil, validAfter)

    if (!hash || !validUntil || !validAfter) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const now = Math.floor(Date.now() / 1000)
    if (validUntil <= now) {
      return NextResponse.json(
        { error: 'Invalid validUntil' },
        { status: 400 }
      )
    }
    if (validAfter >= now) {
      return NextResponse.json(
        { error: 'Invalid validAfter' },
        { status: 400 }
      )
    }

    // 署名するデータを生成（hash, validateUntil, validateAfterを使用）
    // Paymasterコントラクトの_validatePaymasterUserOpでuserOp.paymasterAndDataから取得してる
    const message = concat([
      toBytes(hash),
      encodeAbiParameters(
        [{ type: 'uint48' }, { type: 'uint48' }],
        [Number(validUntil), Number(validAfter)]
      )
    ])

    const signature = await paymasterAccount.signMessage({
      message: { raw: message }
    })

    console.log("signature: ", signature)

    return NextResponse.json({ signature })
  } catch (error) {
    console.error('Error in paymaster sign API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}