import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MODULES_CAROUSEL } from "@/constants/landing-data";

export function ModuleCarousel({ isDark }: { isDark: boolean }) {
    const [current, setCurrent] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();

    const accent = isDark ? "text-emerald-400" : "text-emerald-600";
    const accentBg = isDark ? "bg-emerald-500/10" : "bg-emerald-50";
    const mutedText = isDark ? "text-slate-400" : "text-slate-500";

    const startAutoplay = useCallback(() => {
        intervalRef.current = setInterval(() => setCurrent((p) => (p + 1) % MODULES_CAROUSEL.length), 4000);
    }, []);

    useEffect(() => { startAutoplay(); return () => clearInterval(intervalRef.current); }, [startAutoplay]);

    const go = (dir: number) => {
        clearInterval(intervalRef.current);
        setCurrent((p) => (p + dir + MODULES_CAROUSEL.length) % MODULES_CAROUSEL.length);
        startAutoplay();
    };

    const getVisible = () => {
        const items = [];
        for (let i = -1; i <= 1; i++) items.push({ mod: MODULES_CAROUSEL[(current + i + MODULES_CAROUSEL.length) % MODULES_CAROUSEL.length], offset: i });
        return items;
    };

    return (
        <div className="relative pt-8">
            <div className="flex items-center gap-6">
                <button onClick={() => go(-1)} className={`shrink-0 p-3 rounded-full border transition-all active:scale-90 ${isDark ? "border-white/10 hover:bg-white/5 text-slate-400" : "border-slate-200 hover:bg-slate-50 text-slate-500"}`}>
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <div className="flex-1 min-w-0 py-10">
                    <div className="hidden md:grid md:grid-cols-3 gap-8">
                        {getVisible().map(({ mod, offset }) => (
                            <div key={`${mod.name}-${offset}`} className={`rounded-[2rem] border p-8 space-y-5 transition-all duration-700 glass-card ${offset === 0 ? "scale-[1.1] shadow-glow-primary z-10" : "opacity-40 scale-90"}`}>
                                <div className={`h-16 w-16 rounded-[1.25rem] flex items-center justify-center ${accentBg} ${accent} shadow-inner`}>{mod.icon}</div>
                                <h3 className="text-xl font-bold tracking-tight">{mod.name}</h3>
                                <p className={`text-sm leading-relaxed font-light ${mutedText}`}>{mod.description}</p>
                            </div>
                        ))}
                    </div>
                    <div className="md:hidden">
                        {(() => {
                            const mod = MODULES_CAROUSEL[current]; return (
                                <div className={`rounded-[2rem] border p-10 space-y-6 glass-card shadow-glow-primary`}>
                                    <div className={`h-16 w-16 rounded-[1.25rem] flex items-center justify-center ${accentBg} ${accent}`}>{mod.icon}</div>
                                    <h3 className="text-2xl font-bold tracking-tight">{mod.name}</h3>
                                    <p className={`text-base leading-relaxed font-light ${mutedText}`}>{mod.description}</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
                <button onClick={() => go(1)} className={`shrink-0 p-3 rounded-full border transition-all active:scale-90 ${isDark ? "border-white/10 hover:bg-white/5 text-slate-400" : "border-slate-200 hover:bg-slate-50 text-slate-500"}`}>
                    <ChevronRight className="h-6 w-6" />
                </button>
            </div>
            <div className="flex justify-center gap-2 mt-4">
                {MODULES_CAROUSEL.map((_, i) => (
                    <button key={i} onClick={() => { clearInterval(intervalRef.current); setCurrent(i); startAutoplay(); }} className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? `w-10 ${isDark ? "bg-emerald-400" : "bg-emerald-600"}` : `w-1.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}`} />
                ))}
            </div>
        </div>
    );
}
