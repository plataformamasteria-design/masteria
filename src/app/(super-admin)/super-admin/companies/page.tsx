'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Building, Eye, Trash2, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlobalCredentialsDrawer } from '@/components/admin/global-credentials-drawer';
import { KeyRound } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  email?: string;
  createdAt?: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/admin/companies');
      if (!response.ok) throw new Error('Falha ao carregar empresas');
      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (companyId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar ${name}?`)) return;

    try {
      setDeleting(companyId);
      const response = await fetch(`/api/v1/admin/companies/${companyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Erro ao deletar: ${error.error || 'Falha desconhecida'}`);
        return;
      }

      setCompanies(companies.filter(c => c.id !== companyId));
      alert('Empresa deletada com sucesso');
    } catch (error) {
      console.error(error);
      alert('Erro ao deletar empresa');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Gerenciamento de Empresas" description="Visualize e gerencie todas as empresas do sistema" />
        <Button 
          onClick={() => setCredentialsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
        >
          <KeyRound className="h-4 w-4" />
          Chaves Globais de IA
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> Total de Empresas: {companies.length}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Ver</TableHead>
                  <TableHead className="text-center">Deletar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : companies.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
                ) : (
                  companies.map(company => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell className="font-mono text-sm">{company.email || '—'}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedCompany(company);
                            setDetailsOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                          onClick={() => handleDelete(company.id, company.name)}
                          disabled={deleting === company.id}
                        >
                          {deleting === company.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Company Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div className="flex-1">
              <DialogTitle>{selectedCompany?.name}</DialogTitle>
              <DialogDescription>Detalhes da empresa</DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setDetailsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          {selectedCompany && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nome da Empresa</p>
                  <p className="text-lg font-semibold">{selectedCompany.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-lg font-mono text-sm">{selectedCompany.email || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ID da Empresa</p>
                  <p className="text-sm font-mono text-muted-foreground break-all">{selectedCompany.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data de Criação</p>
                  <p className="text-sm">
                    {selectedCompany.createdAt 
                      ? new Date(selectedCompany.createdAt).toLocaleDateString('pt-BR')
                      : '—'
                    }
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-3">Páginas da Empresa</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/companies/${selectedCompany.id}/users`, '_blank')}
                  >
                    Usuários
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/companies/${selectedCompany.id}/campaigns`, '_blank')}
                  >
                    Campanhas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/companies/${selectedCompany.id}/settings`, '_blank')}
                  >
                    Configurações
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/companies/${selectedCompany.id}/analytics`, '_blank')}
                  >
                    Análises
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <GlobalCredentialsDrawer 
        open={credentialsOpen} 
        onOpenChange={setCredentialsOpen} 
      />
    </div>
  );
}
