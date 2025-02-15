import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'

const PAYMASTER_PRIVATE_KEY = process.env.PAYMASTER_PRIVATE_KEY
if (!PAYMASTER_PRIVATE_KEY) {
  throw new Error('PAYMASTER_PRIVATE_KEY is not set')
}

const paymasterAccount = privateKeyToAccount(PAYMASTER_PRIVATE_KEY as `0x${string}`)

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

    // ハッシュをそのまま署名するのではなく、Ethereum Signed Messageとして署名する
    const signature = await paymasterAccount.signMessage({
      message: { raw: hash as `0x${string}` }
    })

    console.log("Signer address:", paymasterAccount.address);
    console.log("Original hash:", hash);
    console.log("Generated signature:", signature);

    return NextResponse.json({ signature })
  } catch (error) {
    console.error('Error in paymaster sign API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}