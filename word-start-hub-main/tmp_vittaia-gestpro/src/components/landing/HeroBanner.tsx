import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Star, Zap, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import vittaIcon from "@/assets/vitta-icon.png";
import testimonialMaria from "@/assets/testimonial-maria.jpg";
import testimonialCarlos from "@/assets/testimonial-carlos.jpg";
import testimonialAna from "@/assets/testimonial-ana.jpg";
import dashboardPreview from "@/assets/screenshots/dashboard.png";
import { HERO_SLIDES, NAV_LINKS } from "@/constants/landing-data";
import { AnimatedSection } from "./AnimatedSection";

export function HeroBanner({ isDark }: { isDark: boolean }) {
    const [current, setCurrent] = useState(0);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();

    const startAutoplay = useCallback(() => {
        intervalRef.current = setInterval(() => setCurrent((p) => (p + 1) % HERO_SLIDES.length), 12000);
    }, []);

    useEffect(() => { startAutoplay(); return () => clearInterval(intervalRef.current); }, [startAutoplay]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const { left, top, width, height } = (containerRef.current as any).getBoundingClientRect();
        setMousePos({
            x: ((e.clientX - left) / width - 0.5) * 20,
            y: ((e.clientY - top) / height - 0.5) * 20,
        });
    };

    const goTo = (i: number) => {
        clearInterval(intervalRef.current);
        setCurrent(i);
        startAutoplay();
    };

    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <section
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="relative overflow-hidden min-h-[95vh] flex items-center pt-20"
        >
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
                    scrolled ? (isDark ? "bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 py-3" : "bg-white/80 backdrop-blur-2xl border-b border-slate-200 py-3") : "bg-transparent py-5"
                )}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <Link to="/" className="flex items-center group">
                        <div className="relative">
                            <div className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img src={vittaIcon} alt="Vitta" className="h-10 w-10 relative" />
                        </div>
                    </Link>

                    <nav className="hidden md:flex items-center gap-10">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className={cn(
                                    "text-[13px] font-medium tracking-wide transition-all hover:text-emerald-400 relative group",
                                    isDark ? "text-slate-300" : "text-slate-600"
                                )}
                            >
                                {link.name}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all group-hover:w-full" />
                            </a>
                        ))}
                    </nav>

                    <div className="hidden md:flex items-center gap-2.5">
                        <Link to="/trial">
                            <Button size="sm" variant="outline" className={`rounded-full px-5 h-9 text-[13px] font-bold tracking-wide ${isDark ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" : "border-emerald-500 text-emerald-600 hover:bg-emerald-50"}`}>
                                Teste Grátis
                            </Button>
                        </Link>
                        <Link to="/auth">
                            <Button size="sm" className={`rounded-full px-5 h-9 text-[13px] font-bold tracking-wide ${isDark ? "bg-emerald-500 text-[#0a0f1a] hover:bg-emerald-400" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                                Login
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>
            {/* Premium Mesh Gradient Background */}
            <div className="absolute inset-0 z-0">
                <div className={`absolute inset-0 transition-colors duration-1000 ${isDark ? "bg-[#0B1120]" : "bg-[#F8FAFC]"}`} />

                {/* Animated Gradient Blobs */}
                <div
                    className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-40 animate-pulse"
                    style={{
                        background: `radial-gradient(circle, ${isDark ? "hsla(156, 100%, 45%, 0.3)" : "hsla(156, 72%, 40%, 0.15)"} 0%, transparent 70%)`,
                        transform: `translate(${mousePos.x * -0.5}px, ${mousePos.y * -0.5}px)`
                    }}
                />
                <div
                    className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[140px] opacity-30"
                    style={{
                        background: `radial-gradient(circle, ${isDark ? "hsla(186, 100%, 40%, 0.25)" : "hsla(175, 60%, 42%, 0.12)"} 0%, transparent 70%)`,
                        transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)`
                    }}
                />

                {/* Subtle Grid Pattern */}
                <div className={`absolute inset-0 opacity-[0.03] ${isDark ? "invert" : ""}`}
                    style={{ backgroundImage: `radial-gradient(circle at 2px 2px, #000 1px, transparent 0)`, backgroundSize: '48px 48px' }}
                />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="grid lg:grid-cols-2 gap-12 items-center">

                    {/* Text Content Area */}
                    <div className="text-left space-y-8">
                        <AnimatedSection delay={100}>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold tracking-[0.15em] uppercase backdrop-blur-md border ${isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                }`}>
                                <Sparkles className="h-3.5 w-3.5" />
                                Inteligência Artificial de Próxima Geração
                            </div>
                        </AnimatedSection>

                        <div className="relative h-[280px] md:h-[340px] lg:h-[400px]">
                            {HERO_SLIDES.map((slide, i) => (
                                <div
                                    key={i}
                                    className="absolute inset-0 transition-all duration-1000 ease-in-out"
                                    style={{
                                        opacity: i === current ? 1 : 0,
                                        transform: i === current ? 'translateY(0)' : 'translateY(30px)',
                                        zIndex: i === current ? 10 : 0,
                                        pointerEvents: i === current ? 'auto' : 'none'
                                    }}
                                >
                                    <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                                        {slide.headline}
                                    </h1>
                                    <p className={`mt-6 text-base md:text-lg lg:text-xl font-light leading-relaxed max-w-xl ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                        {slide.subtitle}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <AnimatedSection delay={400}>
                            <div className="flex flex-col sm:flex-row items-center gap-6 pt-8 md:pt-12">
                                <Link to="/trial" className="w-full sm:w-auto">
                                    <Button size="lg" className={`w-full sm:w-auto rounded-full px-10 h-16 text-base font-bold tracking-wide gap-3 group overflow-hidden relative shadow-2xl transition-all hover:scale-[1.03] active:scale-95 ${isDark ? "bg-emerald-500 text-[#0a0f1a] hover:bg-emerald-400 shadow-emerald-500/25" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                                        }`}>
                                        <span className="relative z-10 flex items-center gap-2">
                                            Começar Agora <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                        </span>
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    </Button>
                                </Link>

                                <a href="#funcionalidades" className="w-full sm:w-auto">
                                    <Button variant="outline" size="lg" className={`w-full sm:w-auto rounded-full px-10 h-16 text-base font-semibold backdrop-blur-md border transition-all hover:bg-white/5 active:scale-95 ${isDark ? "border-slate-700 text-slate-300 hover:text-white" : "border-slate-200 text-slate-600 hover:text-slate-900"
                                        }`}>
                                        Ver Funcionalidades
                                    </Button>
                                </a>
                            </div>
                        </AnimatedSection>

                        <AnimatedSection delay={600}>
                            <div className="flex items-center gap-4 pt-4">
                                <div className="flex -space-x-3">
                                    {[testimonialMaria, testimonialCarlos, testimonialAna].map((p, i) => (
                                        <img key={i} src={p} alt="User" className="w-10 h-10 rounded-full border-2 border-background object-cover shadow-lg" />
                                    ))}
                                </div>
                                <div className="text-sm">
                                    <div className="flex gap-0.5 text-amber-500">
                                        {[1, 2, 3, 4, 5].map(s => <Star key={s} className="h-3 w-3 fill-current" />)}
                                    </div>
                                    <p className={`font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                        <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>+500</span> empresas escalando
                                    </p>
                                </div>
                            </div>
                        </AnimatedSection>
                    </div>

                    {/* Visual Element Area */}
                    <div className="hidden lg:block relative">
                        <AnimatedSection delay={300} className="relative z-20">
                            <div className={`relative p-2 rounded-[2.5rem] border bg-gradient-to-br shadow-3xl ${isDark ? "from-emerald-500/20 to-cyan-500/10 border-white/10" : "from-emerald-100 to-cyan-50 border-emerald-200/50"}`}>
                                <div className={`rounded-[2rem] overflow-hidden border shadow-inner ${isDark ? "border-white/5 bg-slate-900" : "border-white bg-white"}`}>
                                    <img
                                        src={dashboardPreview}
                                        alt="Platform Preview"
                                        className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity duration-700"
                                        style={{ animation: 'floatingScreenshot 8s ease-in-out infinite' }}
                                    />
                                </div>

                                {/* Floating Widget 1 */}
                                <div
                                    className={`absolute -top-6 -right-6 p-4 rounded-2xl glass-card animate-float shadow-2xl`}
                                    style={{ animationDelay: '1s' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                            <Zap className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider font-bold opacity-60">Automação</p>
                                            <p className="text-sm font-bold">Fluxo Ativado</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Widget 2 */}
                                <div
                                    className={`absolute -bottom-10 -left-10 p-5 rounded-3xl glass-card animate-float shadow-2xl`}
                                    style={{ animationDelay: '0.5s' }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-500">
                                            <BarChart3 className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold opacity-60">Performance</p>
                                            <p className="text-lg font-bold">124% <span className="text-[10px] text-emerald-500">↑</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Rings */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-emerald-500/5 rounded-full -z-10 animate-[spin_60s_linear_infinite]" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] border border-cyan-500/5 rounded-full -z-10 animate-[spin_40s_linear_infinite_reverse]" />
                        </AnimatedSection>
                    </div>
                </div>
            </div>

            {/* Hero Navigation Dots */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3 z-20">
                {HERO_SLIDES.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => goTo(i)}
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === current
                            ? `w-12 ${isDark ? "bg-emerald-400" : "bg-emerald-600"}`
                            : `w-3 ${isDark ? "bg-slate-700" : "bg-slate-300"}`
                            }`}
                    />
                ))}
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
                <div className={`w-1 h-8 rounded-full ${isDark ? "bg-slate-600" : "bg-slate-400"}`} />
            </div>
        </section>
    );
}
