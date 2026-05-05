'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { MultiListSelector } from './multi-list-selector';
import { MultiSelect, Option } from '@/components/ui/multi-select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ContactList } from '@/lib/types';

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
        <div className="space-y-4 border rounded-md p-4 bg-muted/20">
            <h3 className="font-semibold text-lg text-primary">Inclusões</h3>
            <p className="text-sm text-muted-foreground pb-2">O contato receberá a mensagem se pertencer a qualquer uma das seleções abaixo.</p>
            
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Listas de Contatos</Label>
                    <MultiListSelector
                        lists={availableLists}
                        selectedIds={contactListIds}
                        onSelectionChange={setContactListIds}
                        maxHeight="150px"
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Etiquetas (Tags)</Label>
                        <MultiSelect
                            options={tagOptions}
                            selected={tagIds}
                            onChange={setTagIds}
                            placeholder="Selecione etiquetas..."
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Funis (Todos os Leads)</Label>
                        <MultiSelect
                            options={funnelOptions}
                            selected={funnelIds}
                            onChange={setFunnelIds}
                            placeholder="Selecione funis..."
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label>Etapas Específicas de Funil</Label>
                        <MultiSelect
                            options={stageOptions}
                            selected={funnelStageIds}
                            onChange={setFunnelStageIds}
                            placeholder="Selecione etapas..."
                        />
                    </div>
                </div>
            </div>

            <Accordion type="single" collapsible className="w-full mt-6">
                <AccordionItem value="exclusions" className="border-b-0">
                    <AccordionTrigger className="text-red-600 hover:text-red-700 py-2">
                        <span className="font-semibold">Exclusões (Opcional)</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4 border-t mt-2">
                        <p className="text-sm text-muted-foreground pb-2">Contatos nestas seleções <b>NÃO</b> receberão a mensagem, mesmo que estejam incluídos acima.</p>
                        
                        <div className="space-y-2">
                            <Label>Listas a Excluir</Label>
                            <MultiSelect
                                options={availableLists.map(l => ({ value: l.id, label: `${l.name} (${l.contactCount || 0})` }))}
                                selected={excludeListIds}
                                onChange={setExcludeListIds}
                                placeholder="Selecione listas de exclusão..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Etiquetas a Excluir</Label>
                            <MultiSelect
                                options={tagOptions}
                                selected={excludeTagIds}
                                onChange={setExcludeTagIds}
                                placeholder="Selecione etiquetas de exclusão..."
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
