import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPlus, Tag, GitBranch, Ban, Users } from "lucide-react";

export function AudienceExclusionCard({
    targetType, setTargetType,
    loadingLists, savedLists, selectedSavedListId, setSelectedSavedListId,
    loadingTags, tags, selectedTagIds, setSelectedTagIds,
    loadingFunnels, funnels, selectedFunnelId, setSelectedFunnelId,
    stages, selectedStageId, setSelectedStageId
}: any) {
    return (
        <Card className="border-destructive/20 border-2">
            <CardHeader className="pb-3 bg-destructive/5 rounded-t-lg">
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                    <Ban className="h-4 w-4" />
                    Exceções e Filtros (Lista Negra)
                </CardTitle>
                <CardDescription>
                    Selecione contatos que <strong className="text-destructive">não devem</strong> receber a mensagem.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div>
                    <Label>Subtrair Destinatários</Label>
                    <Select value={targetType} onValueChange={(v) => { setTargetType(v); setSelectedSavedListId(""); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none"><div className="flex items-center gap-2">Nenhuma Exclusão</div></SelectItem>
                            <SelectItem value="saved_list"><div className="flex items-center gap-2"><ListPlus className="h-4 w-4" /> Lista Salva</div></SelectItem>
                            <SelectItem value="tags"><div className="flex items-center gap-2"><Tag className="h-4 w-4" /> Por Etiqueta</div></SelectItem>
                            <SelectItem value="funnel"><div className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Etapa de Funil</div></SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {targetType === "saved_list" && (
                    <div className="space-y-3">
                        {loadingLists ? (
                            <Skeleton className="h-10 w-full" />
                        ) : savedLists?.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">Nenhuma lista salva. Crie uma na aba "Listas".</p>
                        ) : (
                            <div>
                                <Label>Selecione a lista para excluir</Label>
                                <Select value={selectedSavedListId} onValueChange={setSelectedSavedListId}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar lista..." /></SelectTrigger>
                                    <SelectContent>
                                        {savedLists?.map((l: any) => (
                                            <SelectItem key={l.id} value={l.id}>
                                                <span className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5" />
                                                    {l.name} ({l.phone_count} contatos)
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                )}

                {targetType === "tags" && (
                    <div>
                        <Label>Selecione as etiquetas a excluir</Label>
                        {loadingTags ? <Skeleton className="h-10 w-full mt-2" /> : (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {tags?.map((tag: any) => (
                                    <Badge key={tag.id} variant={selectedTagIds.includes(tag.id) ? "default" : "outline"} className="cursor-pointer border-destructive/20"
                                        style={selectedTagIds.includes(tag.id) ? { backgroundColor: 'hsl(var(--destructive))', color: 'white' } : {}}
                                        onClick={() => setSelectedTagIds((prev: any) => prev.includes(tag.id) ? prev.filter((id: string) => id !== tag.id) : [...prev, tag.id])}
                                    >
                                        <Ban className="h-3 w-3 mr-1 opacity-70" />
                                        {tag.name}
                                    </Badge>
                                ))}
                                {tags?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etiqueta encontrada.</p>}
                            </div>
                        )}
                    </div>
                )}

                {targetType === "funnel" && (
                    <div className="space-y-3">
                        {loadingFunnels ? <Skeleton className="h-10 w-full" /> : (
                            <>
                                <div>
                                    <Label>Funil para Exclusão</Label>
                                    <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                                        <SelectContent>{funnels?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                {selectedFunnelId && (
                                    <div>
                                        <Label>Etapa Excluída</Label>
                                        <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                                            <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                                            <SelectContent>{stages?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
