import { useRef, useEffect, useState, useCallback } from "react";
import heroRobotBg from "@/assets/hero-robot-bg.jpg";
import heroAtendimentoBg from "@/assets/hero-atendimento-bg.jpg";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteLayout, { useSiteThemeContext } from "@/components/site/SiteLayout";
import {
  MessageSquare, BarChart3, Zap, Brain, Calendar, DollarSign,
  Users, Send, CheckCircle2, Star, ArrowRight,
  Kanban, Bot, ListTodo, Phone, ChevronLeft, ChevronRight,
  Target, Palette, Settings, Shield, Rocket, TrendingUp,
  Layout, Tag, Sparkles, FileText, Clock, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import vittaIcon from "@/assets/vitta-icon.png";
import testimonialMaria from "@/assets/testimonial-maria.jpg";
import testimonialCarlos from "@/assets/testimonial-carlos.jpg";
import testimonialAna from "@/assets/testimonial-ana.jpg";
import testimonialJuliana from "@/assets/testimonial-juliana.jpg";
import testimonialRoberto from "@/assets/testimonial-roberto.jpg";
import testimonialFernanda from "@/assets/testimonial-fernanda.jpg";
import testimonialLucas from "@/assets/testimonial-lucas.jpg";
import testimonialPatricia from "@/assets/testimonial-patricia.jpg";
import dashboardPreview from "@/assets/screenshots/dashboard.png";
import chatPreview from "@/assets/screenshots/chat.png";
import agendaPreview from "@/assets/screenshots/agenda.png";
import comandosPreview from "@/assets/screenshots/comandos.png";
import relatoriosPreview from "@/assets/screenshots/relatorios.png";
import crmPreview from "@/assets/screenshots/crm.png";
import automacaoPreview from "@/assets/screenshots/automacao.png";
import disparosPreview from "@/assets/screenshots/disparos.png";
import financeiroPreview from "@/assets/screenshots/financeiro.png";
import equipesPreview from "@/assets/screenshots/equipes.png";
import coresPreview from "@/assets/screenshots/cores.png";

/* ─── DATA ─── */
import {
  FEATURE_SECTIONS, MODULES_CAROUSEL, NAV_LINKS,
  MODULE_PLANS, TESTIMONIALS, HERO_SLIDES
} from "@/constants/landing-data";



import { useInView, AnimatedSection } from "@/components/landing/AnimatedSection";
import { ModuleCarousel } from "@/components/landing/ModuleCarousel";
import { TestimonialCarousel } from "@/components/landing/TestimonialCarousel";
import { HeroBanner } from "@/components/landing/HeroBanner";
import { DiferenciaisSection } from "@/components/landing/DiferenciaisSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PlansSection } from "@/components/landing/PlansSection";


function LandingContent() {
  const { isDark } = useSiteThemeContext();

  const sectionBg = (v: 1 | 2 | 3) => {
    if (isDark) return v === 1 ? "bg-[#0a0f1a]" : v === 2 ? "bg-[#0d1220]" : "bg-[#080c16]";
    return v === 1 ? "bg-[#fafbfd]" : v === 2 ? "bg-[#f0f2f7]" : "bg-white";
  };

  const cardBg = isDark ? "bg-[#111827]/60 border-[#1e2a3a]" : "bg-white border-[#e5e8ee]";
  const mutedText = isDark ? "text-[#8892a8]" : "text-[#3a4050]";
  const accent = isDark ? "text-emerald-400" : "text-emerald-600";
  const accentBg = isDark ? "bg-emerald-500/10" : "bg-emerald-50";

  return (
    <>
      {/* ─── HERO CAROUSEL ─── */}
      <HeroBanner isDark={isDark} />

      <DiferenciaisSection isDark={isDark} />

      <FeaturesSection isDark={isDark} />

      {/* ─── MÓDULOS CAROUSEL ─── */}
      <section id="modulos" className={`py-20 md:py-28 ${sectionBg(2)}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-14">
              <p className={`text-[12px] font-semibold tracking-[0.2em] uppercase mb-3 ${accent}`}>🔧 Módulos Disponíveis</p>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight">
                Você ativa <span className="font-semibold">quando precisar</span>
              </h2>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={100}>
            <ModuleCarousel isDark={isDark} />
          </AnimatedSection>
        </div>
      </section>

      <PlansSection isDark={isDark} />

      {/* ─── DEPOIMENTOS (Carousel) ─── */}
      <section className={`py-20 md:py-28 ${sectionBg(2)}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-14">
              <p className={`text-[12px] font-semibold tracking-[0.2em] uppercase mb-3 ${accent}`}>Depoimentos</p>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight">
                O que nossos clientes <span className="font-semibold">dizem</span>
              </h2>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={100}>
            <TestimonialCarousel isDark={isDark} />
          </AnimatedSection>
        </div>
      </section>

      {/* ─── CTA FINAL (Premium Glass Redesign) ─── */}
      <section className={`py-28 md:py-40 relative overflow-hidden ${isDark ? "bg-[#0B1120]" : "bg-white"}`}>
        {/* Floating Abstract Element */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 opacity-10 pointer-events-none">
          <div className="w-[800px] h-[800px] bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-[120px] rounded-full animate-pulse" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimatedSection>
            <div
              className={`relative rounded-[3.5rem] p-12 md:p-24 text-center space-y-10 border overflow-hidden ${isDark
                ? "bg-slate-900/60 border-white/10 shadow-3xl"
                : "bg-white border-slate-200 shadow-3xl"
                }`}
              style={{ backdropFilter: "blur(40px) saturate(200%)" }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />

              <div className="space-y-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>
                  <Rocket className="h-3 w-3" /> Comece sua jornada
                </div>
                <h2 className={`text-4xl md:text-6xl font-black tracking-tight leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Pronto para escalar com <br className="hidden md:block" /><span className="gradient-text">Inteligência Real?</span>
                </h2>
                <p className={`max-w-2xl mx-auto text-lg md:text-xl font-light leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Junte-se a centenas de empresas que já transformaram seu atendimento e vendas com a Vitta IA.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Link to="/trial" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto rounded-full px-10 h-16 text-base font-bold tracking-wide shadow-2xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 bg-emerald-500 text-slate-900 hover:bg-emerald-400 border-none"
                  >
                    Começar Agora <Zap className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a href="#funcionalidades" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto rounded-full px-10 h-16 text-base font-bold tracking-wide transition-all hover:bg-white/5 border-white/20 text-white backdrop-blur-sm"
                  >
                    Ver Funcionalidades
                  </Button>
                </a>
              </div>

              <div className="pt-8 flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                <div className="flex items-center gap-2 font-black text-xl italic tracking-tighter">SAFE PAY</div>
                <div className="flex items-center gap-2 font-black text-xl italic tracking-tighter">TRUSTED AI</div>
                <div className="flex items-center gap-2 font-black text-xl italic tracking-tighter">24/7 SUPPORT</div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── CONTATO ─── */}
      <section id="contato" className={`py-16 ${isDark ? "bg-slate-900 border-t border-white/5" : "bg-emerald-600"}`}>
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <h2 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-white"}`}>
            Ficou com alguma dúvida?
          </h2>
          <p className={isDark ? "text-slate-400 font-light" : "text-emerald-100 font-light"}>
            Fale conosco pelo WhatsApp: (88) 9 2000-8007
          </p>
          <a href="https://wa.me/5588920008007" target="_blank" rel="noopener noreferrer">
            <Button size="lg" className={`rounded-full px-8 h-12 mt-2 gap-2 text-[13px] font-medium tracking-wide ${isDark ? "bg-emerald-500 text-[#0a0f1a] hover:bg-emerald-400 shadow-lg shadow-emerald-500/20" : "bg-[#0a2618] text-white hover:bg-[#143d24]"}`}>
              <Phone className="h-4 w-4" /> Fale Conosco
            </Button>
          </a>
        </div>
      </section>
    </>
  );
}

export default function LandingPage() {
  return (
    <SiteLayout hideNavbar={true}>
      <LandingContent />
    </SiteLayout>
  );
}
