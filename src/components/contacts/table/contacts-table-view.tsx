import { memo } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
    AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { CommunicationButton } from '@/components/contacts/communication-modal';
import { ArrowUpDown, MoreHorizontal, Phone, Edit, Trash2 } from 'lucide-react';
import { ExtendedContact } from '@/lib/types';
// Note: SortKey is now in hook/types, importing from local where needed or redefine.
// I'll assume I can import SortKey from the hook or just use string for now to avoid circular deps if hook imports types
// Actually I defined SortKey in the hook file. I should move it to types.ts or just export it.
// I exported it from the hook file.
import { SortKey as HookSortKey } from '@/hooks/use-contacts-controller';

interface ContactsTableViewProps {
    contacts: ExtendedContact[];
    selectedRows: string[];
    onRowClick: (id: string) => void;
    onSelectAll: (checked: boolean) => void;
    onSelectRow: (id: string, checked: boolean) => void;
    onDelete: (id: string) => void;
    onSort: (key: HookSortKey) => void;
}

export const ContactsTableView = memo(({
    contacts,
    selectedRows,
    onRowClick,
    onSelectAll,
    onSelectRow,
    onDelete,
    onSort
}: ContactsTableViewProps) => {

    const allSelected = contacts.length > 0 && selectedRows.length === contacts.length;
    const isIndeterminate = selectedRows.length > 0 && selectedRows.length < contacts.length;

    return (
        <div className="w-full border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] bg-white/[0.02] backdrop-blur-md rounded-[2rem] overflow-hidden relative">
            <div className="w-full overflow-auto custom-scrollbar pb-2">
                <Table>
                    <TableHeader className="bg-black/20 border-b border-white/5">
                        <TableRow className="hover:bg-white/[0.02] border-white/5 transition-colors">
                            <TableHead className="w-[50px] pl-6">
                                <Checkbox
                                    checked={allSelected || (isIndeterminate ? 'indeterminate' : false)}
                                    onCheckedChange={(checked) => onSelectAll(!!checked)}
                                />
                            </TableHead>
                            <TableHead className="w-[30%]">
                                <Button variant="ghost" size="sm" className="-ml-3 h-8 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70 hover:text-foreground" onClick={() => onSort('name')}>
                                    Nome <ArrowUpDown className="ml-2 h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Telefone</TableHead>
                            <TableHead className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Email</TableHead>
                            <TableHead className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Tags</TableHead>
                            <TableHead className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Listas</TableHead>
                            <TableHead className="w-[180px]">
                                <Button variant="ghost" size="sm" className="-ml-3 h-8 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70 hover:text-foreground" onClick={() => onSort('createdAt')}>
                                    Data de Criação <ArrowUpDown className="ml-2 h-3 w-3" />
                                </Button>
                            </TableHead>
                            <TableHead className="text-right pr-6 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70 w-[80px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contacts.map((contact) => (
                            <TableRow
                                key={contact.id}
                                className={`group cursor-pointer hover:bg-white/[0.04] border-white/5 transition-colors ${selectedRows.includes(contact.id) ? 'bg-white/[0.05]' : ''}`}
                            >
                                <TableCell className="pl-6">
                                    <Checkbox
                                        checked={selectedRows.includes(contact.id)}
                                        onCheckedChange={(checked) => onSelectRow(contact.id, !!checked)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </TableCell>
                                <TableCell>
                                    <span className="font-bold hover:underline text-foreground block truncate cursor-pointer" onClick={(e) => { e.stopPropagation(); onRowClick(contact.id); }}>
                                        {contact.name}
                                    </span>
                                </TableCell>
                                <TableCell className="text-muted-foreground/80 text-[13px] font-mono tracking-tight">{contact.phone}</TableCell>
                                <TableCell className="text-muted-foreground/80 text-[13px] truncate max-w-[180px]">{contact.email}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1.5">
                                        {contact.tags?.slice(0, 2).map(tag => (
                                            <Badge key={tag.id} variant="secondary" className="text-[10px] uppercase font-bold px-2 py-0.5" style={{ backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '30', borderWidth: '1px' }}>
                                                {tag.name}
                                            </Badge>
                                        ))}
                                        {(contact.tags?.length || 0) > 2 && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-card/50">+{contact.tags!.length - 2}</Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1.5">
                                        {contact.lists?.slice(0, 2).map(list => (
                                            <Badge key={list.id} variant="outline" className="text-[10px] uppercase px-2 py-0.5 font-bold text-muted-foreground/80 bg-card/30">
                                                {list.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground/70 text-[13px] font-medium">
                                    {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('pt-BR') : '-'}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <CommunicationButton
                                                    contact={contact}
                                                    trigger={
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                            <Phone className="mr-2 h-4 w-4" /> Ligar
                                                        </DropdownMenuItem>
                                                    }
                                                />
                                                <DropdownMenuItem onSelect={() => onRowClick(contact.id)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                                </DropdownMenuItem>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Tem certeza que deseja excluir o contato &quot;{contact.name}&quot;? Esta ação não pode ser desfeita.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => onDelete(contact.id)} className="bg-destructive hover:bg-destructive/90">Sim, Excluir</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
});

ContactsTableView.displayName = 'ContactsTableView';
