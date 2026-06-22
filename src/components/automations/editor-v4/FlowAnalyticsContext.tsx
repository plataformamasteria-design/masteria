'use client';

import React, { createContext, useContext } from 'react';
import type { NodeStats } from '@/hooks/use-flow-analytics';

interface FlowAnalyticsContextType {
  stats: NodeStats[];
}

const FlowAnalyticsContext = createContext<FlowAnalyticsContextType>({ stats: [] });

export function FlowAnalyticsProvider({ children, stats }: { children: React.ReactNode; stats: NodeStats[] }) {
  return (
    <FlowAnalyticsContext.Provider value={{ stats }}>
      {children}
    </FlowAnalyticsContext.Provider>
  );
}

export function useFlowAnalyticsContext() {
  return useContext(FlowAnalyticsContext);
}
