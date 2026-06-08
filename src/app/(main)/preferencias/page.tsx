'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { SlidersHorizontal, Bell, Monitor, Moon, Sun, Volume2, VolumeX, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'masteriaPrefs';

interface Prefs {
  language: string;
  compactMode: boolean;
  animations: boolean;
  sidebar: string;
  emailNotif: boolean;
  pushNotif: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  newLeadNotif: boolean;
  messageNotif: boolean;
  campaignNotif: boolean;
  aiNotif: boolean;
}

const DEFAULT_PREFS: Prefs = {
  language: 'pt-br', compactMode: false, animations: true, sidebar: 'auto',
  emailNotif: true, pushNotif: true, soundEnabled: true, soundVolume: 70,
  newLeadNotif: true, messageNotif: true, campaignNotif: false, aiNotif: true,
};

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        {desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-emerald-500" />
    </div>
  );
}

function SectionCard({ icon: Icon, color, title, desc, children }: {
  icon: React.ElementType; color: string; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl shadow-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={cn('p-2 rounded-xl', color)}><Icon className="h-5 w-5" /></div>
        <div><h3 className="text-white font-bold text-sm">{title}</h3><p className="text-zinc-500 text-xs">{desc}</p></div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function PreferenciasPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    setMounted(true);
    const loaded = loadPrefs();
    setPrefs(loaded);
    // Aplicar atributos salvos imediatamente
    applyPrefsToDOM(loaded);
  }, []);

  function applyPrefsToDOM(p: Prefs) {
    document.documentElement.setAttribute('data-compact', String(p.compactMode));
    document.documentElement.setAttribute('data-animations', String(p.animations));
    document.documentElement.setAttribute('data-sidebar', p.sidebar);
  }

  const set = <K extends keyof Prefs>(key: K, val: Prefs[K]) => setPrefs(p => ({ ...p, [key]: val }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    applyPrefsToDOM(prefs);
    toast({ title: 'Preferências Salvas ✓', description: 'Suas configurações foram aplicadas imediatamente.' });
  };

  const themeOptions = [
    { value: 'dark', icon: Moon, label: 'Escuro' },
    { value: 'light', icon: Sun, label: 'Claro' },
    { value: 'system', icon: Monitor, label: 'Sistema' },
  ];

  const currentTheme = mounted ? (theme || 'dark') : 'dark';

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Preferências" description="Personalize sua experiência no MasterIA." icon={SlidersHorizontal} />

      {/* ── Aparência ── */}
      <SectionCard icon={Monitor} color="bg-purple-500/10 text-purple-400" title="Aparência" desc="Tema visual e layout">
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Tema</Label>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ value, icon: Icon, label }) => (
              <button key={value} onClick={() => setTheme(value)}
                className={cn('flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200',
                  currentTheme === value
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10 hover:text-white')}>
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">Idioma da Interface</Label>
          <Select value={prefs.language} onValueChange={v => set('language', v)}>
            <SelectTrigger className="bg-white/[0.05] border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              <SelectItem value="pt-br">🇧🇷 Português (Brasil)</SelectItem>
              <SelectItem value="en-us">🇺🇸 English (US)</SelectItem>
              <SelectItem value="es">🇪🇸 Español</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ToggleRow label="Modo Compacto" desc="Reduz espaçamentos para ver mais conteúdo" checked={prefs.compactMode} onChange={v => set('compactMode', v)} />
        <ToggleRow label="Animações" desc="Transições e micro-interações" checked={prefs.animations} onChange={v => set('animations', v)} />

        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">Comportamento da Sidebar</Label>
          <Select value={prefs.sidebar} onValueChange={v => set('sidebar', v)}>
            <SelectTrigger className="bg-white/[0.05] border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              <SelectItem value="auto">Automático (hover)</SelectItem>
              <SelectItem value="pinned">Sempre expandida</SelectItem>
              <SelectItem value="collapsed">Sempre recolhida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* ── Notificações ── */}
      <SectionCard icon={Bell} color="bg-amber-500/10 text-amber-400" title="Notificações" desc="Controle o que você quer ser alertado (Somente Interface por enquanto)">
        {/* Sound */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {prefs.soundEnabled ? <Volume2 className="h-4 w-4 text-zinc-400" /> : <VolumeX className="h-4 w-4 text-zinc-600" />}
              <p className="text-sm text-white font-medium">Som de Notificações (Browser)</p>
            </div>
            <Switch checked={prefs.soundEnabled} onCheckedChange={v => set('soundEnabled', v)} className="data-[state=checked]:bg-emerald-500" />
          </div>
          {prefs.soundEnabled && (
            <div className="flex items-center gap-3">
              <VolumeX className="h-3.5 w-3.5 text-zinc-600" />
              <Slider value={[prefs.soundVolume]} onValueChange={([v]) => set('soundVolume', v)} max={100} step={5} className="flex-1" />
              <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-500 w-8 text-right">{prefs.soundVolume}%</span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8">
          <Zap className="h-4 w-4 mr-2" />Salvar Preferências
        </Button>
      </div>
    </div>
  );
}
