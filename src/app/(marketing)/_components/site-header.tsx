"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BotMessageSquare } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/30 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-950/10">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/site" className="flex items-center space-x-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 transition-all duration-300 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/50 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <BotMessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">Master<span className="text-emerald-600 dark:text-emerald-400">IA</span></span>
        </Link>
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link href="#features" className="hover:text-zinc-900 dark:hover:text-white transition-colors duration-200">Recursos</Link>
          <Link href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-white transition-colors duration-200">Integrações</Link>
          <Link href="#pricing" className="hover:text-zinc-900 dark:hover:text-white transition-colors duration-200">Planos</Link>
        </nav>
        <div className="flex items-center space-x-4">
          <Link href="/login" className="hidden sm:inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 rounded-full transition-all duration-300 hover:shadow-sm dark:hover:shadow-[0_0_10px_rgba(255,255,255,0.05)]">
            Entrar
          </Link>
          <Button asChild className="relative overflow-hidden bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all duration-300 font-bold rounded-full px-7 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 border border-emerald-400/50">
            <Link href="/register">
              Começar Agora
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
