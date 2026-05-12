import { CheckCircle2 } from "lucide-react";
import { FEATURE_SECTIONS } from "@/constants/landing-data";
import { AnimatedSection } from "./AnimatedSection";

export function FeaturesSection({ isDark }: { isDark: boolean }) {
    return (
        <>
            <div id="funcionalidades" className="py-4" />
            {FEATURE_SECTIONS.map((f, i) => (
                <section key={f.title} className={`py-20 md:py-24 relative overflow-hidden ${isDark ? (i % 2 === 0 ? "bg-[#0B1120]" : "bg-[#0A0F1D]") : (i % 2 === 0 ? "bg-white" : "bg-[#F8FAFC]")}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <AnimatedSection>
                            <div className={`flex flex-col md:flex-row gap-16 lg:gap-24 items-center ${i % 2 !== 0 ? "md:flex-row-reverse" : ""}`}>
                                {/* Image / Visual Container */}
                                <div className="w-full md:w-1/2 relative">
                                    <div className={`absolute -inset-4 rounded-[2.5rem] blur-2xl opacity-20 ${isDark ? "bg-emerald-500/10" : "bg-emerald-500/5"}`} />
                                    {f.image ? (
                                        <div
                                            className={`relative rounded-[2rem] border overflow-hidden shadow-heavy glass-card p-1 ${isDark ? "border-white/10" : "border-slate-200"}`}
                                            style={{ animation: 'floatingScreenshot 10s ease-in-out infinite' }}
                                        >
                                            <div className={`absolute top-0 left-0 right-0 h-8 backdrop-blur-md border-b flex items-center gap-2 px-4 ${isDark ? "bg-slate-900/80 border-white/5" : "bg-slate-50/80 border-slate-200"}`}>
                                                <div className="flex gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
                                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                                                </div>
                                            </div>
                                            <img src={f.image} alt={f.title} className="w-full mt-8 object-cover object-top hover:scale-[1.02] transition-transform duration-700" />
                                        </div>
                                    ) : (
                                        <div className={`relative rounded-[2.5rem] border p-12 flex flex-col items-center justify-center min-h-[320px] glass-card ${isDark ? "border-white/10" : "border-slate-200"}`}>
                                            <div className={`h-24 w-24 rounded-3xl flex items-center justify-center mb-6 ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
                                                <span className="text-5xl">{f.emoji}</span>
                                            </div>
                                            <p className={`text-lg font-bold text-center ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>{f.title}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Content Side */}
                                <div className="w-full md:w-1/2 space-y-8">
                                    <div className="space-y-4">
                                        <span className={`inline-block text-[10px] font-bold tracking-[0.2em] uppercase ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                                            {f.subtitle || "Recurso Inteligente"}
                                        </span>
                                        <h3 className={`text-3xl md:text-4xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                                            {f.title}
                                        </h3>
                                        <p className={`text-lg font-light leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                            {f.description}
                                        </p>
                                    </div>

                                    <ul className="space-y-4">
                                        {f.bullets.map((b) => (
                                            <li key={b} className="flex items-start gap-4 group">
                                                <div className={`mt-1 h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${isDark ? "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"}`}>
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </div>
                                                <span className={`text-base font-light leading-snug ${isDark ? "text-slate-300" : "text-slate-600"}`}>{b}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {f.footer && (
                                        <div className={`p-4 rounded-2xl italic text-sm font-medium border-l-4 ${isDark ? "bg-slate-900/50 border-emerald-500/40 text-emerald-400" : "bg-emerald-50 border-emerald-500/40 text-emerald-700"}`}>
                                            "{f.footer}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </AnimatedSection>
                    </div>
                </section>
            ))}
        </>
    );
}
