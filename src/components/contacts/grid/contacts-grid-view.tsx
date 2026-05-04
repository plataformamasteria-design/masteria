import { memo } from 'react';
import { ExtendedContact } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { CommunicationButton } from '@/components/contacts/communication-modal';
import { Checkbox } from '@/components/ui/checkbox';

interface ContactsGridViewProps {
    contacts: ExtendedContact[];
    onRowClick: (id: string) => void;
    // Optional: selection support in grid view if desired
    selectedRows: string[];
    onSelectRow: (id: string, checked: boolean) => void;
}

export const ContactsGridView = memo(({ contacts, onRowClick, selectedRows, onSelectRow }: ContactsGridViewProps) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {contacts.map(contact => (
                <Card
                    key={contact.id}
                    className={`hover:shadow-lg transition-all relative border-transparent hover:border-border cursor-pointer group ${selectedRows.includes(contact.id) ? 'ring-2 ring-primary border-primary' : ''}`}
                    onClick={() => onRowClick(contact.id)}
                >
                    <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity data-[selected=true]:opacity-100" data-selected={selectedRows.includes(contact.id)}>
                        <Checkbox
                            checked={selectedRows.includes(contact.id)}
                            onCheckedChange={(checked) => onSelectRow(contact.id, !!checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-background/80 backdrop-blur-sm data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                    </div>
                    <div className="absolute top-2 right-2 z-10">
                        <CommunicationButton
                            contact={contact}
                            trigger={
                                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="h-8 w-8 bg-background/50 hover:bg-background backdrop-blur-sm">
                                    <Phone className="h-3.5 w-3.5" />
                                </Button>
                            }
                        />
                    </div>
                    <CardContent className="pt-8 flex flex-col items-center text-center">
                        <Avatar className="h-20 w-20 mb-4 ring-2 ring-background shadow-sm">
                            <AvatarImage src={contact.avatarUrl || `https://placehold.co/80x80.png`} alt={contact.name} data-ai-hint="avatar user" />
                            <AvatarFallback>{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold text-lg leading-tight mb-1">{contact.name}</p>
                        <p className="text-sm text-muted-foreground mb-3">{contact.phone}</p>
                        <div className="flex gap-1 flex-wrap justify-center min-h-[1.5rem]">
                            {contact.tags?.slice(0, 3).map(tag => (
                                <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 py-0" style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40', border: '1px solid' }}>
                                    {tag.name}
                                </Badge>
                            ))}
                            {(contact.tags?.length || 0) > 3 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{contact.tags!.length - 3}</Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
});

ContactsGridView.displayName = 'ContactsGridView';
