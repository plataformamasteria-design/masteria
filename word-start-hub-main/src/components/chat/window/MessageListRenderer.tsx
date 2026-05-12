import { Loader2 } from 'lucide-react';
import { MessageDaySeparator } from '../MessageDaySeparator';
import { SystemMessageBubble } from '../SystemMessageBubble';
import { InternalMessageBubble } from '../InternalMessageBubble';
import { MessageBubble } from '../MessageBubble';

export function MessageListRenderer({
    scrollRef, handleScroll, loading, messagesByDay, loadingMore, hasMore, loadMoreMessages,
    localChat, handleReply, handleEdit, handleDeleteForEveryone, handleDeleteForPlatform,
    handleOpenGroupSenderLead, handleSendToFolder, handleForward, handlePinMessage,
    isMessagePinned, groupParticipantsMap, pendingMessages, hasEquivalentRealMessage, handleReact
}: any) {
    return (
        <div
            className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50"
            ref={scrollRef}
            onScroll={handleScroll}
        >
            {loading ? (
                <div className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Carregando mensagens...
                </div>
            ) : messagesByDay.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                    Nenhuma mensagem ainda. Envie a primeira!
                </div>
            ) : (
                <div className="space-y-1">
                    {loadingMore && (
                        <div className="text-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Carregando mensagens anteriores...</span>
                        </div>
                    )}

                    {hasMore && !loadingMore && (
                        <div className="text-center py-2">
                            <span className="text-xs text-muted-foreground">Role para cima para ver mais mensagens</span>
                        </div>
                    )}

                    {messagesByDay.map((group: any) => (
                        <div key={group.date}>
                            <MessageDaySeparator date={group.date} />
                            {group.messages.map((message: any) => {
                                if (message.message_type === 'system') {
                                    return <SystemMessageBubble key={message.id} message={message} />;
                                }
                                return message.private ? (
                                    <InternalMessageBubble key={message.id} message={message} />
                                ) : (
                                    <MessageBubble
                                        key={message.id}
                                        message={message}
                                        isGroupChat={localChat?.is_group}
                                        onReply={handleReply}
                                        onEdit={handleEdit}
                                        onDeleteForEveryone={handleDeleteForEveryone}
                                        onDeleteForPlatform={handleDeleteForPlatform}
                                        onOpenGroupSenderLead={handleOpenGroupSenderLead}
                                        onSendToFolder={handleSendToFolder}
                                        onForward={handleForward}
                                        onPinMessage={handlePinMessage}
                                        isMessagePinned={isMessagePinned}
                                        participantsMap={localChat?.is_group ? groupParticipantsMap : undefined}
                                        onReact={handleReact}
                                    />
                                );
                            })}
                        </div>
                    ))}

                    {pendingMessages.length > 0 && (
                        <div className="space-y-1">
                            {pendingMessages
                                .filter((p: any) => !hasEquivalentRealMessage(p))
                                .map((message: any) => (
                                    <MessageBubble
                                        key={message.id}
                                        message={message}
                                        isGroupChat={localChat?.is_group}
                                        onReply={handleReply}
                                        onEdit={handleEdit}
                                        onDeleteForEveryone={handleDeleteForEveryone}
                                        onDeleteForPlatform={handleDeleteForPlatform}
                                        onOpenGroupSenderLead={handleOpenGroupSenderLead}
                                        onSendToFolder={handleSendToFolder}
                                        onForward={handleForward}
                                        participantsMap={localChat?.is_group ? groupParticipantsMap : undefined}
                                        onReact={handleReact}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
