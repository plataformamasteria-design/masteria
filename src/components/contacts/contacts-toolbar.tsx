import { Search, List, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ViewType } from '@/hooks/use-contacts-controller';
import { Tag, ContactList } from '@/lib/types';

interface ContactsToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    tagFilter: string;
    onTagFilterChange: (value: string) => void;
    listFilter: string;
    onListFilterChange: (value: string) => void;
    sortBy: string;
    onSortByChange: (value: string) => void; // Note: Logic is handled in hook, this receives the full string e.g. 'name:asc' or handled via hook's handleSort logic?
    // Ideally, the unified handler or specific setSortBy. 
    // The hook exposes handleSort(key) which toggles. But the Select needs to set specific values.
    // Let's check hook again. Hook exposes `handleSort` which toggles. 
    // But for a Select dropdown, we might want to set specific values directly.
    // I'll adjust the hook or just map the select values to specific interactions.
    // Actually, the hook has `setSortBy` internally but exposes `handleSort`.
    // I should probably expose a direct setter or just use the one that matches the Select values.
    // The hook's `handleSort` is for column headers. The Select in the UI sets specific "createdAt:desc" etc.
    // I will assume I can update the URL directly via `onSortByChange` passed from parent which uses `updateUrl` logic or similar.
    // Wait, `useContactsController` exposes `sortBy` string. I can just update the URL/state.
    // I'll add `onSortChange` to props that accepts string.
    availableTags: Tag[];
    availableLists: ContactList[];
    view: ViewType;
    onViewChange: (view: ViewType) => void;
    isMobile: boolean;
}

export function ContactsToolbar({
    searchTerm,
    onSearchChange,
    tagFilter,
    onTagFilterChange,
    listFilter,
    onListFilterChange,
    sortBy,
    onSortByChange,
    availableTags,
    availableLists,
    view,
    onViewChange,
    isMobile
}: ContactsToolbarProps) {
    return (
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative w-full sm:w-auto sm:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome ou telefone..."
                        className="pl-9 w-full sm:max-w-md"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <Select value={tagFilter} onValueChange={onTagFilterChange}>
                        <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Filtrar por Tag" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Tags</SelectItem>
                            {Array.isArray(availableTags) && availableTags.map(tag => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={listFilter} onValueChange={onListFilterChange}>
                        <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Filtrar por Lista" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Listas</SelectItem>
                            {Array.isArray(availableLists) && availableLists.map(list => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={onSortByChange}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt:desc">Mais Recentes</SelectItem>
                            <SelectItem value="createdAt:asc">Mais Antigos</SelectItem>
                            <SelectItem value="name:asc">Nome (A-Z)</SelectItem>
                            <SelectItem value="name:desc">Nome (Z-A)</SelectItem>
                        </SelectContent>
                    </Select>
                    {!isMobile && (
                        <div className="flex items-center gap-1 bg-muted p-1 rounded-md border">
                            <Button
                                variant={view === 'table' ? 'secondary' : 'ghost'}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onViewChange('table')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={view === 'grid' ? 'secondary' : 'ghost'}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onViewChange('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
