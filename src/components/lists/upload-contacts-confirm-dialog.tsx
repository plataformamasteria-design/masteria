// src/components/lists/upload-contacts-confirm-dialog.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { ImportContactsDialog } from '@/components/contacts/import-contacts-dialog';

interface UploadContactsConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listName: string;
  listId: string;
  onUploadCompleted?: () => void;
}

export function UploadContactsConfirmDialog({
  isOpen,
  onClose,
  listName,
  listId: _listId,
  onUploadCompleted,
}: UploadContactsConfirmDialogProps): JSX.Element {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setShowConfirm(true);
      setShowImportDialog(false);
    }
  }, [isOpen]);

  const handleNo = (): void => {
    setShowConfirm(false);
    setShowImportDialog(false);
    onClose();
  };

  const handleYes = (): void => {
    setShowConfirm(false);
    setShowImportDialog(true);
  };

  const handleUploadCompleted = (): void => {
    setShowImportDialog(false);
    setShowConfirm(true);
    if (onUploadCompleted) {
      onUploadCompleted();
    }
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && showConfirm} onOpenChange={handleNo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative bg-gradient-to-br from-primary to-primary/70 p-4 rounded-full">
                  <Upload className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Lista Criada com Sucesso!</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              A lista <span className="font-semibold text-foreground">&quot;{listName}&quot;</span> foi criada.
              <br />
              Você já deseja subir seus contatos para a lista?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleNo}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              <X className="mr-2 h-4 w-4" />
              Agora Não
            </Button>
            <Button
              type="button"
              onClick={handleYes}
              className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Upload className="mr-2 h-4 w-4" />
              Sim, Subir Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ImportContactsDialog 
        open={showImportDialog} 
        onOpenChange={(open) => {
          if (!open) {
            handleUploadCompleted();
          }
        }}
        onImportCompleted={handleUploadCompleted}
      />
    </>
  );
}
