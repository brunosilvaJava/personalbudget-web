import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { PageSizeSelector } from '@/components/financial-movement/PageSizeSelector';
import { FixedBillList } from '@/components/fixed-bill/FixedBillList';
import { FixedBillFilters } from '@/components/fixed-bill/FixedBillFilters';
import { FixedBillForm } from '@/components/fixed-bill/FixedBillForm';
import {
  useFixedBills,
  useCreateFixedBill,
  useUpdateFixedBill,
  useDeleteFixedBill,
  useActivateFixedBill,
  useInactivateFixedBill,
} from '@/hooks/useFixedBills';
import { getErrorMessage } from '@/api/client';
import type { FixedBill, FixedBillFilters as Filters, FixedBillRequest } from '@/types/fixed-bill';

export function FixedBills() {
  const [filters, setFilters] = useState<Filters>({
    page: 0,
    size: 10,
    sortBy: 'description',
    sortDirection: 'ASC',
  });
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<FixedBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Queries e Mutations
  const { data: pagedData, isLoading, error: queryError } = useFixedBills(filters);
  const createMutation = useCreateFixedBill();
  const updateMutation = useUpdateFixedBill();
  const deleteMutation = useDeleteFixedBill();
  const activateMutation = useActivateFixedBill();
  const inactivateMutation = useInactivateFixedBill();

  const fixedBills = pagedData?.content || [];
  const totalElements = pagedData?.totalElements || 0;
  const totalPages = pagedData?.totalPages || 0;
  const currentPage = pagedData?.page || 0;

  // Handlers
  const handleOpenForm = () => {
    setEditingBill(null);
    setIsFormOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (bill: FixedBill) => {
    setEditingBill(bill);
    setIsFormOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (data: FixedBillRequest) => {
    try {
      setError(null);
      setSuccess(null);

      if (editingBill) {
        await updateMutation.mutateAsync({
          code: editingBill.code,
          data,
        });
        setSuccess('Conta fixa atualizada com sucesso!');
      } else {
        await createMutation.mutateAsync(data);
        setSuccess('Conta fixa criada com sucesso!');
      }

      setIsFormOpen(false);
      setEditingBill(null);
      
      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao salvar conta fixa:', err);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta fixa?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      await deleteMutation.mutateAsync(code);
      setSuccess('Conta fixa excluída com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao excluir conta fixa:', err);
    }
  };

  const handleActivate = async (code: string) => {
    try {
      setError(null);
      setSuccess(null);
      await activateMutation.mutateAsync(code);
      setSuccess('Conta fixa ativada com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao ativar conta fixa:', err);
    }
  };

  const handleInactivate = async (code: string) => {
    if (!confirm('Tem certeza que deseja inativar esta conta fixa?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      await inactivateMutation.mutateAsync(code);
      setSuccess('Conta fixa inativada com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao inativar conta fixa:', err);
    }
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  const handlePageSizeChange = (size: number) => {
    setFilters({ ...filters, size, page: 0 });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isChangingStatus = activateMutation.isPending || inactivateMutation.isPending;

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas Fixas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas contas recorrentes
          </p>
        </div>
        <Button onClick={handleOpenForm} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nova Conta Fixa
        </Button>
      </div>

      {/* Mensagem de Sucesso */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

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
      <FixedBillFilters 
        filters={filters} 
        onFiltersChange={(newFilters) => setFilters({ ...newFilters, page: 0 })} 
      />

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-10">
          <p className="text-muted-foreground">Carregando contas fixas...</p>
        </div>
      )}

      {/* Lista de Contas Fixas */}
      {!isLoading && (
        <>
          {/* Info e Page Size Selector */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Mostrando {fixedBills.length > 0 ? currentPage * filters.size! + 1 : 0} - {Math.min((currentPage + 1) * filters.size!, totalElements)} de {totalElements} {totalElements === 1 ? 'conta' : 'contas'}
            </p>
            <PageSizeSelector
              pageSize={filters.size!}
              onPageSizeChange={handlePageSizeChange}
              disabled={isLoading}
            />
          </div>

          <FixedBillList
            fixedBills={fixedBills}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onActivate={handleActivate}
            onInactivate={handleInactivate}
            isDeleting={deleteMutation.isPending}
            isChangingStatus={isChangingStatus}
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
      <FixedBillForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        editingBill={editingBill}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
