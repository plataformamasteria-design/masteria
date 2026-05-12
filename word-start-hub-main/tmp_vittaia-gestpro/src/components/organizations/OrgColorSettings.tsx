import { useState, useEffect, useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Palette, RotateCcw, Sun, Moon, BarChart3, Users, MessageSquare, Home, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  gradient_end: string;
  light_background: string;
  light_card: string;
  light_sidebar: string;
  light_border: string;
  primary_foreground: string;
  dark_primary: string;
  dark_secondary: string;
  dark_accent: string;
  dark_gradient_end: string;
  dark_background: string;
  dark_card: string;
  dark_sidebar: string;
  dark_border: string;
  dark_primary_foreground: string;
}

const DEFAULT_COLORS: ThemeColors = {
  primary: "#0fa87e",
  secondary: "#e8e4de",
  accent: "#1a9e8f",
  gradient_end: "#0099b3",
  light_background: "#f5f5f5",
  light_card: "#ffffff",
  light_sidebar: "#ffffff",
  light_border: "#e2ddd5",
  primary_foreground: "#ffffff",
  dark_primary: "#00b85c",
  dark_secondary: "#1e2a3a",
  dark_accent: "#0099b3",
  dark_gradient_end: "#0099b3",
  dark_background: "#0f1724",
  dark_card: "#162032",
  dark_sidebar: "#162032",
  dark_border: "#253345",
  dark_primary_foreground: "#ffffff",
};

interface PresetTheme {
  name: string;
  colors: ThemeColors;
  preview: { light: string; dark: string };
}

const PRESET_THEMES: PresetTheme[] = [
  {
    name: "Padrão",
    preview: { light: "#0fa87e", dark: "#00b85c" },
    colors: { ...DEFAULT_COLORS },
  },
  {
    name: "Dourado",
    preview: { light: "#c9a84c", dark: "#d4af37" },
    colors: {
      primary: "#c9a84c", secondary: "#f5f0e1", accent: "#b8962e", gradient_end: "#e7ce74",
      light_background: "#faf8f2", light_card: "#ffffff", light_sidebar: "#fdf9f0", light_border: "#e5d9c0",
      primary_foreground: "#1a1200",
      dark_primary: "#d4af37", dark_secondary: "#1e1a0f", dark_accent: "#c9a84c", dark_gradient_end: "#e7ce74",
      dark_background: "#0d0b06", dark_card: "#1a1608", dark_sidebar: "#1a1608", dark_border: "#3d3520",
      dark_primary_foreground: "#0d0b06",
    },
  },
  {
    name: "Clássico P&B",
    preview: { light: "#1a1a1a", dark: "#e5e5e5" },
    colors: {
      primary: "#1a1a1a", secondary: "#f0f0f0", accent: "#555555", gradient_end: "#333333",
      light_background: "#ffffff", light_card: "#fafafa", light_sidebar: "#f5f5f5", light_border: "#e0e0e0",
      primary_foreground: "#ffffff",
      dark_primary: "#e5e5e5", dark_secondary: "#2a2a2a", dark_accent: "#aaaaaa", dark_gradient_end: "#cccccc",
      dark_background: "#0a0a0a", dark_card: "#141414", dark_sidebar: "#111111", dark_border: "#2e2e2e",
      dark_primary_foreground: "#0a0a0a",
    },
  },
  {
    name: "Natureza",
    preview: { light: "#2d8a4e", dark: "#34d058" },
    colors: {
      primary: "#2d8a4e", secondary: "#e8f0e4", accent: "#5ca870", gradient_end: "#1b6e3d",
      light_background: "#f2f7f0", light_card: "#ffffff", light_sidebar: "#eaf3e6", light_border: "#c8dcc0",
      primary_foreground: "#ffffff",
      dark_primary: "#34d058", dark_secondary: "#1a2e1f", dark_accent: "#2ea44f", dark_gradient_end: "#22863a",
      dark_background: "#0d1f12", dark_card: "#13291a", dark_sidebar: "#13291a", dark_border: "#1f3d28",
      dark_primary_foreground: "#0d1f12",
    },
  },
  {
    name: "Azul Imperial",
    preview: { light: "#1a3a7a", dark: "#4a7fff" },
    colors: {
      primary: "#1a3a7a", secondary: "#e0e8f5", accent: "#2c5bb5", gradient_end: "#0e2555",
      light_background: "#f0f3f8", light_card: "#ffffff", light_sidebar: "#e8ecf4", light_border: "#c5cfe0",
      primary_foreground: "#ffffff",
      dark_primary: "#4a7fff", dark_secondary: "#151e33", dark_accent: "#3366cc", dark_gradient_end: "#2255bb",
      dark_background: "#0a0f1e", dark_card: "#101828", dark_sidebar: "#0e1525", dark_border: "#1e3050",
      dark_primary_foreground: "#0a0f1e",
    },
  },
  {
    name: "Roxo Turquesa",
    preview: { light: "#7c3aed", dark: "#a78bfa" },
    colors: {
      primary: "#7c3aed", secondary: "#ede9fe", accent: "#14b8a6", gradient_end: "#06b6d4",
      light_background: "#f5f3ff", light_card: "#ffffff", light_sidebar: "#ede9fe", light_border: "#d4ccf0",
      primary_foreground: "#ffffff",
      dark_primary: "#a78bfa", dark_secondary: "#1e1533", dark_accent: "#2dd4bf", dark_gradient_end: "#22d3ee",
      dark_background: "#0f0a1e", dark_card: "#1a1230", dark_sidebar: "#150e28", dark_border: "#2e2050",
      dark_primary_foreground: "#0f0a1e",
    },
  },
  {
    name: "Light Grey",
    preview: { light: "#6b7280", dark: "#9ca3af" },
    colors: {
      primary: "#6b7280", secondary: "#f3f4f6", accent: "#9ca3af", gradient_end: "#4b5563",
      light_background: "#f9fafb", light_card: "#ffffff", light_sidebar: "#f3f4f6", light_border: "#e5e7eb",
      primary_foreground: "#ffffff",
      dark_primary: "#9ca3af", dark_secondary: "#1f2937", dark_accent: "#6b7280", dark_gradient_end: "#6b7280",
      dark_background: "#111827", dark_card: "#1f2937", dark_sidebar: "#1a2332", dark_border: "#374151",
      dark_primary_foreground: "#111827",
    },
  },
];

