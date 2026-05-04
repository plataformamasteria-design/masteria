'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface VariableMapping {
  type: 'dynamic' | 'fixed';
  value: string;
}

interface BaileysCampaignContextType {
  name: string;
  setName: (value: string) => void;
  messageText: string;
  setMessageText: (value: string) => void;
  selectedConnectionId: string;
  setSelectedConnectionId: (value: string) => void;
  contactListIds: string[];
  setContactListIds: (value: string[]) => void;
  scheduleDate: Date | undefined;
  setScheduleDate: (value: Date | undefined) => void;
  scheduleTime: string;
  setScheduleTime: (value: string) => void;
  sendNow: boolean;
  setSendNow: (value: boolean) => void;
  variableMappings: Record<string, VariableMapping>;
  setVariableMappings: (value: Record<string, VariableMapping>) => void;
  delayOption: string;
  setDelayOption: (value: string) => void;
  reset: () => void;
}

const BaileysCampaignContext = createContext<BaileysCampaignContextType | undefined>(undefined);

export function BaileysCampaignProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [contactListIds, setContactListIds] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [sendNow, setSendNow] = useState(true);
  const [variableMappings, setVariableMappings] = useState<Record<string, VariableMapping>>({});
  const [delayOption, setDelayOption] = useState('fast');

  const reset = useCallback(() => {
    setName('');
    setMessageText('');
    setSelectedConnectionId('');
    setContactListIds([]);
    setScheduleDate(undefined);
    setScheduleTime('09:00');
    setSendNow(true);
    setVariableMappings({});
    setDelayOption('fast');
  }, []);

  const value: BaileysCampaignContextType = {
    name,
    setName,
    messageText,
    setMessageText,
    selectedConnectionId,
    setSelectedConnectionId,
    contactListIds,
    setContactListIds,
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    sendNow,
    setSendNow,
    variableMappings,
    setVariableMappings,
    delayOption,
    setDelayOption,
    reset,
  };

  return (
    <BaileysCampaignContext.Provider value={value}>
      {children}
    </BaileysCampaignContext.Provider>
  );
}

export function useBaileysCampaignContext() {
  const context = useContext(BaileysCampaignContext);
  if (!context) {
    throw new Error('useBaileysCampaignContext must be used within BaileysCampaignProvider');
  }
  return context;
}
