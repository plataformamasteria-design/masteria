'use client';

import { useEffect, useState } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface ResponsiveState {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  width: number;
  mounted: boolean;
}

const getBreakpoint = (width: number): Breakpoint => {
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  if (width < 1920) return '2xl';
  if (width < 2560) return '3xl';
  return '4xl';
};

const getInitialState = (): ResponsiveState => {
  return {
    breakpoint: 'lg',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: false,
    width: 1024,
    mounted: false,
  };
};

export function useResponsive(): ResponsiveState {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<ResponsiveState>(getInitialState);

  useEffect(() => {
    setMounted(true);
    
    const updateState = () => {
      const width = window.innerWidth;
      const breakpoint = getBreakpoint(width);

      setState({
        breakpoint,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        isLargeDesktop: width >= 1920,
        width,
        mounted: true,
      });
    };

    updateState();

    const handleResize = () => {
      updateState();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!mounted) {
    return getInitialState();
  }

  return state;
}
