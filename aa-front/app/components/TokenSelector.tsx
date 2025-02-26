import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check, Coins } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TokenInfo } from '../hooks/useTokenManagement';
import { WRAPPED_SEPOLIA_ADDRESS } from '../constants/addresses';

interface TokenSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: string[];
  tokens: TokenInfo[];
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  value,
  onChange,
  disabled = [],
  tokens = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getTokenOptions = () => {
    // Start with ETH and WETH
    const options = [
      { value: 'ETH', label: 'ETH', symbol: 'ETH', name: 'Ethereum' },
      { value: WRAPPED_SEPOLIA_ADDRESS, label: 'WETH', symbol: 'WETH', name: 'Wrapped Ethereum' }
    ];
    
    // Add user tokens, but filter out WETH if it exists in user tokens to avoid duplication
    tokens.forEach(token => {
      // Skip if the token is already WETH (avoid duplication)
      if (token.address.toLowerCase() === WRAPPED_SEPOLIA_ADDRESS.toLowerCase()) {
        return;
      }
      
      options.push({
        value: token.address,
        label: `${token.symbol} - ${token.name}`,
        symbol: token.symbol,
        name: token.name
      });
    });
    
    // Filter by search term if any
    if (searchTerm) {
      return options.filter(option => 
        option.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return options;
  };

  const getTokenLabel = (value: string) => {
    if (value === 'ETH') return 'ETH';
    if (value === WRAPPED_SEPOLIA_ADDRESS) return 'WETH';
    
    const token = tokens.find(t => t.address === value);
    return token ? token.symbol : value.slice(0, 6) + '...' + value.slice(-4);
  };

  const handleSelectToken = (tokenValue: string) => {
    onChange(tokenValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const options = getTokenOptions();

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between text-left font-normal"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value ? getTokenLabel(value) : "Select token"}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 z-10 mt-1 w-60 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Search token"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-60 overflow-auto">
            {options.length === 0 ? (
              <div className="p-2 text-center text-sm text-slate-500">
                No tokens found
              </div>
            ) : (
              <div className="p-1">
                {options.map((option) => (
                  <button
                    key={option.value}
                    className={`
                      w-full flex items-center px-2 py-2 text-sm rounded-md
                      ${value === option.value ? 'bg-slate-100' : 'hover:bg-slate-50'}
                      ${disabled.includes(option.value) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    onClick={() => !disabled.includes(option.value) && handleSelectToken(option.value)}
                    disabled={disabled.includes(option.value)}
                  >
                    <div className="bg-slate-200 p-1 rounded-full mr-2">
                      <Coins className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex flex-col items-start">
                      <div className="font-medium">{option.symbol}</div>
                      <div className="text-xs text-slate-500">{option.name}</div>
                    </div>
                    {value === option.value && (
                      <Check className="ml-auto h-4 w-4 text-green-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};