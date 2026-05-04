'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Clock } from 'lucide-react';

interface ResponseDelaySettingsProps {
  firstResponseMinDelay: number;
  firstResponseMaxDelay: number;
  followupResponseMinDelay: number;
  followupResponseMaxDelay: number;
  onChange: (field: string, value: number) => void;
}

const FIRST_RESPONSE_PRESETS = [
  { label: 'Rápida (8-14s)', min: 8, max: 14 },
  { label: 'Recomendado (33-68s)', min: 33, max: 68 },
];

const FOLLOWUP_RESPONSE_PRESETS = [
  { label: 'Moderada (38-98s)', min: 38, max: 98 },
  { label: 'Recomendado (81-210s)', min: 81, max: 210 },
  { label: 'Natural (233-408s)', min: 233, max: 408 },
];

export function ResponseDelaySettings({
  firstResponseMinDelay,
  firstResponseMaxDelay,
  followupResponseMinDelay,
  followupResponseMaxDelay,
  onChange,
}: ResponseDelaySettingsProps) {
  const getFirstResponsePresetLabel = () => {
    const preset = FIRST_RESPONSE_PRESETS.find(
      (p) => p.min === firstResponseMinDelay && p.max === firstResponseMaxDelay
    );
    return preset ? preset.label : `Personalizado (${firstResponseMinDelay}-${firstResponseMaxDelay}s)`;
  };

  const getFollowupResponsePresetLabel = () => {
    const preset = FOLLOWUP_RESPONSE_PRESETS.find(
      (p) => p.min === followupResponseMinDelay && p.max === followupResponseMaxDelay
    );
    return preset ? preset.label : `Personalizado (${followupResponseMinDelay}-${followupResponseMaxDelay}s)`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Tempo de Resposta
        </CardTitle>
        <CardDescription>
          Configure delays humanizados para tornar as respostas da IA mais naturais. 
          O sistema aguardará um tempo aleatório dentro do intervalo configurado antes de responder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primeira Resposta (últimas 24h) */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">
              Primeira Resposta das últimas 24 horas
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              {getFirstResponsePresetLabel()}
            </p>
          </div>

          <div className="space-y-4 pl-4 border-l-2 border-muted">
            {FIRST_RESPONSE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onChange('firstResponseMinDelay', preset.min);
                  onChange('firstResponseMaxDelay', preset.max);
                }}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                  firstResponseMinDelay === preset.min && firstResponseMaxDelay === preset.max
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{preset.label}</span>
                  {preset.label.includes('Recomendado') && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Recomendado
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Sliders personalizados para primeira resposta */}
          <div className="space-y-4 bg-muted/20 p-4 rounded-lg">
            <div className="space-y-2">
              <Label className="text-sm">Delay Mínimo: {firstResponseMinDelay}s</Label>
              <Slider
                value={[firstResponseMinDelay]}
                onValueChange={(value) => {
                  const newMin = value[0] ?? 0;
                  if (newMin > firstResponseMaxDelay) {
                    onChange('firstResponseMaxDelay', newMin);
                  }
                  onChange('firstResponseMinDelay', newMin);
                }}
                min={0}
                max={120}
                step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Delay Máximo: {firstResponseMaxDelay}s</Label>
              <Slider
                value={[firstResponseMaxDelay]}
                onValueChange={(value) => {
                  const newMax = value[0] ?? 0;
                  if (newMax < firstResponseMinDelay) {
                    onChange('firstResponseMinDelay', newMax);
                  }
                  onChange('firstResponseMaxDelay', newMax);
                }}
                min={0}
                max={120}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Demais Respostas */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">
              Demais Respostas
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              {getFollowupResponsePresetLabel()}
            </p>
          </div>

          <div className="space-y-4 pl-4 border-l-2 border-muted">
            {FOLLOWUP_RESPONSE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onChange('followupResponseMinDelay', preset.min);
                  onChange('followupResponseMaxDelay', preset.max);
                }}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                  followupResponseMinDelay === preset.min && followupResponseMaxDelay === preset.max
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{preset.label}</span>
                  {preset.label.includes('Recomendado') && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Recomendado
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Sliders personalizados para demais respostas */}
          <div className="space-y-4 bg-muted/20 p-4 rounded-lg">
            <div className="space-y-2">
              <Label className="text-sm">Delay Mínimo: {followupResponseMinDelay}s</Label>
              <Slider
                value={[followupResponseMinDelay]}
                onValueChange={(value) => {
                  const newMin = value[0] ?? 0;
                  if (newMin > followupResponseMaxDelay) {
                    onChange('followupResponseMaxDelay', newMin);
                  }
                  onChange('followupResponseMinDelay', newMin);
                }}
                min={0}
                max={600}
                step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Delay Máximo: {followupResponseMaxDelay}s</Label>
              <Slider
                value={[followupResponseMaxDelay]}
                onValueChange={(value) => {
                  const newMax = value[0] ?? 0;
                  if (newMax < followupResponseMinDelay) {
                    onChange('followupResponseMinDelay', newMax);
                  }
                  onChange('followupResponseMaxDelay', newMax);
                }}
                min={0}
                max={600}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">💡 Dica:</p>
          <p className="text-blue-800 dark:text-blue-200">
            Delays mais longos tornam a conversa mais natural e humana. O sistema escolherá um valor 
            aleatório entre o mínimo e máximo configurado para cada resposta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
