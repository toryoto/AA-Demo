import React, { useState, useEffect } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { Button } from './ui/button'
import Image from 'next/image'
import { TOKEN_OPTIONS } from '../constants/tokenList'

interface TokenSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: string[]
}

const TokenSelector: React.FC<TokenSelectorProps> = ({ value, onChange, disabled = [] }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelectToken = (tokenValue: string) => {
    onChange(tokenValue)
    setIsOpen(false)
  }

  const selectedToken = TOKEN_OPTIONS.find(t => t.address === value)

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between text-left font-normal"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedToken ? (
          <div className="flex items-center">
            <Image
              width={24}
              height={24}
              src={selectedToken.logo}
              alt={selectedToken.symbol}
              className="w-5 h-5 mr-2 rounded-full"
            />
            {selectedToken.symbol}
          </div>
        ) : (
          'Select token'
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 z-10 mt-1 w-60 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="p-1">
            {TOKEN_OPTIONS.map(option => (
              <button
                key={option.address}
                className={`
                  w-full flex items-center px-2 py-2 text-sm rounded-md
                  ${value === option.address ? 'bg-slate-100' : 'hover:bg-slate-50'}
                  ${disabled.includes(option.address) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onClick={() =>
                  !disabled.includes(option.address) && handleSelectToken(option.address)
                }
                disabled={disabled.includes(option.address)}
              >
                <Image
                  width={24}
                  height={24}
                  src={option.logo}
                  alt={option.symbol}
                  className="w-6 h-6 mr-2 rounded-full"
                />
                <div className="flex flex-col items-start">
                  <div className="font-medium">{option.symbol}</div>
                  <div className="text-xs text-slate-500">{option.name}</div>
                </div>
                {value === option.address && (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenSelector
