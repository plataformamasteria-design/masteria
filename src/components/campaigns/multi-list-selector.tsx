'use client';

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Users, Search, CheckSquare, Square, List, AlertTriangle, Check } from 'lucide-react';
import type { ContactList } from '@/lib/types';

interface MultiListSelectorProps {
  lists: ContactList[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxHeight?: string;
}

export function MultiListSelector({
  lists,
  selectedIds,
  onSelectionChange,
  maxHeight = '200px',
}: MultiListSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLists = useMemo(() => {
    if (!searchTerm.trim()) return lists;
    const term = searchTerm.toLowerCase();
    return lists.filter(list => 
      list.name.toLowerCase().includes(term)
    );
  }, [lists, searchTerm]);

  const { totalContacts, emptySelectedCount } = useMemo(() => {
    const selectedLists = lists.filter(list => selectedIds.includes(list.id));
    const total = selectedLists.reduce((sum, list) => sum + (list.contactCount || 0), 0);
    const emptyCount = selectedLists.filter(list => (list.contactCount || 0) === 0).length;
    return { totalContacts: total, emptySelectedCount: emptyCount };
  }, [lists, selectedIds]);

  const handleToggle = useCallback((listId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isCurrentlySelected = selectedIds.includes(listId);
    let newIds: string[];
    
    if (isCurrentlySelected) {
      newIds = selectedIds.filter(id => id !== listId);
    } else {
      newIds = [...selectedIds, listId];
    }
    
    onSelectionChange(newIds);
  }, [selectedIds, onSelectionChange]);

  const handleSelectAll = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const allFilteredIds = filteredLists.map(l => l.id);
    const newSelection = [...new Set([...selectedIds, ...allFilteredIds])];
    
    if (newSelection.length !== selectedIds.length) {
      onSelectionChange(newSelection);
    }
  }, [filteredLists, selectedIds, onSelectionChange]);

  const handleDeselectAll = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const filteredIds = new Set(filteredLists.map(l => l.id));
    const newSelection = selectedIds.filter(id => !filteredIds.has(id));
    
    if (newSelection.length !== selectedIds.length) {
      onSelectionChange(newSelection);
    }
  }, [filteredLists, selectedIds, onSelectionChange]);

  const allFilteredSelected = filteredLists.length > 0 && 
    filteredLists.every(list => selectedIds.includes(list.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar listas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={allFilteredSelected || filteredLists.length === 0}
            title="Selecionar todas"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            disabled={selectedIds.length === 0}
            title="Desmarcar todas"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border">
        <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
          <div className="p-2 space-y-1">
            {filteredLists.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchTerm ? 'Nenhuma lista encontrada' : 'Nenhuma lista disponível'}
                </p>
              </div>
            ) : (
              filteredLists.map(list => {
                const isEmpty = (list.contactCount || 0) === 0;
                const isSelected = selectedIds.includes(list.id);
                return (
                  <div
                    key={list.id}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors select-none ${
                      isSelected 
                        ? isEmpty 
                          ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700' 
                          : 'bg-primary/5 border border-primary/20' 
                        : isEmpty 
                          ? 'opacity-60 border border-transparent' 
                          : 'border border-transparent'
                    }`}
                    onClick={(e) => handleToggle(list.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle(list.id, e as unknown as React.MouseEvent);
                      }
                    }}
                  >
                    <div 
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'border-input bg-background'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium truncate block text-sm ${isEmpty ? 'text-muted-foreground' : ''}`}>
                        {list.name}
                      </span>
                    </div>
                    <Badge 
                      variant={isEmpty ? "outline" : "secondary"} 
                      className={`shrink-0 ${isEmpty ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600' : ''}`}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {list.contactCount || 0}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {selectedIds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm bg-primary/5 p-2 rounded-md border border-primary/20">
            <span className="font-medium text-primary">
              {selectedIds.length} lista{selectedIds.length !== 1 ? 's' : ''} selecionada{selectedIds.length !== 1 ? 's' : ''}
            </span>
            <Badge variant="default" className="bg-primary">
              <Users className="h-3 w-3 mr-1" />
              {totalContacts.toLocaleString('pt-BR')} contatos
            </Badge>
          </div>
          {emptySelectedCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {emptySelectedCount} lista{emptySelectedCount !== 1 ? 's' : ''} vazia{emptySelectedCount !== 1 ? 's' : ''} será{emptySelectedCount !== 1 ? 'ão' : ''} ignorada{emptySelectedCount !== 1 ? 's' : ''} automaticamente.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SelectedListsSummary({
  lists,
  selectedIds,
}: {
  lists: ContactList[];
  selectedIds: string[];
}) {
  const selectedLists = lists.filter(l => selectedIds.includes(l.id));
  const totalContacts = selectedLists.reduce((sum, l) => sum + (l.contactCount || 0), 0);

  if (selectedLists.length === 0) {
    return <span className="text-muted-foreground">Nenhuma lista selecionada</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {selectedLists.map(list => (
          <Badge key={list.id} variant="outline" className="text-xs">
            {list.name} ({list.contactCount || 0})
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Total: {totalContacts.toLocaleString('pt-BR')} contatos em {selectedLists.length} lista{selectedLists.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
