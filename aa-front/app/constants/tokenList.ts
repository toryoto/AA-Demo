import { DAI_ADDRESS, JPYC_ADDRESS, USDC_ADDRESS, WRAPPED_SEPOLIA_ADDRESS } from "./addresses";

export interface TokenOption {
  symbol: string;
  name: string;
  address: string;
  logo: string;
  balance?: string;
}

export const TOKEN_OPTIONS: TokenOption[] = [
  { 
    symbol: 'SEP', 
    name: 'Sepolia ETH', 
    address: 'SEP', 
    logo: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png' 
  },
  { 
    symbol: 'WSEP', 
    name: 'Wrapped Sepolia', 
    address: WRAPPED_SEPOLIA_ADDRESS, 
    logo: 'https://zengo.com/wp-content/uploads/wETH_desktop.svg' 
  },
  { 
    symbol: 'DAI', 
    name: 'Dai Stablecoin', 
    address: DAI_ADDRESS, 
    logo: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png' 
  },
  { 
    symbol: 'USDC', 
    name: 'USD Coin', 
    address: USDC_ADDRESS, 
    logo: 'https://coin-images.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042389' 
  },
  { 
    symbol: 'JPYC', 
    name: 'JPY Coin', 
    address: JPYC_ADDRESS, 
    logo: 'https://jpyc.jp/static/media/jpycPrepaidSymbol.46f34eb68974b2165b1ecf4a7357756c.svg' 
  }
];