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
    const { hash } = body;

    if (!hash || typeof hash !== 'string' || !hash.startsWith('0x') || (hash.length - 2) / 2 !== 32 ) {
      return NextResponse.json({ error: 'Invalid hash provided' }, { status: 400 });
    }


    const signature = await paymasterAccount.signMessage({
      message: {
        raw: hash as `0x${string}`,
      },
    });

    return NextResponse.json({ signature })
  } catch (error) {
    console.error('Error in paymaster sign API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}