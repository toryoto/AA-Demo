import { useContext } from 'react';
import { AAContext } from '../contexts/AAContext';

export function useAA() {
  const context = useContext(AAContext);
  if (context === undefined) {
    throw new Error('useAA must be used within an AAProvider');
  }
  return context;
}