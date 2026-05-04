'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Users, Trash2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/admin/users');
      if (!response.ok) throw new Error('Falha ao carregar usuários');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Tem certeza que deseja deletar ${email}?`)) return;

    try {
      setDeleting(userId);
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Erro ao deletar: ${error.error || 'Falha desconhecida'}`);
        return;
      }

      // Remover do estado local
      setUsers(users.filter(u => u.id !== userId));
      alert('Usuário deletado com sucesso');
    } catch (error) {
      console.error(error);
      alert('Erro ao deletar usuário');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gerenciamento de Usuários" description="Visualize e gerencie todos os usuários do sistema" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Total de Usuários: {users.length}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
                ) : (
                  users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">{user.role}</span></TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-800"
                          onClick={() => handleDelete(user.id, user.email)}
                          disabled={deleting === user.id}
                        >
                          {deleting === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
    </div>
  );
}
