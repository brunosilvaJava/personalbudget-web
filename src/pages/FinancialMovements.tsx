import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { PageSizeSelector } from '@/components/financial-movement/PageSizeSelector';
import { FinancialMovementList } from '@/components/financial-movement/FinancialMovementList';
import { FinancialMovementFilters } from '@/components/financial-movement/FinancialMovementFilters';
import { FinancialMovementForm } from '@/components/financial-movement/FinancialMovementForm';
import {
  useFinancialMovements,
  useCreateFinancialMovement,
  useUpdateFinancialMovement,
  useDeleteFinancialMovement,
} from '@/hooks/useFinancialMovements';
import { formatDateToISO } from '@/utils/format';
import { getErrorMessage } from '@/api/client';
import type { 
  FinancialMovement, 
  FinancialMovementFilters as Filters, 
  FinancialMovementRequest 
} from '@/types/financial-movement';

export function FinancialMovements() {
  // Estado dos filtros (inicializa com o mês atual)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [filters, setFilters] = useState<Filters>({
    startDate: formatDateToISO(firstDay),
    endDate: formatDateToISO(lastDay),
    page: 0,
    size: 10,
    sortBy: 'movementDate',
    sortDirection: 'DESC',
  });

  // Estado do modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinancialMovement | null>(null);

  // Estado de erro
  const [error, setError] = useState<string | null>(null);

  // Queries e Mutations
  const { data: pagedData, isLoading, error: queryError } = useFinancialMovements(filters);
  const createMutation = useCreateFinancialMovement();
  const updateMutation = useUpdateFinancialMovement();
  const deleteMutation = useDeleteFinancialMovement();

  const movements = pagedData?.content || [];
  const totalElements = pagedData?.totalElements || 0;
  const totalPages = pagedData?.totalPages || 0;
  const currentPage = pagedData?.page || 0;

  // Handlers
  const handleOpenForm = () => {
    setEditingMovement(null);
    setIsFormOpen(true);
    setError(null);
  };

  const handleEdit = (movement: FinancialMovement) => {
    setEditingMovement(movement);
    setIsFormOpen(true);
    setError(null);
  };

  const handleSubmit = async (data: FinancialMovementRequest) => {
    try {
      setError(null);

      if (editingMovement) {
        await updateMutation.mutateAsync({
          code: editingMovement.code,
          data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }

      setIsFormOpen(false);
      setEditingMovement(null);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao salvar movimentação:', err);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) {
      return;
    }

    try {
      setError(null);
      await deleteMutation.mutateAsync(code);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao excluir movimentação:', err);
    }
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  const handlePageSizeChange = (size: number) => {
    setFilters({ ...filters, size, page: 0 });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentações Financeiras</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas receitas e despesas
          </p>
        </div>
        <Button onClick={handleOpenForm} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nova Movimentação
        </Button>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Erro de Query */}
      {queryError && (
        <Alert variant="destructive">
          <AlertDescription>
            {getErrorMessage(queryError)}
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <FinancialMovementFilters 
        filters={filters} 
        onFiltersChange={(newFilters) => setFilters({ ...newFilters, page: 0 })} 
      />

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-10">
          <p className="text-muted-foreground">Carregando movimentações...</p>
        </div>
      )}

      {/* Lista de Movimentações */}
      {!isLoading && (
        <>
          {/* Info e Page Size Selector */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Mostrando {movements.length > 0 ? currentPage * filters.size! + 1 : 0} - {Math.min((currentPage + 1) * filters.size!, totalElements)} de {totalElements} {totalElements === 1 ? 'movimentação' : 'movimentações'}
            </p>
            <PageSizeSelector
              pageSize={filters.size!}
              onPageSizeChange={handlePageSizeChange}
              disabled={isLoading}
            />
          </div>

          <FinancialMovementList
            movements={movements}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={deleteMutation.isPending}
          />

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                disabled={isLoading}
              />
            </div>
          )}
        </>
      )}

      {/* Modal de Formulário */}
      <FinancialMovementForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        editingMovement={editingMovement}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
