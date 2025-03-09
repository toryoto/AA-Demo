import { createContext, useState, useEffect, ReactNode } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { concat, encodeFunctionData, getContract, Hex } from 'viem';
import { accountFactoryAbi } from '../abi/accountFactory';
import { FACTORY_ADDRESS } from '../constants/addresses';
import { publicClient } from '../utils/client';
import { useUserOperationExecutor } from '../hooks/useUserOpExecutor';

export type AddressMode = 'aa' | 'eoa';

interface AAContextType {
  aaAddress: Hex;
  isDeployed: boolean;
  loading: boolean;
  deployAccount: () => Promise<void>;
  addressMode: AddressMode;
  setAddressMode: (mode: AddressMode) => void;
}

export const AAContext = createContext<AAContextType | undefined>(undefined);

export function AAProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [aaAddress, setAaAddress] = useState<Hex>('0x');
  const [isDeployed, setIsDeployed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addressMode, setAddressMode] = useState<AddressMode>('aa');
  const { executeCallData } = useUserOperationExecutor(aaAddress);

  useEffect(() => {
    const initializeAA = async () => {
      if (!walletClient || !address) return;
      
      setLoading(true);
      try {
        if (addressMode === 'eoa') {
          setAaAddress(address);
          setIsDeployed(true);
          setLoading(false);
          return;
        }

        const factory = getContract({
          address: FACTORY_ADDRESS,
          abi: accountFactoryAbi,
          client: publicClient
        });

        const salt = 0;
        const predictedAddress = await factory.read.getAddress([address, BigInt(salt)]) as Hex;

        setAaAddress(predictedAddress);
        
        const code = await publicClient.getCode({ address: predictedAddress });
        setIsDeployed(Boolean(code?.length));
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAA();
  }, [walletClient, address, addressMode]);

  const deployAccount = async () => {
    if (!address || !walletClient || !aaAddress) return;
    
    if (addressMode === 'eoa') {
      setIsDeployed(true);
      return;
    }
    
    try {
      const initCode = concat([
        FACTORY_ADDRESS,
        encodeFunctionData({
          abi: accountFactoryAbi,
          functionName: 'createAccount',
          args: [address, 0]
        })
      ]);
      await executeCallData('0x', { initCode });
      setIsDeployed(true);
      return;
    } catch (error) {
      console.error('Deploy error:', error);
    }
  };

  return (
    <AAContext.Provider value={{ 
      aaAddress, 
      isDeployed, 
      loading, 
      deployAccount,
      addressMode,
      setAddressMode,
    }}>
      {children}
    </AAContext.Provider>
  );
}