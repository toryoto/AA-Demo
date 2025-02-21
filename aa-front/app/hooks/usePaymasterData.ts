import { useState } from 'react';
import { UserOperation } from '../lib/userOperationType';
import { Hex } from 'viem';

export const usePaymasterData = () => {
  const [paymasterData, setPaymasterData] = useState<string>('0x');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const getPaymasterAndData = async (userOp: UserOperation): Promise<Hex> => {
    setLoading(true);
    try {
      const response = await fetch('/api/generatePaymasterData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userOp }),
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const data = await response.json();
      const paymasterAndData: Hex = data.paymasterAndData;
      setPaymasterData(data.paymasterAndData);
      return paymasterAndData;
    } catch (error) {
      console.error('Error fetching paymasterAndData:', error);
      setError(error as Error);
      return '0x';
    } finally {
      setLoading(false);
    }
  };

  return { getPaymasterAndData, paymasterData, loading, error };
};