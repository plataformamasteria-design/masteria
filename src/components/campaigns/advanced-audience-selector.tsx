'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { MultiListSelector } from './multi-list-selector';
import { MultiSelect, Option } from '@/components/ui/multi-select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContactList } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface KanbanBoard {
    id: string;
    name: string;
    stages: { id: string; name: string }[];
}

export interface AdvancedAudienceSelectorProps {
    availableLists: ContactList[];
    contactListIds: string[];
    setContactListIds: (ids: string[]) => void;
    excludeListIds: string[];
    setExcludeListIds: (ids: string[]) => void;
    tagIds: string[];
    setTagIds: (ids: string[]) => void;
    excludeTagIds: string[];
    setExcludeTagIds: (ids: string[]) => void;
    funnelIds: string[];
    setFunnelIds: (ids: string[]) => void;
    funnelStageIds: string[];
    setFunnelStageIds: (ids: string[]) => void;
}

export function AdvancedAudienceSelector({
    availableLists,
    contactListIds,
    setContactListIds,
    excludeListIds,
    setExcludeListIds,
    tagIds,
    setTagIds,
    excludeTagIds,
    setExcludeTagIds,
    funnelIds,
    setFunnelIds,
    funnelStageIds,
    setFunnelStageIds
}: AdvancedAudienceSelectorProps) {
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [availableBoards, setAvailableBoards] = useState<KanbanBoard[]>([]);

    useEffect(() => {
        fetch('/api/v1/tags?limit=1000')
            .then(res => res.json())
            .then(data => setAvailableTags(data.data || []))
            .catch(console.error);

        fetch('/api/v1/kanbans')
            .then(res => res.json())
            .then(data => setAvailableBoards(data.data || []))
            .catch(console.error);
    }, []);

    const tagOptions: Option[] = availableTags.map(t => ({
        value: t.id,
        label: t.name,
        color: t.color
    }));

    const funnelOptions: Option[] = availableBoards.map(b => ({
        value: b.id,
        label: b.name
    }));

    const stageOptions: Option[] = availableBoards.flatMap(b => 
        (b.stages || []).map(s => ({
            value: s.id,
            label: `${b.name} - ${s.name}`
        }))
    );

    return (
        <Card className="border-white/5 shadow-sm overflow-hidden bg-white/[0.02] backdrop-blur-md">
            <CardHeader className="pb-4 bg-black/20 border-b border-white/5">
                <CardTitle className="text-xl text-emerald-400 font-bold">Público Alvo (Inclusões)</CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                    O contato receberá a mensagem se pertencer a <b className="text-zinc-200">qualquer uma</b> das seleções abaixo.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                
                <div className="space-y-3">
                    <Label className="text-base font-semibold text-zinc-300">Listas de Contatos</Label>
                    <div className="rounded-md border-white/10 bg-black/10 overflow-hidden border">
                        <MultiListSelector
                            lists={availableLists}
                            selectedIds={contactListIds}
                            onSelectionChange={setContactListIds}
                            maxHeight="200px"
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 p-4 border border-white/10 rounded-xl bg-white/[0.02]">
                        <Label className="font-semibold text-emerald-400">Etiquetas (Tags)</Label>
                        <MultiSelect
                            options={tagOptions}
                            selected={tagIds}
                            onChange={setTagIds}
                            placeholder="Selecione etiquetas..."
                        />
                    </div>
                    
                    <div className="space-y-3 p-4 border border-white/10 rounded-xl bg-white/[0.02]">
                        <Label className="font-semibold text-emerald-400">Funis (Todos os Leads)</Label>
                        <MultiSelect
                            options={funnelOptions}
                            selected={funnelIds}
                            onChange={setFunnelIds}
                            placeholder="Selecione funis..."
                        />
                    </div>

                    <div className="space-y-3 md:col-span-2 p-4 border border-white/10 rounded-xl bg-white/[0.02]">
                        <Label className="font-semibold text-emerald-400">Etapas Específicas de Funil</Label>
                        <MultiSelect
                            options={stageOptions}
                            selected={funnelStageIds}
                            onChange={setFunnelStageIds}
                            placeholder="Selecione etapas..."
                        />
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="exclusions" className="border border-red-500/20 rounded-xl bg-red-500/5 px-4">
                        <AccordionTrigger className="text-red-400 hover:text-red-300 py-4 hover:no-underline">
                            <span className="font-bold text-base">Exclusões (Opcional)</span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-2 pb-4">
                            <p className="text-sm text-zinc-400">
                                Contatos nestas seleções <b className="text-red-400">NÃO</b> receberão a mensagem, mesmo que estejam incluídos acima.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label className="font-semibold text-zinc-300">Listas a Excluir</Label>
                                    <div className="rounded-md border-white/10 bg-black/10 overflow-hidden border">
                                        <MultiSelect
                                            options={availableLists.map(l => ({ value: l.id, label: `${l.name} (${l.contactCount || 0})` }))}
                                            selected={excludeListIds}
                                            onChange={setExcludeListIds}
                                            placeholder="Selecione listas de exclusão..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="font-semibold text-zinc-300">Etiquetas a Excluir</Label>
                                    <div className="rounded-md border-white/10 bg-black/10 overflow-hidden border">
                                        <MultiSelect
                                            options={tagOptions}
                                            selected={excludeTagIds}
                                            onChange={setExcludeTagIds}
                                            placeholder="Selecione etiquetas de exclusão..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
}
