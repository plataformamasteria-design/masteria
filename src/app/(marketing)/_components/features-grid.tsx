"use client";

import { motion } from "framer-motion";
import { MessageSquare, Zap, BarChart3, Bot, Workflow, Users, Wand2, Megaphone } from "lucide-react";

const features = [
  {
    title: "Atendimento Humanizado por IA",
    description: "Nossos agentes analisam o tom e intenção do cliente, respondendo como um especialista da sua empresa em segundos.",
    icon: <Bot className="h-6 w-6 text-emerald-400" />,
    className: "md:col-span-2 md:row-span-2",
  },
  {
    title: "Kanban CRM Integrado",
    description: "Arraste e solte seus leads, feche vendas e não perca nenhum follow-up.",
    icon: <Workflow className="h-6 w-6 text-cyan-400" />,
    className: "md:col-span-1",
  },
  {
    title: "Campanhas em Massa",
    description: "Envie milhares de mensagens sem bloqueios usando o poder da API Oficial do Meta.",
    icon: <Zap className="h-6 w-6 text-yellow-400" />,
    className: "md:col-span-1",
  },
  {
    title: "Múltiplos Atendentes",
    description: "Toda a sua equipe de vendas conectada a um único número de WhatsApp.",
    icon: <Users className="h-6 w-6 text-purple-400" />,
    className: "md:col-span-1",
  },
  {
    title: "Analytics e Métricas",
    description: "Acompanhe funis, conversões e tempo de resposta em tempo real.",
    icon: <BarChart3 className="h-6 w-6 text-blue-400" />,
    className: "md:col-span-1",
  },
  {
    title: "Caixa de Entrada Unificada",
    description: "Centralize WhatsApp, Instagram e Messenger numa única tela intuitiva.",
    icon: <MessageSquare className="h-6 w-6 text-pink-400" />,
    className: "md:col-span-2",
  },
  {
    title: "Automação Visual",
    description: "Crie fluxos de trabalho completos com nosso construtor drag & drop intuitivo.",
    icon: <Wand2 className="h-6 w-6 text-orange-400" />,
    className: "md:col-span-1",
  },
  {
    title: "Marketing e Captação",
    description: "Integre formulários nativos do Meta e monitore suas conversões direto no CRM.",
    icon: <Megaphone className="h-6 w-6 text-red-400" />,
    className: "md:col-span-1",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-24 relative w-full">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
        <div className="mb-16 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl md:text-5xl"
          >
            Tudo o que você precisa em <br className="hidden sm:block" />
            <span className="text-emerald-600 dark:text-emerald-400">uma única plataforma</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[200px]">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 p-8 backdrop-blur-sm transition-all hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-zinc-300 dark:hover:border-white/10 ${feature.className}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-200/50 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-white">{feature.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mt-auto">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
