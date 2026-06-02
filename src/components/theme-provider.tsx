"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { LazyMotion, domAnimation } from 'framer-motion'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <LazyMotion features={domAnimation}>
        {children}
      </LazyMotion>
    </NextThemesProvider>
  )
}
