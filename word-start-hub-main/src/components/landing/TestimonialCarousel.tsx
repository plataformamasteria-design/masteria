import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { TESTIMONIALS } from "@/constants/landing-data";

export function TestimonialCarousel({ isDark }: { isDark: boolean }) {
    const [current, setCurrent] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();
    const cardBg = isDark ? "bg-[#111827]/60 border-[#1e2a3a]" : "bg-white border-[#e5e8ee]";
    const mutedText = isDark ? "text-[#8892a8]" : "text-[#5a6478]";
    const perPage = 3;
    const total = TESTIMONIALS.length;

    const startAutoplay = useCallback(() => {
        intervalRef.current = setInterval(() => setCurrent((p) => (p + 1) % total), 4000);
    }, [total]);

    useEffect(() => { startAutoplay(); return () => clearInterval(intervalRef.current); }, [startAutoplay]);

    const go = (dir: number) => { clearInterval(intervalRef.current); setCurrent((p) => (p + dir + total) % total); startAutoplay(); };

    // Get visible testimonials with wrapping
    const getVisible = () => {
        const items = [];
        for (let i = 0; i < perPage; i++) {
            items.push(TESTIMONIALS[(current + i) % total]);
        }
        return items;
    };

    return (
        <div className="relative">
            <div className="flex items-center gap-4">
                <button onClick={() => go(-1)} className={`shrink-0 p-2.5 rounded-full border transition-colors ${isDark ? "border-[#1e2a3a] hover:bg-[#1e2a3a] text-[#8892a8]" : "border-[#e5e8ee] hover:bg-[#f0f2f7] text-[#5a6478]"}`}>
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="hidden md:grid md:grid-cols-3 gap-4">
                        {getVisible().map((t, idx) => (
                            <div key={`${current}-${idx}`} className={`rounded-2xl border p-6 space-y-4 transition-all duration-500 ${cardBg}`}>
                                <div className="flex gap-0.5">
                                    {Array.from({ length: t.stars }).map((_, j) => (
                                        <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                <p className={`text-[13px] leading-relaxed font-light italic ${mutedText}`}>"{t.text}"</p>
                                <div className="flex items-center gap-3 pt-2">
                                    <img src={t.photo} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                                    <div>
                                        <p className="text-[13px] font-medium">{t.name}</p>
                                        <p className={`text-[11px] ${mutedText}`}>{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="md:hidden">
                        {(() => {
                            const t = TESTIMONIALS[current]; return (
                                <div className={`rounded-2xl border p-6 space-y-4 ${cardBg} shadow-lg`}>
                                    <div className="flex gap-0.5">
                                        {Array.from({ length: t.stars }).map((_, j) => (
                                            <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                        ))}
                                    </div>
                                    <p className={`text-[13px] leading-relaxed font-light italic ${mutedText}`}>"{t.text}"</p>
                                    <div className="flex items-center gap-3 pt-2">
                                        <img src={t.photo} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                                        <div>
                                            <p className="text-[13px] font-medium">{t.name}</p>
                                            <p className={`text-[11px] ${mutedText}`}>{t.role}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
                <button onClick={() => go(1)} className={`shrink-0 p-2.5 rounded-full border transition-colors ${isDark ? "border-[#1e2a3a] hover:bg-[#1e2a3a] text-[#8892a8]" : "border-[#e5e8ee] hover:bg-[#f0f2f7] text-[#5a6478]"}`}>
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
            <div className="flex justify-center gap-1.5 mt-6">
                {TESTIMONIALS.map((_, i) => (
                    <button key={i} onClick={() => { clearInterval(intervalRef.current); setCurrent(i); startAutoplay(); }} className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? `w-6 ${isDark ? "bg-emerald-400" : "bg-emerald-600"}` : `w-1.5 ${isDark ? "bg-[#1e2a3a]" : "bg-[#d0d5dd]"}`}`} />
                ))}
            </div>
        </div>
    );
}
