import { Target, Zap, BarChart3, TrendingUp, Brain } from "lucide-react";
import chatPreview from "@/assets/screenshots/chat.png";
import { AnimatedSection } from "./AnimatedSection";

export function DiferenciaisSection({ isDark }: { isDark: boolean }) {
    return (
        <section id="diferenciais" className={`py-20 md:py-24 relative overflow-hidden ${isDark ? "bg-[#0B1120]" : "bg-[#F8FAFC]"}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <AnimatedSection>
                    <div className="text-center mb-12 md:mb-16">
                        <span className={`inline-block text-[10px] font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full border ${isDark ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`}>
                            Diferenciais
                        </span>
                        <h2 className={`text-3xl md:text-5xl font-bold tracking-tight mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>
                            O controle que seu <span className="gradient-text">negócio merece</span>
                        </h2>
                        <p className={`max-w-2xl mx-auto text-lg font-light ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                            Centralize, automatize e escale sua operação com a plataforma mais completa do mercado.
                        </p>
                    </div>
                </AnimatedSection>

                {/* Bento Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[240px]">

                    {/* Large Card 1 */}
                    <AnimatedSection delay={100} className="md:col-span-8 md:row-span-2 group">
                        <div className={`h-full rounded-[2.5rem] border p-10 flex flex-col justify-between transition-all duration-500 hover:shadow-3xl hover:-translate-y-1 overflow-hidden relative ${isDark ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
                            }`}>
                            <div className="relative z-10">
                                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-6 shadow-xl ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                                    <Target className="h-8 w-8" />
                                </div>
                                <h3 className="text-3xl font-bold mb-4 tracking-tight">Plataforma Omnichannel</h3>
                                <p className={`text-lg max-w-md font-light leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                    Centralize WhatsApp, Instagram e Facebook em uma única interface inteligente e organizada por agentes.
                                </p>
                            </div>

                            <div className="absolute bottom-4 right-4 w-2/3 opacity-30 group-hover:opacity-50 transition-opacity translate-y-4 translate-x-4">
                                <img src={chatPreview} alt="Chat UI" className="rounded-tl-3xl border border-white/10 shadow-3xl" />
                            </div>
                        </div>
                    </AnimatedSection>

                    {/* Square Card 1 */}
                    <AnimatedSection delay={200} className="md:col-span-4 md:row-span-1">
                        <div className={`h-full rounded-[2.5rem] border p-8 flex flex-col justify-center transition-all duration-500 hover:shadow-2xl ${isDark ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
                            }`}>
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-5 ${isDark ? "bg-cyan-500/10 text-cyan-400" : "bg-cyan-50 text-cyan-600"}`}>
                                <Zap className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-bold mb-2 tracking-tight">Automação IA</h3>
                            <p className={`text-sm font-light leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                Processos inteligentes que trabalham por você 24h.
                            </p>
                        </div>
                    </AnimatedSection>

                    {/* Square Card 2 */}
                    <AnimatedSection delay={300} className="md:col-span-4 md:row-span-1">
                        <div className={`h-full rounded-[2.5rem] border p-8 flex flex-col justify-center transition-all duration-500 hover:shadow-2xl ${isDark ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
                            }`}>
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-5 ${isDark ? "bg-amber-500/10 text-amber-500" : "bg-amber-50 text-amber-600"}`}>
                                <BarChart3 className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-bold mb-2 tracking-tight">Métricas Reais</h3>
                            <p className={`text-sm font-light leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                Dados precisos para decisões rápidas e seguras.
                            </p>
                        </div>
                    </AnimatedSection>

                    {/* Long Card 2 */}
                    <AnimatedSection delay={400} className="md:col-span-6 md:row-span-1">
                        <div className={`h-full rounded-[2rem] border p-8 flex items-center gap-6 transition-all duration-500 hover:shadow-2xl ${isDark ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
                            }`}>
                            <div className={`h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center ${isDark ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600"}`}>
                                <TrendingUp className="h-7 w-7" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-1 tracking-tight">Escalabilidade</h3>
                                <p className={`text-sm font-light ${isDark ? "text-slate-400" : "text-slate-600"}`}>Cresça sua equipe sem perder o controle do atendimento.</p>
                            </div>
                        </div>
                    </AnimatedSection>

                    {/* Long Card 3 */}
                    <AnimatedSection delay={500} className="md:col-span-6 md:row-span-1">
                        <div className={`h-full rounded-[2rem] border p-8 flex items-center gap-6 transition-all duration-500 hover:shadow-2xl ${isDark ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
                            }`}>
                            <div className={`h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center ${isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"}`}>
                                <Brain className="h-7 w-7" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-1 tracking-tight">IA Prática</h3>
                                <p className={`text-sm font-light ${isDark ? "text-slate-400" : "text-slate-600"}`}>Integre agentes de IA de forma nativa e descomplicada.</p>
                            </div>
                        </div>
                    </AnimatedSection>
                </div>
            </div>
        </section>
    );
}
