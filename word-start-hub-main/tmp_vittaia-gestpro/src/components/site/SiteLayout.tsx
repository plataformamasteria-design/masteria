import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import vittaIcon from "@/assets/vitta-icon.png";

const NAV_LINKS = [
  { label: "Módulos", href: "/#modulos" },
  { label: "Funcionalidades", href: "/#funcionalidades" },
  { label: "Planos", href: "/#planos" },
  { label: "Contato", href: "/#contato" },
];

function useSiteTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("site-theme");
    if (saved === "dark") return "dark";
    return "light";
  });

  useEffect(() => {
    localStorage.setItem("site-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((p) => (p === "dark" ? "light" : "dark"));
  return { theme, toggle };
}

export default function SiteLayout({ children, hideNavbar = false }: { children: React.ReactNode, hideNavbar?: boolean }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const { theme, toggle } = useSiteTheme();
  const isDark = theme === "dark";

  // Isolate site from platform theme: temporarily remove dark class from html/body
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const wasDark = root.classList.contains("dark");
    // Strip platform theme classes
    root.classList.remove("dark");
    body.classList.remove("dark");
    // Reset any inline CSS vars the platform may have set on body
    const prevBg = body.style.background;
    body.style.background = "none";

    return () => {
      // Restore platform theme when leaving site pages
      if (wasDark) {
        root.classList.add("dark");
        body.classList.add("dark");
      }
      body.style.background = prevBg;
    };
  }, []);

  return (
    <div
      className={`min-h-screen font-['Montserrat',sans-serif] transition-colors duration-300 ${isDark
        ? "bg-[#0a0f1a] text-[#e8ecf4]"
        : "bg-[#fafbfd] text-[#1a1f2e]"
        }`}
    >
      {/* ─── NAVBAR ─── */}
      {!hideNavbar && (
        <nav
          className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-300 ${isDark
            ? "bg-[#0a0f1a]/80 border-[#1e2a3a]"
            : "bg-[#fafbfd]/80 border-[#e5e8ee]"
            }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center shrink-0">
              <img src={vittaIcon} alt="Vitta" className="h-8 w-8" />
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-6">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className={`text-[12px] font-medium tracking-widest uppercase transition-colors whitespace-nowrap ${isDark
                    ? "text-[#8892a8] hover:text-emerald-400"
                    : "text-[#5a6478] hover:text-emerald-600"
                    }`}
                >
                  {l.label}
                </a>
              ))}
            </div>

            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-2.5 shrink-0">
              <button
                onClick={toggle}
                className={`p-2 rounded-full transition-colors ${isDark ? "text-[#8892a8] hover:text-white hover:bg-[#1e2a3a]" : "text-[#5a6478] hover:text-[#1a1f2e] hover:bg-[#e5e8ee]"
                  }`}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link to="/trial">
                <Button
                  variant="outline"
                  className={`rounded-full px-4 h-9 text-[12px] font-medium tracking-wide border transition-colors ${isDark
                    ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                    : "border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                    }`}
                >
                  Teste Grátis
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  className={`rounded-full px-4 h-9 text-[12px] font-medium tracking-wide ${isDark
                    ? "bg-emerald-500 hover:bg-emerald-400 text-[#0a0f1a]"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                >
                  Login
                </Button>
              </Link>
            </div>

            {/* Tablet: show buttons but hide nav links */}
            <div className="hidden md:flex lg:hidden items-center gap-2 shrink-0">
              <button onClick={toggle} className={`p-2 rounded-full ${isDark ? "text-[#8892a8]" : "text-[#5a6478]"}`}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link to="/trial">
                <Button variant="outline" className={`rounded-full px-3 h-8 text-[11px] font-medium ${isDark ? "border-emerald-500/40 text-emerald-400" : "border-emerald-500 text-emerald-600"}`}>
                  Teste Grátis
                </Button>
              </Link>
              <Link to="/auth">
                <Button className={`rounded-full px-3 h-8 text-[11px] font-medium ${isDark ? "bg-emerald-500 text-[#0a0f1a]" : "bg-emerald-600 text-white"}`}>
                  Login
                </Button>
              </Link>
              <button className="p-2 ml-1" onClick={() => setMobileMenu(!mobileMenu)}>
                {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            {/* Mobile hamburger */}
            <div className="flex md:hidden items-center gap-1.5">
              <button onClick={toggle} className={`p-1.5 rounded-full ${isDark ? "text-[#8892a8]" : "text-[#5a6478]"}`}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button className="p-1.5" onClick={() => setMobileMenu(!mobileMenu)}>
                {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile/Tablet dropdown */}
          {mobileMenu && (
            <div className={`lg:hidden border-t px-4 pb-4 pt-2 space-y-2 ${isDark ? "bg-[#0a0f1a] border-[#1e2a3a]" : "bg-[#fafbfd] border-[#e5e8ee]"}`}>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className={`block text-sm py-2.5 font-medium ${isDark ? "text-[#8892a8]" : "text-[#5a6478]"}`} onClick={() => setMobileMenu(false)}>
                  {l.label}
                </a>
              ))}
              <div className="flex gap-2 pt-3 md:hidden">
                <Link to="/trial" className="flex-1" onClick={() => setMobileMenu(false)}>
                  <Button variant="outline" className={`w-full rounded-full text-sm h-10 ${isDark ? "border-emerald-500/40 text-emerald-400" : "border-emerald-500 text-emerald-600"}`}>
                    Teste Grátis
                  </Button>
                </Link>
                <Link to="/auth" className="flex-1" onClick={() => setMobileMenu(false)}>
                  <Button className={`w-full rounded-full text-sm h-10 ${isDark ? "bg-emerald-500 text-[#0a0f1a]" : "bg-emerald-600 text-white"}`}>
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </nav>
      )}

      {/* Content */}
      <SiteThemeContext.Provider value={{ isDark, toggle }}>
        {children}
      </SiteThemeContext.Provider>

      {/* ─── FOOTER ─── */}
      <footer className={`py-12 border-t transition-colors ${isDark ? "bg-[#051a0e] border-[#0d2e18] text-[#5a7a68]" : "bg-[#0a2618] border-[#143d24] text-[#8aaa98]"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src={vittaIcon} alt="Vitta" className="h-7 w-7" />
                <span className="text-lg font-semibold text-white">Vitta</span>
              </div>
              <p className="text-sm leading-relaxed">Plataforma completa de gestão de atendimento, vendas e automação com IA.</p>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3 tracking-wide uppercase">Contato</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:contato@vitta.com" className="hover:text-white transition-colors">contato@vitta.com</a></li>
                <li><a href="https://wa.me/5588920008007" className="hover:text-white transition-colors">(88) 9 2000-8007</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3 tracking-wide uppercase">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Política de Privacidade</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Termos de Uso</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3 tracking-wide uppercase">Redes</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-white transition-colors">WhatsApp</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#1a4d2e] mt-8 pt-6 text-center text-xs">
            Vitta © {new Date().getFullYear()} todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

// Context for child pages
import { createContext, useContext } from "react";

interface SiteThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

export const SiteThemeContext = createContext<SiteThemeContextType>({
  isDark: false,
  toggle: () => { },
});

export const useSiteThemeContext = () => useContext(SiteThemeContext);
