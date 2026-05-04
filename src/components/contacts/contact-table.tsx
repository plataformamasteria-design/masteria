'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Upload, Users, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '../page-header';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { EmptyState } from '@/components/ui/empty-state';

import { useContactsController } from '@/hooks/use-contacts-controller';
import { AddContactDialog } from './add-contact-dialog';
import { ImportContactsDialog } from './import-contacts-dialog';
import { ContactsToolbar } from './contacts-toolbar';
import { ContactsTableView } from './table/contacts-table-view';
import { ContactsGridView } from './grid/contacts-grid-view';
import { ContactsBulkActions } from './contacts-bulk-actions';

export function ContactTable() {
    const router = useRouter();
    const isMobileDetected = useIsMobile();
    const [mounted, setMounted] = useState(false);
    const [isAddContactOpen, setIsAddContactOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isMobile = mounted ? isMobileDetected : false;

    const {
        contacts,
        loading,
        totalPages,
        selectedRows,
        view,
        setView,
        availableTags,
        availableLists,
        page,
        limit,
        searchTerm,
        tagFilter,
        listFilter,
        sortBy,
        setSortBy,
        handleSort,
        setSearchTerm,
        handlePageChange,
        handleLimitChange,
        handleTagFilterChange,
        handleListFilterChange,
        handleDelete,
        handleBulkDelete,
        handleSelectRow,
        handleSelectAll,
        refresh
    } = useContactsController();

    const handleRowClick = (contactId: string) => {
        router.push(`/contacts/${contactId}`);
    };

    const hasActiveFilters = searchTerm || tagFilter !== 'all' || listFilter !== 'all';

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Contatos"
                    description="Gerencie a sua base de clientes e leads."
                />
                <div className="flex items-center gap-2">
                    <AddContactDialog
                        open={isAddContactOpen}
                        onOpenChange={setIsAddContactOpen}
                        onSaveSuccess={refresh}
                    >
                        <Button variant="outline" onClick={() => setIsAddContactOpen(true)}>
                            <PlusCircle className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Adicionar</span>
                        </Button>
                    </AddContactDialog>
                    <ImportContactsDialog onImportCompleted={refresh}>
                        <Button>
                            <Upload className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Importar</span>
                        </Button>
                    </ImportContactsDialog>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <ContactsToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    tagFilter={tagFilter}
                    onTagFilterChange={handleTagFilterChange}
                    listFilter={listFilter}
                    onListFilterChange={handleListFilterChange}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    availableTags={availableTags}
                    availableLists={availableLists}
                    view={view}
                    onViewChange={setView}
                    isMobile={isMobile}
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : contacts.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="Nenhum contato encontrado"
                    description={
                        hasActiveFilters
                            ? "Não encontramos contatos com os filtros selecionados. Tente ajustar seus critérios de busca."
                            : "Você ainda não tem contatos cadastrados. Adicione ou importe contatos para começar."
                    }
                    actionLabel={!hasActiveFilters ? "Adicionar Contato" : undefined}
                    onAction={!hasActiveFilters ? () => setIsAddContactOpen(true) : undefined}
                />
            ) : (
                <>
                    {view === 'table' && !isMobile ? (
                        <ContactsTableView
                            contacts={contacts}
                            selectedRows={selectedRows}
                            onRowClick={handleRowClick}
                            onSelectAll={handleSelectAll}
                            onSelectRow={handleSelectRow}
                            onDelete={handleDelete}
                            onSort={handleSort}
                        />
                    ) : view === 'grid' && !isMobile ? (
                        <ContactsGridView
                            contacts={contacts}
                            onRowClick={handleRowClick}
                            selectedRows={selectedRows}
                            onSelectRow={handleSelectRow}
                        />
                    ) : (
                        // Mobile View - can reuse Grid or TableMobile?
                        // The original code had a specific mobile view in ContactTableView but it was conditional.
                        // I moved table view to `ContactsTableView` component.
                        // I should check if `ContactsTableView` handles mobile. 
                        // In `contacts-table-view.tsx` I removed the mobile check! 
                        // The original `ContactTableView` had a mobile branch.
                        // I should have preserved the mobile view or used `ContactsGridView` for mobile?
                        // Mobile view is basically Cards. `ContactsGridView` is Cards.
                        // So I'll use `ContactsGridView` for mobile.
                        <ContactsGridView
                            contacts={contacts}
                            onRowClick={handleRowClick}
                            selectedRows={selectedRows}
                            onSelectRow={handleSelectRow}
                        />
                    )}
                </>
            )}

            {totalPages > 1 && contacts.length > 0 && (
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 text-sm text-muted-foreground">
                            {selectedRows.length > 0 ? (
                                `${selectedRows.length} de ${contacts.length} linha(s) selecionadas.`
                            ) : (
                                `Página ${page} de ${totalPages}.`
                            )}
                        </div>
                        <Select value={limit.toString()} onValueChange={(value) => handleLimitChange(parseInt(value, 10))}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 25, 50, 100, 250, 500].map(val => (
                                    <SelectItem key={val} value={val.toString()}>{val} por página</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <PaginationControls
                        totalItems={totalPages * limit}
                        pageSize={limit}
                        currentPage={page}
                        onPageChange={handlePageChange}
                    />
                </div>
            )}

            <ContactsBulkActions
                selectedCount={selectedRows.length}
                onClearSelection={() => handleSelectAll(false)}
                onDelete={handleBulkDelete}
            />
        </>
    );
}
