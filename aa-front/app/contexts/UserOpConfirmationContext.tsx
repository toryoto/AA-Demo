import React, { createContext, useState, useContext, ReactNode } from 'react';
import { UserOpConfirmationModal } from '../components/UserOpConfirmationModal';
import { Hex } from 'viem';

interface UserOpConfirmationContextType {
  confirmUserOp: (callData: Hex, onConfirm: () => Promise<void>) => void;
}

const UserOpConfirmationContext = createContext<UserOpConfirmationContextType | undefined>(undefined);

export function UserOpConfirmationProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [callData, setCallData] = useState<Hex | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<(() => Promise<void>) | null>(null);

  const confirmUserOp = (
    callData: Hex,
    onConfirm: () => Promise<void>
  ) => {
    setCallData(callData);
    setConfirmationAction(() => onConfirm);
    setIsModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmationAction) return;
    
    setIsProcessing(true);
    try {
      await confirmationAction();
    } catch (error) {
      console.error('Error executing user operation:', error);
    } finally {
      setIsProcessing(false);
      setIsModalOpen(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setIsModalOpen(false);
    setCallData(null);
    setConfirmationAction(null);
  };

  return (
    <UserOpConfirmationContext.Provider value={{ confirmUserOp }}>
      {children}
      <UserOpConfirmationModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        isProcessing={isProcessing}
        callData={callData}
      />
    </UserOpConfirmationContext.Provider>
  );
}

export function useUserOpConfirmation() {
  const context = useContext(UserOpConfirmationContext);
  if (context === undefined) {
    throw new Error('useUserOpConfirmation must be used within a UserOpConfirmationProvider');
  }
  return context;
}