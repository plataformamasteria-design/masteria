import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Wifi, TrendingDown, Save, Globe } from "lucide-react";
import { useOrganizationModules, MODULE_DEFINITIONS, CONNECTION_DEFINITIONS } from "@/hooks/useOrganizationModules";
import { useGlobalModulePrices } from "@/hooks/useGlobalModulePrices";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface OrgModulesConfigProps {
  organizationId: string;
  organizationName: string;
}

interface LocalModuleState {
  active: boolean;
  price: string;
}

export function OrgModulesConfig({ organizationId, organizationName }: OrgModulesConfigProps) {
  const { modules, connections, isLoading, updateModule, updateConnection, totalMonthly } = useOrganizationModules(organizationId);
  const { getModuleBasePrice, getConnectionBasePrice, isLoading: loadingGlobal } = useGlobalModulePrices();

  const [localModules, setLocalModules] = useState<Record<string, LocalModuleState>>({});
  const [localConnections, setLocalConnections] = useState<Record<string, LocalModuleState>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoading || loadingGlobal) return;

    const mods: Record<string, LocalModuleState> = {};
    for (const key of Object.keys(MODULE_DEFINITIONS)) {
      const mod = modules.find(m => m.module_key === key);
      mods[key] = { active: mod?.active || false, price: String(mod?.price ?? 0) };
    }
    setLocalModules(mods);

    const conns: Record<string, LocalModuleState> = {};
    for (const key of Object.keys(CONNECTION_DEFINITIONS)) {
      const conn = connections.find(c => c.connection_key === key);
      conns[key] = { active: conn?.active || false, price: String(conn?.price ?? 0) };
    }
    setLocalConnections(conns);
    setDirty(false);
  }, [modules, connections, isLoading, loadingGlobal]);


  if (isLoading || loadingGlobal) {
    return <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  }

  const updateLocalModule = (key: string, field: 'active' | 'price', value: any) => {
    setLocalModules(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setDirty(true);
  };

  const updateLocalConnection = (key: string, field: 'active' | 'price', value: any) => {
    setLocalConnections(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setDirty(true);
  };

  const toggleInheritModule = (key: string) => {
    const current = parseFloat(localModules[key]?.price || '0');
    const newPrice = current === -1 ? '0' : '-1';
    updateLocalModule(key, 'price', newPrice);
  };

  const toggleInheritConnection = (key: string) => {
    const current = parseFloat(localConnections[key]?.price || '0');
    const newPrice = current === -1 ? '0' : '-1';
    updateLocalConnection(key, 'price', newPrice);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let allOk = true;

    for (const [key, state] of Object.entries(localModules)) {
      const price = parseFloat(state.price) || 0;
      const ok = await updateModule(key, { active: state.active, price });
      if (!ok) allOk = false;
    }

    for (const [key, state] of Object.entries(localConnections)) {
      const price = parseFloat(state.price) || 0;
      const ok = await updateConnection(key, { active: state.active, price });
      if (!ok) allOk = false;
    }


    setSaving(false);
    if (allOk) {
      toast.success('Configurações salvas com sucesso');
      setDirty(false);
    } else {
      toast.error('Erro ao salvar algumas configurações');
    }
  };

  // Calculate effective total with new logic
  const calcTotal = () => {
    let total = 0;
    for (const [key, state] of Object.entries(localModules)) {
      if (!state.active) continue;
      const price = parseFloat(state.price) || 0;
      if (price === -1) {
        total += getModuleBasePrice(key);
      } else {
        total += Math.max(0, price);
      }
    }
    for (const [key, state] of Object.entries(localConnections)) {
      if (!state.active) continue;
      const def = CONNECTION_DEFINITIONS[key];
      if (def?.alwaysFree || key === 'whatsapp') continue;
      const price = parseFloat(state.price) || 0;
      if (price === -1) {
        total += getConnectionBasePrice(key);
      } else {
        total += Math.max(0, price);
      }
    }
    return total;
  };

  const getModuleDiscount = (key: string, orgPrice: number) => {
    const basePrice = getModuleBasePrice(key);
    if (orgPrice === -1 || basePrice <= 0 || orgPrice <= 0) return null;
    if (orgPrice < basePrice) return basePrice - orgPrice;
    return null;
  };

  const getConnectionDiscount = (key: string, orgPrice: number) => {
    const basePrice = getConnectionBasePrice(key);
    if (orgPrice === -1 || basePrice <= 0 || orgPrice <= 0) return null;
    if (orgPrice < basePrice) return basePrice - orgPrice;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{organizationName}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Total: R$ {calcTotal().toFixed(2)}/mês</Badge>
          <Button onClick={handleSaveAll} disabled={saving || !dirty} size="sm" className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Preço R$ 0 = gratuito. Clique em <Globe className="h-3 w-3 inline" /> para herdar o valor base global.
      </p>


      {/* Modules */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Módulos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(MODULE_DEFINITIONS).map(([key, def]) => {
            const state = localModules[key] || { active: false, price: '0' };
            const orgPrice = parseFloat(state.price) || 0;
            const basePrice = getModuleBasePrice(key);
            const discount = getModuleDiscount(key, orgPrice);
            const isInheriting = orgPrice === -1;

            return (
              <div key={key} className="flex flex-col p-3 rounded-lg bg-muted/50 gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Switch
                      checked={state.active}
                      onCheckedChange={(v) => updateLocalModule(key, 'active', v)}
                      disabled={key === 'padrao'}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{def.label}</p>
                      <p className="text-xs text-muted-foreground">{def.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={isInheriting ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title={isInheriting ? 'Herdando do global' : 'Herdar valor global'}
                      onClick={() => toggleInheritModule(key)}
                    >
                      <Globe className="h-3.5 w-3.5" />
                    </Button>
                    {!isInheriting && (
                      <div className="flex items-center gap-1 w-28">
                        <Label className="text-xs shrink-0">R$</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-sm"
                          value={state.price}
                          onChange={(e) => updateLocalModule(key, 'price', e.target.value)}
                        />
                      </div>
                    )}
                    {isInheriting && (
                      <span className="text-sm font-medium text-primary whitespace-nowrap">
                        R$ {basePrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {isInheriting && (
                  <p className="text-xs text-muted-foreground ml-12">
                    Herdando valor global: R$ {basePrice.toFixed(2)}/mês
                  </p>
                )}
                {!isInheriting && orgPrice === 0 && (
                  <p className="text-xs text-muted-foreground ml-12">Gratuito</p>
                )}
                {discount !== null && discount > 0 && (
                  <div className="flex items-center gap-1 ml-12">
                    <TrendingDown className="h-3 w-3 text-green-500" />
                    <p className="text-xs text-green-600 font-medium">
                      Desconto de R$ {discount.toFixed(2)} (base: R$ {basePrice.toFixed(2)})
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Connections */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" />
            Conexões de Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(CONNECTION_DEFINITIONS).map(([key, def]) => {
            const isNative = def.native === true;
            const state = localConnections[key] || { active: isNative, price: '0' };
            const orgPrice = parseFloat(state.price) || 0;
            const basePrice = getConnectionBasePrice(key);
            const discount = getConnectionDiscount(key, orgPrice);
            const isInheriting = orgPrice === -1;

            return (
              <div key={key} className="flex flex-col p-3 rounded-lg bg-muted/50 gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Switch
                      checked={isNative ? true : state.active}
                      onCheckedChange={(v) => !isNative && updateLocalConnection(key, 'active', v)}
                      disabled={isNative}
                    />
                    <div>
                      <p className="text-sm font-medium">{def.label}</p>
                      {isNative && (
                        <p className="text-xs text-green-600 font-medium">Incluso no plano Padrão</p>
                      )}
                    </div>
                  </div>
                  {!isNative && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={isInheriting ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title={isInheriting ? 'Herdando do global' : 'Herdar valor global'}
                        onClick={() => toggleInheritConnection(key)}
                      >
                        <Globe className="h-3.5 w-3.5" />
                      </Button>
                      {!isInheriting && (
                        <div className="flex items-center gap-1 w-28">
                          <Label className="text-xs shrink-0">R$</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-sm"
                            value={state.price}
                            onChange={(e) => updateLocalConnection(key, 'price', e.target.value)}
                          />
                        </div>
                      )}
                      {isInheriting && (
                        <span className="text-sm font-medium text-primary whitespace-nowrap">
                          R$ {basePrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!isNative && isInheriting && (
                  <p className="text-xs text-muted-foreground ml-12">
                    Herdando valor global: R$ {basePrice.toFixed(2)}/mês
                  </p>
                )}
                {!isNative && !isInheriting && orgPrice === 0 && (
                  <p className="text-xs text-muted-foreground ml-12">Gratuito</p>
                )}
                {!isNative && discount !== null && discount > 0 && (
                  <div className="flex items-center gap-1 ml-12">
                    <TrendingDown className="h-3 w-3 text-green-500" />
                    <p className="text-xs text-green-600 font-medium">
                      Desconto de R$ {discount.toFixed(2)} (base: R$ {basePrice.toFixed(2)})
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
