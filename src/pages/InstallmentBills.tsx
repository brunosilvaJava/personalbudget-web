import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination, PageSizeSelector } from '@/components/ui/pagination';
import { InstallmentBillList } from '@/components/installment-bill/InstallmentBillList';
import { InstallmentBillFilters } from '@/components/installment-bill/InstallmentBillFilters';
import { InstallmentBillForm } from '@/components/installment-bill/InstallmentBillForm';
import {
  useInstallmentBills,
  useCreateInstallmentBill,
  useUpdateInstallmentBill,
  useDeleteInstallmentBill,
} from '@/hooks/useInstallmentBills';
import { getErrorMessage } from '@/api/client';
import type { InstallmentBill, InstallmentBillFilters as Filters, InstallmentBillRequest } from '@/types/installment-bill';

export function InstallmentBills() {
  const [filters, setFilters] = useState<Filters>({
    page: 0,
    size: 10,
    sortBy: 'purchase_date',
    sortDirection: 'DESC',
  });
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<InstallmentBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Queries e Mutations
  const { data: pagedData, isLoading, error: queryError } = useInstallmentBills(filters);
  const createMutation = useCreateInstallmentBill();
  const updateMutation = useUpdateInstallmentBill();
  const deleteMutation = useDeleteInstallmentBill();

  const installmentBills = pagedData?.content || [];
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

  const handleEdit = (bill: InstallmentBill) => {
    setEditingBill(bill);
    setIsFormOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (data: InstallmentBillRequest) => {
    try {
      setError(null);
      setSuccess(null);

      if (editingBill) {
        await updateMutation.mutateAsync({
          code: editingBill.code,
          data,
        });
        setSuccess('Conta parcelada atualizada com sucesso!');
      } else {
        await createMutation.mutateAsync(data);
        setSuccess('Conta parcelada criada com sucesso!');
      }

      setIsFormOpen(false);
      setEditingBill(null);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao salvar conta parcelada:', err);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta parcelada? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      await deleteMutation.mutateAsync(code);
      setSuccess('Conta parcelada excluída com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Erro ao excluir conta parcelada:', err);
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
          <h1 className="text-3xl font-bold tracking-tight">Contas Parceladas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas compras parceladas e acompanhe o progresso
          </p>
        </div>
        <Button onClick={handleOpenForm} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nova Conta Parcelada
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
      <InstallmentBillFilters 
        filters={filters} 
        onFiltersChange={(newFilters) => setFilters({ ...newFilters, page: 0 })} 
      />

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-10">
          <p className="text-muted-foreground">Carregando contas parceladas...</p>
        </div>
      )}

      {/* Lista de Contas Parceladas */}
      {!isLoading && (
        <>
          {/* Info e Page Size Selector */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Mostrando {installmentBills.length > 0 ? currentPage * filters.size! + 1 : 0} - {Math.min((currentPage + 1) * filters.size!, totalElements)} de {totalElements} {totalElements === 1 ? 'conta' : 'contas'}
            </p>
            <PageSizeSelector
              pageSize={filters.size!}
              onPageSizeChange={handlePageSizeChange}
              disabled={isLoading}
            />
          </div>

          <InstallmentBillList
            installmentBills={installmentBills}
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
      <InstallmentBillForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        editingBill={editingBill}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}