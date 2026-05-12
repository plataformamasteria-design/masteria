import { create } from 'zustand';

interface PhoneStore {
    isOpen: boolean;
    phoneNumber: string;
    openPhone: (number?: string) => void;
    closePhone: () => void;
    setPhoneNumber: (number: string) => void;
}

export const usePhoneStore = create<PhoneStore>((set) => ({
    isOpen: false,
    phoneNumber: '',
    openPhone: (number?: string) => set({ isOpen: true, phoneNumber: number || '' }),
    closePhone: () => set({ isOpen: false, phoneNumber: '' }),
    setPhoneNumber: (number: string) => set({ phoneNumber: number }),
}));
