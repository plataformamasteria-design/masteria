// src/components/contacts/import-contacts-dialog.tsx
'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Upload, FileDown, Loader2, CheckCircle, UserPlus, UserCheck, UserX, XCircle, Users, ClipboardPaste } from 'lucide-react';
import { Progress } from '../ui/progress';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';
import { MultiSelectCreatable } from '../ui/multi-select-creatable';

type ImportStep = 'upload' | 'mapping' | 'segmentation' | 'processing' | 'summary';
type _UploadMode = 'csv' | 'paste';

type ImportSummary = {
    created: number;
    updated: number;
    ignored: number;
    errors: number;
}

const UploadStep = ({ onFileAccepted, onPasteAccepted }: { 
    onFileAccepted: (file: File) => void;
    onPasteAccepted: (phones: string) => void;
}): JSX.Element => {
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);
    const [isDragging, setIsDragging] = useState(false);
    const [pastedPhones, setPastedPhones] = useState('');

    const handleFileChange = (files: FileList | null): void => {
        if (files && files.length > 0) {
            const file = files[0];
            if (!file) return;
            if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
                notify.error('Ficheiro Inválido', 'Por favor, selecione um ficheiro .csv');
                return;
            }
            if (file.size === 0) {
                notify.error('Ficheiro Vazio', 'O ficheiro selecionado está vazio.');
                return;
            }
            onFileAccepted(file);
        }
    }

    const onDragOver = (e: React.DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    
    const onDrop = (e: React.DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileChange(e.dataTransfer.files);
    };

    const handlePasteSubmit = (): void => {
        if (!pastedPhones.trim()) {
            notify.error('Campo Vazio', 'Por favor, cole pelo menos um número de telefone.');
            return;
        }
        onPasteAccepted(pastedPhones);
    };

    return (
        <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="csv">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload de Ficheiro
                </TabsTrigger>
                <TabsTrigger value="paste">
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Colar Números
                </TabsTrigger>
            </TabsList>
            
            <TabsContent value="csv" className="space-y-4 mt-4">
                <div
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onDragLeave={onDragLeave}
                    className={cn(
                        "flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                        isDragging ? "border-primary bg-primary/10" : "border-border"
                    )}
                >
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Arraste e solte o ficheiro CSV aqui</p>
                    <p className="text-xs text-muted-foreground">ou</p>
                    <Button type="button" variant="link" onClick={(): void => document.getElementById('csv-upload')?.click()}>
                        selecione um ficheiro
                    </Button>
                    <Input id="csv-upload" type="file" className="hidden" accept=".csv" onChange={(e): void => handleFileChange(e.target.files)} />
                </div>
                <Button type="button" variant="link" className="w-full" size="sm" asChild>
                    <a href="/exemplo-importacao-contatos.csv" download="exemplo-importacao-contatos.csv">
                        <FileDown className="mr-2 h-4 w-4" />
                        Baixar ficheiro de exemplo
                    </a>
                </Button>
            </TabsContent>
            
            <TabsContent value="paste" className="space-y-4 mt-4">
                <div className="space-y-3">
                    <Label htmlFor="phone-paste">Cole os números de telefone (um por linha)</Label>
                    <Textarea
                        id="phone-paste"
                        placeholder="5511955552222&#10;5521987654321&#10;5585912345678"
                        className="min-h-[200px] font-mono text-sm"
                        value={pastedPhones}
                        onChange={(e) => setPastedPhones(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        Formato: DDI + DDD + Número (exemplo: 5511955552222)
                    </p>
                </div>
                <Button type="button" onClick={handlePasteSubmit} className="w-full">
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Processar Números
                </Button>
            </TabsContent>
        </Tabs>
    )
}

const MappingStep = ({ csvHeaders, mappings, setMappings, totalRows }: { 
    csvHeaders: string[], 
    mappings: Record<string, string>, 
    setMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    totalRows: number
}): JSX.Element => {
    const systemFields = [
        { value: 'name', label: 'Nome' },
        { value: 'phone', label: 'Telefone' },
        { value: 'email', label: 'Email' },
        { value: 'avatarUrl', label: 'URL do Avatar' },
        { value: 'addressStreet', label: 'Rua (Endereço)' },
        { value: 'addressNumber', label: 'Número (Endereço)' },
        { value: 'addressComplement', label: 'Complemento (Endereço)' },
        { value: 'addressDistrict', label: 'Bairro (Endereço)' },
        { value: 'addressCity', label: 'Cidade (Endereço)' },
        { value: 'addressState', label: 'Estado (Endereço)' },
        { value: 'addressZipCode', label: 'CEP (Endereço)' },
        { value: 'notes', label: 'Notas' },
    ];

    const handleMappingChange = (csvHeader: string, systemField: string): void => {
        setMappings(prev => {
            const newMappings = {...prev};
            Object.keys(newMappings).forEach(key => {
                if (newMappings[key] === csvHeader) {
                    delete newMappings[key];
                }
            });
            if (csvHeader === 'ignore') {
                delete newMappings[systemField];
            } else {
                newMappings[systemField] = csvHeader;
            }
            return newMappings;
        });
    }

    return (
        <div className="space-y-6">
            <Card className="bg-muted/50">
                <CardContent className="p-3 flex items-center justify-center gap-3">
                    <Users className="h-6 w-6 text-primary"/>
                    <p className="text-base font-semibold">
                        <span className="text-2xl font-bold text-primary">{totalRows}</span> contatos encontrados no ficheiro.
                    </p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-80 overflow-y-auto pr-2">
                {systemFields.map((field) => (
                    <div key={field.value} className="grid grid-cols-2 gap-4 items-center">
                        <Label htmlFor={`map-${field.value}`}>{field.label}</Label>
                        <Select
                            value={mappings[field.value] || 'ignore'}
                            onValueChange={(value): void => handleMappingChange(value, field.value)}
                        >
                            <SelectTrigger id={`map-${field.value}`}>
                                <SelectValue placeholder="Selecione uma coluna" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ignore">Não Importar</SelectItem>
                                {csvHeaders.map(header => (
                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
        </div>
    );
}

const SegmentationStep = ({ onUpdateExistingChange, selectedListIds, setSelectedListIds, selectedTagIds, setSelectedTagIds }: { 
    onUpdateExistingChange: (value: boolean) => void,
    selectedListIds: string[],
    setSelectedListIds: React.Dispatch<React.SetStateAction<string[]>>,
    selectedTagIds: string[],
    setSelectedTagIds: React.Dispatch<React.SetStateAction<string[]>>,
}): JSX.Element => {
    return (
        <div className="space-y-6">
            <div className="space-y-4">
                 <Label>Segmentação Adicional</Label>
                 <MultiSelectCreatable
                    createResourceType="tag"
                    createEndpoint="tags"
                    selected={selectedTagIds}
                    onChange={setSelectedTagIds}
                    placeholder="Adicionar tags..."
                 />
                 <MultiSelectCreatable
                    createResourceType="list"
                    createEndpoint="lists"
                    selected={selectedListIds}
                    onChange={setSelectedListIds}
                    placeholder="Adicionar a listas..."
                 />
            </div>

             <div className="space-y-3 pt-4 border-t">
                <Label>Contatos Existentes</Label>
                <RadioGroup defaultValue="skip" className="space-y-1" onValueChange={(value): void => onUpdateExistingChange(value === 'update')}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id="skip" />
                        <Label htmlFor="skip">Não atualizar contatos existentes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="update" id="update" />
                        <Label htmlFor="update">Atualizar informações se o telefone já existir</Label>
                    </div>
                </RadioGroup>
            </div>
        </div>
    );
};

const ProcessingStep = ({ progress, totalRows }: { progress: number, totalRows: number }): JSX.Element => (
    <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h3 className="text-lg font-semibold">A importar os seus contatos...</h3>
        <p className="text-sm text-muted-foreground">
            Isto pode demorar alguns minutos. Por favor, não feche esta janela.
        </p>
        <Progress value={(progress / totalRows) * 100} className="w-full" />
        <p className="text-sm text-muted-foreground">
            Processando {progress} de {totalRows} contatos...
        </p>
    </div>
);

const SummaryStep = ({ summary }: { summary: ImportSummary | null }): JSX.Element => {
    const stats = [
        { label: 'Contatos Criados', value: summary?.created ?? 0, icon: UserPlus, color: 'text-green-500' },
        { label: 'Contatos Atualizados', value: summary?.updated ?? 0, icon: UserCheck, color: 'text-blue-500' },
        { label: 'Contatos Ignorados', value: summary?.ignored ?? 0, icon: UserX, color: 'text-yellow-500' },
        { label: 'Linhas com Erro', value: summary?.errors ?? 0, icon: XCircle, color: 'text-red-500' },
    ];

    return (
        <div className="space-y-6 text-center">
            <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold">Importação Concluída!</h3>
            <div className="grid grid-cols-2 gap-4">
                {stats.map(stat => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                                <Icon className={cn('h-4 w-4', stat.color)} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    );
};

interface ImportContactsDialogProps {
    onImportCompleted?: () => void;
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ImportContactsDialog({ onImportCompleted, children, open: externalOpen, onOpenChange }: ImportContactsDialogProps): JSX.Element {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvRows, setCsvRows] = useState<Record<string, unknown>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { toast } = useToast();
  const notify = React.useMemo(() => createToastNotifier(toast), [toast]);

  const reset = useCallback((): void => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setMappings({});
    setUpdateExisting(false);
    setProgress(0);
    setTotalRows(0);
    setImportSummary(null);
    setSelectedListIds([]);
    setSelectedTagIds([]);
  }, []);

  const handleOpenChange = (open: boolean): void => {
    setIsOpen(open);
    if (!open) {
      if (step === 'summary' && onImportCompleted) {
        onImportCompleted();
      }
      reset();
    }
  }

  const handleFileAccepted = (file: File): void => {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const headers = (results.meta.fields || []).filter(h => h); // Filtra cabeçalhos vazios
            const data = results.data as Record<string, unknown>[];
            if (headers.length === 0 || data.length === 0) {
                notify.error('Ficheiro Inválido ou Vazio', 'Verifique o conteúdo e a formatação do seu ficheiro CSV.');
                reset();
                return;
            }
            setCsvHeaders(headers);
            setTotalRows(data.length);
            setCsvRows(data);
            setStep('mapping');
        },
        error: (error) => {
            notify.error('Erro de Leitura', `Não foi possível analisar o ficheiro: ${error.message}`);
            reset();
        }
    });
  }

  const handlePasteAccepted = async (phonesText: string): Promise<void> => {
    const phones = phonesText
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    if (phones.length === 0) {
      notify.error('Nenhum Número Encontrado', 'Por favor, cole pelo menos um número de telefone válido.');
      return;
    }

    try {
      const response = await fetch('/api/v1/contacts/normalize-phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao processar números.');
      }

      const { normalized, total: _total, valid, invalid } = await response.json();
      
      if (normalized.length === 0) {
        notify.error('Nenhum Número Válido', 'Não foi possível encontrar números de telefone válidos. Verifique o formato e tente novamente.');
        return;
      }

      const csvData = normalized.map((item: { phone: string; valid: boolean }, _index: number) => ({
        phone: item.phone,
        name: `Contato ${item.phone.slice(-8)}`,
      }));

      if (invalid > 0) {
        notify.warning(
          'Alguns Números Ignorados',
          `${valid} números válidos processados. ${invalid} números foram ignorados por formato inválido.`
        );
      }

      setCsvHeaders(['phone', 'name']);
      setCsvRows(csvData);
      setTotalRows(csvData.length);
      setMappings({ phone: 'phone', name: 'name' });
      setStep('mapping');
    } catch (error) {
      notify.error('Erro ao Processar', error instanceof Error ? error.message : 'Não foi possível processar os números.');
    }
  }

  const startProcessing = async (): Promise<void> => {
    if (!mappings.phone || !mappings.name) {
        notify.error('Mapeamento Incompleto', 'Os campos "Nome" e "Telefone" são obrigatórios.');
        return;
    }

    setStep('processing');
    
    let currentOffset = 0;
    const totalSummary: ImportSummary = { created: 0, updated: 0, ignored: 0, errors: 0 };
    const chunkSize = 500; // Define chunk size for processing

    while (currentOffset < totalRows) {
        const chunk = csvRows.slice(currentOffset, currentOffset + chunkSize);
        if (chunk.length === 0) break;
        
        const payload = { 
            chunk, 
            mappings, 
            lists: selectedListIds, 
            tags: selectedTagIds, 
            updateExisting 
        };

        try {
            const response = await fetch('/api/v1/contacts/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) throw result;
            
            totalSummary.created += result.summary.created;
            totalSummary.updated += result.summary.updated;
            totalSummary.ignored += result.summary.ignored;
            totalSummary.errors += result.summary.errors;
            
            setProgress(prev => prev + chunk.length);
            currentOffset += chunkSize;
        } catch (error: unknown) {
            const err = error as { details?: string; error?: string };
            notify.error('Erro Crítico na Importação', err.details || err.error || 'A importação foi interrompida.');
            reset();
            setIsOpen(true);
            return;
        }
    }
    setImportSummary(totalSummary);
    setStep('summary');
  }

  const stepConfig = {
    'upload': { step: 1, title: 'Upload do Ficheiro', description: 'Selecione o ficheiro CSV para importar.' },
    'mapping': { step: 2, title: 'Mapear Colunas', description: 'Corresponda as colunas do seu ficheiro com os campos do sistema.' },
    'segmentation': { step: 3, title: 'Segmentação e Opções', description: 'Adicione tags/listas e defina como lidar com contatos existentes.'},
    'processing': { step: 4, title: 'Processando Importação', description: 'Aguarde enquanto processamos o seu ficheiro.' },
    'summary': { step: 5, title: 'Resumo da Importação', description: 'Veja o resultado da sua importação.' }
  }
  
  const currentStepInfo = stepConfig[step];
  
  const renderStepContent = (): JSX.Element | null => {
    switch (step) {
      case 'upload': return <UploadStep onFileAccepted={handleFileAccepted} onPasteAccepted={handlePasteAccepted} />;
      case 'mapping': return <MappingStep csvHeaders={csvHeaders} mappings={mappings} setMappings={setMappings} totalRows={totalRows} />;
      case 'segmentation': return <SegmentationStep onUpdateExistingChange={setUpdateExisting} selectedListIds={selectedListIds} setSelectedListIds={setSelectedListIds} selectedTagIds={selectedTagIds} setSelectedTagIds={setSelectedTagIds} />;
      case 'processing': return <ProcessingStep progress={progress} totalRows={totalRows} />;
      case 'summary': return <SummaryStep summary={importSummary} />;
      default: return null;
    }
  }
  
  const renderFooter = (): JSX.Element | null => {
    switch (step) {
        case 'upload': return <Button type="button" variant="secondary" onClick={(): void => handleOpenChange(false)}>Cancelar</Button>;
        case 'mapping': return (
            <>
                <Button type="button" variant="secondary" onClick={(): void => setStep('upload')}>Voltar</Button>
                <Button type="button" onClick={(): void => setStep('segmentation')}>Continuar</Button>
            </>
        );
        case 'segmentation': return (
            <>
                <Button type="button" variant="secondary" onClick={(): void => setStep('mapping')}>Voltar</Button>
                <Button type="button" onClick={startProcessing}>Confirmar e Importar</Button>
            </>
        );
        case 'summary': return <Button type="button" className="w-full" onClick={(): void => handleOpenChange(false)}>Fechar</Button>;
        default: return null;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{currentStepInfo.title}</DialogTitle>
          <DialogDescription>{currentStepInfo.description}</DialogDescription>
        </DialogHeader>
        {step !== 'processing' && step !== 'summary' && (
            <div className="flex items-center justify-center gap-4 py-2">
                {[1, 2, 3].map((stepNum) => (
                    <React.Fragment key={stepNum}>
                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs", currentStepInfo.step === stepNum ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            {stepNum}
                        </div>
                        {stepNum < 3 && <div className="h-px w-16 bg-border" />}
                    </React.Fragment>
                ))}
            </div>
        )}
        <div className="py-4 min-h-[300px]">{renderStepContent()}</div>
        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
