import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useDebounce } from '@/hooks/use-debounce';
import type { ExtendedContact, ContactList, Tag } from '@/lib/types';

export type SortKey = 'name' | 'createdAt';
export type ViewType = 'table' | 'grid';

interface UseContactsControllerProps {
    initialLimit?: number;
}

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
    const [contacts, setContacts] = useState<ExtendedContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [view, setView] = useState<ViewType>('table');

    // Filter Options State
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [availableLists, setAvailableLists] = useState<ContactList[]>([]);

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

    const fetchContacts = useCallback(async () => {
        setLoading(true);
        try {
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

            const response = await fetch(`/api/v1/contacts?${params.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch contacts");

            const data = await response.json();
            setContacts(data.data || []);
            setTotalPages(data.totalPages);

        } catch (error) {
            console.error(error);
            notify.error("Erro", "Não foi possível carregar os contatos.");
        } finally {
            setLoading(false);
        }
    }, [page, limit, sortByParam, debouncedSearch, tagFilter, listFilter, notify]);

    // Initial Fetch & Filters
    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [tagsRes, listsRes] = await Promise.all([
                    fetch('/api/v1/tags'),
                    fetch('/api/v1/lists')
                ]);
                if (!tagsRes.ok || !listsRes.ok) throw new Error("Failed to fetch filter options");
                const tagsData = await tagsRes.json();
                const listsData = await listsRes.json();

                // Handle potential { data: [...] } wrapper or direct array
                const safeTags = Array.isArray(tagsData) ? tagsData : (Array.isArray(tagsData?.data) ? tagsData.data : []);
                const safeLists = Array.isArray(listsData) ? listsData : (Array.isArray(listsData?.data) ? listsData.data : []);

                setAvailableTags(safeTags);
                setAvailableLists(safeLists);
            } catch (error) {
                console.error(error);
                // Silent fail or minor notification for filters
            }
        };
        fetchFilters();
    }, []);

    // Handlers
    const handleSearch = (term: string) => {
        setSearchTerm(term);
        // We rely on debouncedSearch -> fetchContacts, but we need to reset page to 1 on search change
        //Ideally handled in the effect or by updating URL immediately for page 1
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
        const originalContacts = [...contacts];
        setContacts(prev => prev.filter(c => c.id !== contactId));

        try {
            const response = await fetch(`/api/v1/contacts/${contactId}`, { method: 'DELETE' });
            if (response.status !== 204) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao excluir contato.');
            }
            notify.success('Contato excluído!', 'O contato foi removido com sucesso.');
            fetchContacts();
        } catch (error) {
            notify.error('Erro ao excluir', (error as Error).message);
            setContacts(originalContacts);
        }
    };

    const handleBulkDelete = async () => {
        notify.info("A excluir contatos...", `Por favor aguarde enquanto ${selectedRows.length} contatos são excluídos.`);

        const originalContacts = [...contacts];
        const newContacts = contacts.filter(c => !selectedRows.includes(c.id));
        setContacts(newContacts);

        try {
            const results = await Promise.all(selectedRows.map(id => fetch(`/api/v1/contacts/${id}`, { method: 'DELETE' })));
            const failed = results.filter(res => !res.ok);

            if (failed.length > 0) {
                // Partially successful
                notify.warning('Atenção', `${failed.length} contatos não puderam ser excluídos. ${selectedRows.length - failed.length} foram removidos.`);
            } else {
                notify.success(`${selectedRows.length} contatos excluídos`, 'Os contatos selecionados foram removidos com sucesso.');
            }
            fetchContacts();
        } catch (error) {
            notify.error('Erro ao excluir', error instanceof Error ? error.message : 'Ocorreu um erro.');
            setContacts(originalContacts);
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

    const refresh = fetchContacts;

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
        setSortBy: (value: string) => updateUrl({ sortBy: value }), // Return the full string "field:order"

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
