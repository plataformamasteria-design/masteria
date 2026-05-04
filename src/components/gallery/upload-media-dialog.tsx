
// src/components/gallery/upload-media-dialog.tsx
'use client';

import { useState, useRef, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
  } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Progress } from '../ui/progress';

interface UploadMediaDialogProps {
    children: React.ReactNode;
    onUploadComplete?: () => void;
}

export function UploadMediaDialog({ children, onUploadComplete }: UploadMediaDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = (): void => {
        setFile(null);
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (!selectedFile) return;
            
            const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB
            if (selectedFile.size > MAX_FILE_SIZE) {
                notify.error('Ficheiro Muito Grande', 'O tamanho do ficheiro não pode exceder 12MB.');
                return;
            }
            setFile(selectedFile);
        }
    }
    
    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!file) {
            notify.error('Nenhum ficheiro selecionado.');
            return;
        }
        setIsUploading(true);
        setUploadProgress(0);
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/v1/media/upload-url', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha no upload.');
            }
            
            setUploadProgress(100);
            notify.success('Upload Concluído!', 'A sua mídia foi adicionada à galeria.');
            
            if (onUploadComplete) {
                onUploadComplete();
            }

            setIsOpen(false);
            
        } catch (error) {
            notify.error('Erro de Upload', (error as Error).message);
        } finally {
            clearInterval(progressInterval);
            setIsUploading(false);
        }
    }
    
    const handleOpenChange = (open: boolean): void => {
        setIsOpen(open);
        if (!open) {
            resetState();
        }
    }


    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Fazer Upload de Mídia</DialogTitle>
                    <DialogDescription>Selecione um ficheiro de imagem, vídeo ou documento para adicionar à sua galeria.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="py-4 space-y-4">
                        <div className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg">
                            <UploadCloud className="h-10 w-10 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                {file ? file.name : 'Selecione um ficheiro'}
                            </p>
                            <Input 
                                id="file-upload" 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                                accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                            />
                             <Button type="button" variant="link" onClick={() => fileInputRef.current?.click()}>
                                Selecione um ficheiro do seu computador
                            </Button>
                        </div>
                        {isUploading && (
                             <Progress value={uploadProgress} className="w-full" />
                        )}
                    </div>
                     <DialogFooter>
                        <Button type="button" variant="secondary" disabled={isUploading} onClick={() => setIsOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={!file || isUploading}>
                            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isUploading ? 'A Enviar...' : 'Enviar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
