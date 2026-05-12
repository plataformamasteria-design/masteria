import { Link } from "react-router-dom";
import { Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULE_PLANS } from "@/constants/landing-data";
import { AnimatedSection } from "./AnimatedSection";

export function PlansSection({ isDark }: { isDark: boolean }) {
    return (
        <section id="planos" className={`py-20 md:py-24 relative overflow-hidden ${isDark ? "bg-[#0B1120]" : "bg-white"}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <AnimatedSection>
                    <div className="text-center mb-12 md:mb-16">
                        <span className={`inline-block text-[10px] font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full border ${isDark ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`}>
                            Transparência
                        </span>
                        <h2 className={`text-4xl md:text-5xl font-bold tracking-tight mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>
                            Planos simples, <span className="gradient-text">escala ilimitada</span>
                        </h2>
                        <p className={`max-w-2xl mx-auto text-lg font-light ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                            Comece agora com 7 dias de teste gratuito. Sem compromisso.
                        </p>
                    </div>
                </AnimatedSection>

                <div className="grid md:grid-cols-3 gap-8 mb-12">
                    {MODULE_PLANS.map((plan, i) => (
                        <AnimatedSection key={plan.name} delay={i * 100}>
                            <div
                                className={`relative rounded-[2.5rem] p-10 space-y-8 border h-full transition-all duration-500 group hover:-translate-y-2 ${plan.popular
                                    ? isDark
                                        ? "bg-slate-900/60 border-emerald-500/30 shadow-[0_20px_60px_rgba(16,185,129,0.1)]"
                                        : "bg-white border-emerald-500/40 shadow-[0_20px_60px_rgba(16,185,129,0.08)]"
                                    : isDark
                                        ? "bg-slate-900/40 border-white/10"
                                        : "bg-slate-50 border-slate-200"
                                    }`}
                                style={{ backdropFilter: "blur(24px) saturate(180%)" }}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                        <span className={`px-5 py-2 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase whitespace-nowrap shadow-xl flex items-center gap-2 ${isDark ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-[#0a0f1a]" : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white"}`}>
                                            <Zap className="h-3 w-3 fill-current" /> Mais Escolhido
                                        </span>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h3 className={`text-2xl font-bold ${plan.popular ? (isDark ? "text-emerald-400" : "text-emerald-600") : ""}`}>{plan.name}</h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-5xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>{plan.comboPrice}</span>
                                        <span className={`text-sm font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>{plan.period}</span>
                                    </div>
                                    {plan.modulePrice !== plan.comboPrice && (
                                        <p className={`text-xs font-medium px-3 py-1 rounded-full inline-block ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500"}`}>
                                            Módulo base: {plan.modulePrice}/mês
                                        </p>
                                    )}
                                </div>

                                <ul className="space-y-4 pt-4">
                                    {plan.items.map((item) => (
                                        <li key={item} className={`flex items-start gap-3 text-[14px] leading-tight ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                            <div className={`mt-0.5 rounded-full p-0.5 ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="font-light">{item}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="pt-6">
                                    <Link to="/trial">
                                        <Button className={`w-full rounded-2xl h-14 text-sm font-bold tracking-wide transition-all ${plan.popular
                                            ? isDark ? "bg-emerald-500 text-[#0a0f1a] hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/20"
                                            : isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-900 text-white hover:bg-slate-800"
                                            }`}>
                                            Teste grátis por 7 dias
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>

                <AnimatedSection>
                    <p className={`text-center text-[11px] font-medium tracking-wide uppercase opacity-50 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        Sem fidelidade · Cancele quando quiser · Suporte prioritize incluso
                    </p>
                </AnimatedSection>
            </div>
        </section>
    );
}