interface OrgColorSettingsProps {
  settings: Record<string, any>;
  onSave: (colors: ThemeColors) => void;
}

function LivePreview({ colors, mode }: { colors: ThemeColors; mode: "light" | "dark" }) {
  const bg = mode === "light" ? colors.light_background : colors.dark_background;
  const card = mode === "light" ? colors.light_card : colors.dark_card;
  const sidebar = mode === "light" ? colors.light_sidebar : colors.dark_sidebar;
  const border = mode === "light" ? colors.light_border : colors.dark_border;
  const primary = mode === "light" ? colors.primary : colors.dark_primary;
  const accent = mode === "light" ? colors.accent : colors.dark_accent;
  const gradEnd = mode === "light" ? colors.gradient_end : colors.dark_gradient_end;
  const primaryFg = mode === "light" ? colors.primary_foreground : colors.dark_primary_foreground;
  const textColor = mode === "light" ? "#1a1a1a" : "#e5e5e5";
  const mutedText = mode === "light" ? "#888888" : "#777777";

  return (
    <div
      className="rounded-xl overflow-hidden border text-[10px]"
      style={{ borderColor: border, background: bg, height: 180 }}
    >
      <div className="flex h-full">
        {/* Mini Sidebar */}
        <div
          className="w-[52px] flex flex-col items-center py-2 gap-2 shrink-0"
          style={{ background: sidebar, borderRight: `1px solid ${border}` }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primary}, ${gradEnd})` }}>
            <span style={{ color: primaryFg }} className="text-[8px] font-bold">V</span>
          </div>
          {[Home, MessageSquare, Users, BarChart3].map((Icon, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{
                background: i === 3 ? `${primary}18` : "transparent",
                color: i === 3 ? primary : mutedText,
              }}
            >
              <Icon size={12} />
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-semibold" style={{ color: textColor }}>Dashboard</span>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {["Leads", "Conversas", "Receita"].map((label, i) => (
              <div
                key={label}
                className="rounded-md p-1.5"
                style={{ background: card, border: `1px solid ${border}` }}
              >
                <div className="text-[8px]" style={{ color: mutedText }}>{label}</div>
                <div className="font-bold text-[11px]" style={{ color: textColor }}>
                  {["142", "38", "R$12k"][i]}
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-md p-1.5 flex-1"
            style={{ background: card, border: `1px solid ${border}`, minHeight: 60 }}
          >
            <div className="text-[8px] mb-1" style={{ color: mutedText }}>Atendimentos Semanais</div>
            <div className="flex items-end gap-[3px] h-[40px]">
              {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(to top, ${primary}, ${gradEnd})`,
                    opacity: 0.7 + (i * 0.04),
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrgColorSettings({ settings, onSave }: OrgColorSettingsProps) {
  const saved = settings?.theme_colors as ThemeColors | undefined;
  const [colors, setColors] = useState<ThemeColors>({ ...DEFAULT_COLORS, ...saved });

  useEffect(() => {
    if (saved) setColors({ ...DEFAULT_COLORS, ...saved });
  }, [JSON.stringify(saved)]);

  const updateColor = (key: keyof ThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => onSave(colors);
  const handleReset = () => {
    setColors(DEFAULT_COLORS);
    onSave(DEFAULT_COLORS);
  };

  const applyPreset = (preset: PresetTheme) => {
    setColors({ ...preset.colors });
  };

  const lightFields: { key: keyof ThemeColors; label: string; description: string }[] = [
    { key: "primary", label: "Primária", description: "Botões, links, destaques" },
    { key: "secondary", label: "Secundária", description: "Fundos secundários" },
    { key: "accent", label: "Destaque", description: "Acentos, ícones" },
    { key: "gradient_end", label: "Gradiente", description: "Fim do gradiente" },
    { key: "primary_foreground", label: "Texto Primário", description: "Texto sobre botões e gradientes" },
    { key: "light_background", label: "Background", description: "Fundo principal" },
    { key: "light_card", label: "Cards", description: "Fundo dos cards" },
    { key: "light_sidebar", label: "Sidebar", description: "Fundo da sidebar" },
    { key: "light_border", label: "Bordas", description: "Cor das bordas" },
  ];

  const darkFields: { key: keyof ThemeColors; label: string; description: string }[] = [
    { key: "dark_primary", label: "Primária", description: "Botões, links, destaques" },
    { key: "dark_secondary", label: "Secundária", description: "Fundos secundários" },
    { key: "dark_accent", label: "Destaque", description: "Acentos, ícones" },
    { key: "dark_gradient_end", label: "Gradiente", description: "Fim do gradiente" },
    { key: "dark_primary_foreground", label: "Texto Primário", description: "Texto sobre botões e gradientes" },
    { key: "dark_background", label: "Background", description: "Fundo principal" },
    { key: "dark_card", label: "Cards", description: "Fundo dos cards" },
    { key: "dark_sidebar", label: "Sidebar", description: "Fundo da sidebar" },
    { key: "dark_border", label: "Bordas", description: "Cor das bordas" },
  ];

  const ColorField = ({ fieldKey, label, description }: { fieldKey: keyof ThemeColors; label: string; description: string }) => {
    const [localColor, setLocalColor] = useState(colors[fieldKey]);
    const isDragging = useRef(false);

    useEffect(() => {
      if (!isDragging.current) setLocalColor(colors[fieldKey]);
    }, [colors[fieldKey]]);

    return (
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={localColor}
            onMouseDown={() => { isDragging.current = true; }}
            onInput={(e) => setLocalColor((e.target as HTMLInputElement).value)}
            onChange={(e) => {
              isDragging.current = false;
              updateColor(fieldKey, e.target.value);
            }}
            className="h-8 w-8 rounded cursor-pointer border border-border shrink-0"
          />
          <Input
            value={colors[fieldKey]}
            onChange={(e) => updateColor(fieldKey, e.target.value)}
            className="h-8 text-xs font-mono"
            maxLength={7}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
    );
  };

  const ColorGrid = ({ fields }: { fields: typeof lightFields }) => (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(({ key, label, description }) => (
        <ColorField key={key} fieldKey={key} label={label} description={description} />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Cores do Sistema</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleReset}>
          <RotateCcw className="h-3 w-3" />
          Restaurar padrão
        </Button>
      </div>

      {/* Preset themes */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Temas Predefinidos</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PRESET_THEMES.map((preset) => {
            const isActive = colors.primary === preset.colors.primary && colors.dark_primary === preset.colors.dark_primary;
            return (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all hover:scale-105"
                style={{
                  borderColor: isActive ? preset.preview.light : "hsl(var(--border))",
                  background: isActive ? `${preset.preview.light}12` : "transparent",
                }}
              >
                <div className="flex -space-x-1">
                  <div className="w-4 h-4 rounded-full border border-background" style={{ background: preset.preview.light }} />
                  <div className="w-4 h-4 rounded-full border border-background" style={{ background: preset.preview.dark }} />
                </div>
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium">Preview Light</span>
          <LivePreview colors={colors} mode="light" />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium">Preview Dark</span>
          <LivePreview colors={colors} mode="dark" />
        </div>
      </div>

      <Tabs defaultValue="light">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="light" className="gap-1 text-xs h-7">
            <Sun className="h-3 w-3" /> Modo Claro
          </TabsTrigger>
          <TabsTrigger value="dark" className="gap-1 text-xs h-7">
            <Moon className="h-3 w-3" /> Modo Escuro
          </TabsTrigger>
        </TabsList>
        <TabsContent value="light" className="mt-3">
          <ColorGrid fields={lightFields} />
        </TabsContent>
        <TabsContent value="dark" className="mt-3">
          <ColorGrid fields={darkFields} />
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} size="sm" className="w-full gap-2">
        <Palette className="h-3.5 w-3.5" />
        Aplicar Cores
      </Button>
    </div>
  );
}
