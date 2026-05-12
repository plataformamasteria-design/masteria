import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, ListPlus, Tag, GitBranch, Globe, Users, Upload, Loader2, Search, Filter, X, AlertTriangle } from "lucide-react";

export function AudienceSelectionCard({
    campaignName, setCampaignName, targetType, setTargetType, setPhoneList, setSelectedSavedListId,
    loadingLists, savedLists, handleLoadSavedList, selectedSavedListId, phoneList,
    listInputMode, setListInputMode, phoneInput, setPhoneInput, handleAddPhones,
    fileInputRef, handleFileUpload, handleValidateWhatsApp, isValidating,
    handleFilterRegistered, handleRemoveGroups, isFiltering, removePhone,
    loadingTags, tags, selectedTagIds, setSelectedTagIds,
    loadingFunnels, funnels, selectedFunnelId, setSelectedFunnelId,
    stages, selectedStageId, setSelectedStageId
}: any) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Configuração do Disparo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>Nome da campanha</Label>
                    <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Promoção Natal 2026" />
                </div>
                <div>
                    <Label>Destinatários</Label>
                    <Select value={targetType} onValueChange={(v) => { setTargetType(v); setPhoneList([]); setSelectedSavedListId(""); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="list"><div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Lista de Números</div></SelectItem>
                            <SelectItem value="saved_list"><div className="flex items-center gap-2"><ListPlus className="h-4 w-4" /> Lista Salva</div></SelectItem>
                            <SelectItem value="tags"><div className="flex items-center gap-2"><Tag className="h-4 w-4" /> Por Etiqueta</div></SelectItem>
                            <SelectItem value="funnel"><div className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Etapa de Funil</div></SelectItem>
                            <SelectItem value="all"><div className="flex items-center gap-2"><Globe className="h-4 w-4" /> Toda a Base</div></SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Saved list */}
                {targetType === "saved_list" && (
                    <div className="space-y-3">
                        {loadingLists ? (
                            <Skeleton className="h-10 w-full" />
                        ) : savedLists?.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">Nenhuma lista salva. Crie uma na aba "Listas".</p>
                        ) : (
                            <div>
                                <Label>Selecione a lista</Label>
                                <Select value={selectedSavedListId} onValueChange={handleLoadSavedList}>
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
                        {phoneList.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>{phoneList.length} números carregados</Label>
                                    <div className="flex gap-1 flex-wrap">
                                        <Button variant="outline" size="sm" onClick={handleValidateWhatsApp} disabled={isValidating} className="gap-1 flex-1 sm:flex-none">
                                            {isValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                                            Validar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleFilterRegistered} disabled={isFiltering} className="gap-1 flex-1 sm:flex-none">
                                            {isFiltering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Filter className="h-3 w-3" />}
                                            Filtrar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleRemoveGroups} disabled={isFiltering} className="gap-1 flex-1 sm:flex-none text-red-500 hover:text-red-600 border-red-200">
                                            {isFiltering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                                            <span className="hidden sm:inline">Remover Grupos</span>
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setPhoneList([])}>Limpar</Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                    {phoneList.slice(0, 30).map((phone: any) => (
                                        <Badge key={phone} variant="secondary" className="text-xs">{phone}</Badge>
                                    ))}
                                    {phoneList.length > 30 && <Badge variant="outline">+{phoneList.length - 30} mais</Badge>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* List-based input with toggle */}
                {targetType === "list" && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Button
                                variant={listInputMode === "manual" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setListInputMode("manual")}
                                className="flex-1"
                            >
                                Digitar números
                            </Button>
                            <Button
                                variant={listInputMode === "file" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setListInputMode("file")}
                                className="flex-1"
                            >
                                <Upload className="h-4 w-4 mr-1" /> Importar arquivo
                            </Button>
                        </div>

                        {listInputMode === "manual" && (
                            <div>
                                <Label>Digite números separados por vírgula ou quebra de linha</Label>
                                <div className="flex gap-2 mt-1">
                                    <Textarea value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="5511999999999, 5521888888888" rows={3} className="flex-1" />
                                    <Button onClick={handleAddPhones} size="sm" className="self-end">Adicionar</Button>
                                </div>
                            </div>
                        )}

                        {listInputMode === "file" && (
                            <div>
                                <Label>Importar arquivo (CSV, TXT)</Label>
                                <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleFileUpload} className="hidden" />
                                <Button variant="outline" className="w-full mt-1" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="h-4 w-4 mr-2" /> Selecionar Arquivo
                                </Button>
                            </div>
                        )}

                        {phoneList.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>{phoneList.length} números</Label>
                                    <div className="flex gap-1 flex-wrap">
                                        <Button variant="outline" size="sm" onClick={handleValidateWhatsApp} disabled={isValidating} className="gap-1">
                                            {isValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                                            Validar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleFilterRegistered} disabled={isFiltering} className="gap-1 flex-1 sm:flex-none">
                                            {isFiltering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Filter className="h-3 w-3" />}
                                            Filtrar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleRemoveGroups} disabled={isFiltering} className="gap-1 flex-1 sm:flex-none text-red-500 hover:text-red-600 border-red-200">
                                            {isFiltering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                                            <span className="hidden sm:inline">Remover Grupos</span>
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setPhoneList([])}>Limpar</Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                    {phoneList.slice(0, 50).map((phone: any) => (
                                        <Badge key={phone} variant="secondary" className="gap-1">
                                            {phone}
                                            <X className="h-3 w-3 cursor-pointer" onClick={() => removePhone(phone)} />
                                        </Badge>
                                    ))}
                                    {phoneList.length > 50 && <Badge variant="outline">+{phoneList.length - 50} mais</Badge>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tags-based */}
                {targetType === "tags" && (
                    <div>
                        <Label>Selecione as etiquetas</Label>
                        {loadingTags ? <Skeleton className="h-10 w-full mt-2" /> : (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {tags?.map((tag: any) => (
                                    <Badge key={tag.id} variant={selectedTagIds.includes(tag.id) ? "default" : "outline"} className="cursor-pointer"
                                        style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                                        onClick={() => setSelectedTagIds((prev: any) => prev.includes(tag.id) ? prev.filter((id: string) => id !== tag.id) : [...prev, tag.id])}
                                    >
                                        {tag.name}
                                    </Badge>
                                ))}
                                {tags?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etiqueta encontrada.</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* Funnel-based */}
                {targetType === "funnel" && (
                    <div className="space-y-3">
                        {loadingFunnels ? <Skeleton className="h-10 w-full" /> : (
                            <>
                                <div>
                                    <Label>Funil</Label>
                                    <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                                        <SelectContent>{funnels?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                {selectedFunnelId && (
                                    <div>
                                        <Label>Etapa</Label>
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

                {targetType === "all" && (
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                        <span>Será enviado para <strong>todos os contatos</strong> da base (exceto grupos).</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
