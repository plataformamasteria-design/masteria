import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useDebounce } from '@/hooks/use-debounce';
import type { ExtendedContact, ContactList, Tag } from '@/lib/types';

export type SortKey = 'name' | 'createdAt';
export type ViewType = 'table' | 'grid';

interface UseContactsControllerProps {
    initialLimit?: number;
}

// Fetchers utilitários para o SWR
const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha na requisição');
    return res.json();
};

export function useContactsController({ initialLimit = 10 }: UseContactsControllerProps = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    // URL State Sync
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || initialLimit.toString(), 10);
    const search = searchParams.get('search') || '';
    const tagFilter = searchParams.get('tagId') || 'all';
    const listFilter = searchParams.get('listId') || 'all';
    const sortByParam = searchParams.get('sortBy') || 'createdAt:desc';

    // Local State
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [view, setView] = useState<ViewType>('table');
    const [searchTerm, setSearchTerm] = useState(search);
    const debouncedSearch = useDebounce(searchTerm, 500);

    // Update URL helper
    const updateUrl = useCallback((params: Record<string, string | null>) => {
        const newSearchParams = new URLSearchParams(searchParams.toString());

        Object.entries(params).forEach(([key, value]) => {
            if (value === null) {
                newSearchParams.delete(key);
            } else {
                newSearchParams.set(key, value);
            }
        });

        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    }, [pathname, router, searchParams]);

    // Build query params para o SWR
    const queryString = useMemo(() => {
        const [sortByField, sortOrder] = sortByParam.split(':');
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });

        if (sortByField) params.set('sortBy', sortByField);
        if (sortOrder) params.set('sortOrder', sortOrder);
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (tagFilter !== 'all') params.set('tagId', tagFilter);
        if (listFilter !== 'all') params.set('listId', listFilter);

        return params.toString();
    }, [page, limit, sortByParam, debouncedSearch, tagFilter, listFilter]);

    // Dados Principais: Contatos
    const { data: contactsData, error: contactsError, isLoading: loading, mutate } = useSWR(
        `/api/v1/contacts?${queryString}`,
        fetcher,
        { revalidateOnFocus: true }
    );

    const contacts: ExtendedContact[] = contactsData?.data || [];
    const totalPages = contactsData?.totalPages || 1;

    // Notification para erros de fetch
    useEffect(() => {
        if (contactsError) {
            notify.error("Erro", "Não foi possível carregar os contatos.");
        }
    }, [contactsError, notify]);

    // Filtros: Tags e Listas (Usando SWR para caching simultâneo)
    const { data: tagsData } = useSWR('/api/v1/tags', fetcher, { revalidateOnFocus: false });
    const { data: listsData } = useSWR('/api/v1/lists', fetcher, { revalidateOnFocus: false });

    const availableTags: Tag[] = useMemo(() => Array.isArray(tagsData) ? tagsData : (Array.isArray(tagsData?.data) ? tagsData.data : []), [tagsData]);
    const availableLists: ContactList[] = useMemo(() => Array.isArray(listsData) ? listsData : (Array.isArray(listsData?.data) ? listsData.data : []), [listsData]);

    // Handlers
    const handleSearch = (term: string) => {
        setSearchTerm(term);
    };

    // Sync search term with URL update (debounced)
    useEffect(() => {
        if (debouncedSearch !== search) {
            updateUrl({ search: debouncedSearch || null, page: '1' });
        }
    }, [debouncedSearch, updateUrl, search]);

    const handleSort = (key: SortKey) => {
        const [currentKey, currentOrder] = sortByParam.split(':');
        const newOrder = key === currentKey && currentOrder === 'desc' ? 'asc' : 'desc';
        updateUrl({ sortBy: `${key}:${newOrder}` });
    };

    const handlePageChange = (newPage: number) => {
        updateUrl({ page: newPage.toString() });
    };

    const handleLimitChange = (newLimit: number) => {
        updateUrl({ limit: newLimit.toString(), page: '1' });
    };

    const handleTagFilterChange = (tagId: string) => {
        updateUrl({ tagId: tagId, page: '1' });
    };

    const handleListFilterChange = (listId: string) => {
        updateUrl({ listId: listId, page: '1' });
    };

    const handleDelete = async (contactId: string) => {
        try {
            // Optimistic update
            const newContacts = contacts.filter((c: ExtendedContact) => c.id !== contactId);
            mutate({ ...contactsData, data: newContacts }, false);

            const response = await fetch(`/api/v1/contacts/${contactId}`, { method: 'DELETE' });
            if (response.status !== 204) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao excluir contato.');
            }
            notify.success('Contato excluído!', 'O contato foi removido com sucesso.');
            await mutate(); // Revalida do servidor
        } catch (error) {
            notify.error('Erro ao excluir', (error as Error).message);
            mutate(); // Rollback do optimistic
        }
    };

    const handleBulkDelete = async () => {
        notify.info("A excluir contatos...", `Por favor aguarde enquanto ${selectedRows.length} contatos são excluídos.`);

        try {
            // Optimistic update
            const newContacts = contacts.filter((c: ExtendedContact) => !selectedRows.includes(c.id));
            mutate({ ...contactsData, data: newContacts }, false);

            const results = await Promise.all(selectedRows.map(id => fetch(`/api/v1/contacts/${id}`, { method: 'DELETE' })));
            const failed = results.filter(res => !res.ok);

            if (failed.length > 0) {
                notify.warning('Atenção', `${failed.length} contatos não puderam ser excluídos. ${selectedRows.length - failed.length} foram removidos.`);
            } else {
                notify.success(`${selectedRows.length} contatos excluídos`, 'Os contatos selecionados foram removidos com sucesso.');
            }
            await mutate();
        } catch (error) {
            notify.error('Erro ao excluir', error instanceof Error ? error.message : 'Ocorreu um erro.');
            mutate();
        } finally {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = useCallback((id: string, checked: boolean) => {
        if (checked) {
            setSelectedRows(prev => [...prev, id]);
        } else {
            setSelectedRows(prev => prev.filter(rowId => rowId !== id));
        }
    }, []);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedRows(contacts.map(c => c.id));
        } else {
            setSelectedRows([]);
        }
    }, [contacts]);

    const refresh = () => mutate();

    return {
        // State
        contacts,
        loading,
        totalPages,
        selectedRows,
        view,
        setView,
        availableTags,
        availableLists,

        // URL/Filter State
        page,
        limit,
        searchTerm,
        tagFilter,
        listFilter,
        sortBy: sortByParam,
        setSortBy: (value: string) => updateUrl({ sortBy: value }),

        // Handlers
        setSearchTerm: handleSearch,
        handleSort,
        handlePageChange,
        handleLimitChange,
        handleTagFilterChange,
        handleListFilterChange,
        handleDelete,
        handleBulkDelete,
        handleSelectRow,
        handleSelectAll,
        setSelectedRows,
        refresh
    };
}
