'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useToast } from '@/hooks/use-toast';
import { TemplateCard } from '@/components/templates/template-card';
import { TemplateDialog } from '@/components/templates/template-dialog';
import {
  PlusCircle,
  Search,
  Loader2,
  FileText,
  Trash2,
  Folder,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TemplateCategory {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  templateCount?: number;
}

interface Template {
  id: string;
  name: string;
  content: string;
  categoryId?: string | null;
  category?: TemplateCategory | null;
  variables: string[];
  usageCount: number;
  active: boolean;
  isPredefined: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<TemplateCategory | null>(null);

  const { data: templatesData, error: templatesError, isLoading: templatesLoading, mutate: mutateTemplates } = useSWR<{
    data: Template[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>(
    `/api/v1/templates?search=${encodeURIComponent(search)}&categoryId=${categoryFilter !== 'all' ? categoryFilter : ''}&page=${currentPage}&limit=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const { data: categoriesData, error: _categoriesError, isLoading: categoriesLoading, mutate: mutateCategories } = useSWR<{
    data: TemplateCategory[];
  }>(
    '/api/v1/templates/categories',
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const categories = categoriesData?.data || [];
  const templates = templatesData?.data || [];
  const totalItems = templatesData?.pagination?.total || 0;
  const totalPages = templatesData?.pagination?.totalPages || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleOpenDialog = (template: Template | null) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplate) return;

    try {
      const response = await fetch(`/api/v1/templates/${deleteTemplate.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar template');
      }

      toast({
        title: 'Template Deletado!',
        description: `O template "${deleteTemplate.name}" foi removido com sucesso.`,
      });

      mutateTemplates();
      setDeleteTemplate(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Deletar',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory) return;

    try {
      const response = await fetch(`/api/v1/templates/categories?id=${deleteCategory.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar categoria');
      }

      toast({
        title: 'Categoria Deletada!',
        description: `A categoria "${deleteCategory.name}" foi removida com sucesso.`,
      });

      mutateCategories();
      setDeleteCategory(null);
      if (categoryFilter === deleteCategory.id) {
        setCategoryFilter('all');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Deletar Categoria',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
      });
    }
  };

  const handleUseTemplate = async (template: Template) => {
    try {
      await fetch(`/api/v1/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incrementUsage: true }),
      });

      await navigator.clipboard.writeText(template.content);

      localStorage.setItem('selectedTemplate', JSON.stringify({
        id: template.id,
        name: template.name,
        content: template.content,
        variables: template.variables,
      }));

      toast({
        title: 'Template Copiado!',
        description: 'O conteúdo do template foi copiado para a área de transferência.',
      });

      mutateTemplates();

      router.push('/campaigns-baileys');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível copiar o template.',
      });
    }
  };

  const isLoading = templatesLoading || categoriesLoading;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Templates de Mensagens</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                className="pl-9 w-full"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  <SelectItem value="uncategorized">Sem Categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon && <span className="mr-1">{cat.icon}</span>}
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryFilter !== 'all' && categoryFilter !== '' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Folder className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        const category = categories.find(c => c.id === categoryFilter);
                        if (category) setDeleteCategory(category);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Deletar Categoria
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => handleOpenDialog(null)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : templatesError ? (
            <div className="flex items-center justify-center py-12 text-destructive">
              Erro ao carregar templates
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={search ? 'Nenhum template encontrado' : 'Nenhum template criado'}
              description={
                search
                  ? 'Não encontramos templates com o termo de busca informado.'
                  : 'Crie templates personalizados para agilizar suas mensagens.'
              }
              actionLabel={!search ? 'Criar Template' : undefined}
              onAction={!search ? () => handleOpenDialog(null) : undefined}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={handleOpenDialog}
                    onDelete={setDeleteTemplate}
                    onUse={handleUseTemplate}
                  />
                ))}
              </div>

              {totalItems > pageSize && (
                <div className="mt-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * pageSize) + 1} a{' '}
                      {Math.min(currentPage * pageSize, totalItems)} de {totalItems} templates
                    </div>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(parseInt(value, 10));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[12, 24, 48].map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            {size} por página
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <PaginationControls
                    totalItems={totalItems}
                    pageSize={pageSize}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        template={editingTemplate}
        categories={categories}
        onSuccess={() => {
          mutateTemplates();
          setEditingTemplate(null);
        }}
        onCategoryCreated={mutateCategories}
      />

      <AlertDialog
        open={!!deleteTemplate}
        onOpenChange={(open) => !open && setDeleteTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template &quot;{deleteTemplate?.name}&quot; será
              excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteCategory}
        onOpenChange={(open) => !open && setDeleteCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A categoria &quot;{deleteCategory?.name}&quot; será
              excluída permanentemente.
              {deleteCategory && deleteCategory.templateCount && deleteCategory.templateCount > 0 && (
                <span className="block mt-2 text-destructive font-semibold">
                  Atenção: Esta categoria possui {deleteCategory.templateCount} template(s) associado(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
