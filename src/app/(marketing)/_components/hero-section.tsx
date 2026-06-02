"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { KanbanSimulation } from "./kanban-simulation";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden w-full">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10 text-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto mb-8 inline-flex items-center space-x-2 rounded-full border border-zinc-200/50 dark:border-white/10 bg-zinc-100/50 dark:bg-white/5 px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 backdrop-blur-md"
        >
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>O Futuro do Atendimento Chegou</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mx-auto max-w-4xl text-5xl font-black tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-500 dark:from-white dark:via-white dark:to-zinc-500"
        >
          Automatize seu WhatsApp com <span className="text-emerald-600 dark:text-emerald-400">Inteligência</span>.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed md:text-xl"
        >
          Crie campanhas dinâmicas, gerencie atendimentos e deixe nossos Agentes IA trabalharem 24/7 para multiplicar suas conversões.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="mt-10 flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
        >
          <Button asChild size="lg" className="h-14 rounded-full bg-emerald-500 px-8 text-base font-semibold text-zinc-950 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">
            <Link href="/register">
              Começar Gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-14 rounded-full border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-8 text-base font-semibold text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 backdrop-blur-md transition-all">
            <Link href="#features">
              Ver na Prática
            </Link>
          </Button>
        </motion.div>

        {/* Mockup Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
          className="relative mx-auto mt-20 max-w-5xl"
        >
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-emerald-500/20 to-transparent blur-xl opacity-50" />
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/50 p-2 shadow-2xl backdrop-blur-2xl ring-1 ring-zinc-200 dark:ring-white/10">
            <div className="flex h-10 items-center space-x-2 border-b border-zinc-200 dark:border-white/5 bg-zinc-200/50 dark:bg-zinc-900/50 px-4">
              <div className="flex space-x-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
            </div>
            {/* Interactive Kanban Simulation */}
            <div className="w-full bg-gradient-to-br from-zinc-50 to-zinc-100/80 dark:from-zinc-900/50 dark:to-zinc-950/80 p-4 md:p-6">
                <KanbanSimulation />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
