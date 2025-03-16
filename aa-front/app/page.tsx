'use client'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const AAWallet = dynamic(() => import('../app/components/AAWallet'), { ssr: false })

export default function Home() {
  return (
    <div className="container">
      <Suspense fallback={<div>Loading...</div>}>
        <AAWallet />
      </Suspense>
    </div>
  )
}
