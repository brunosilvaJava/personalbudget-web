import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import type { InstallmentBillFilters as Filters, OperationType, InstallmentBillStatus } from '@/types/installment-bill';

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const operationTypeLabels: Record<OperationType, string> = {
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
};

const statusLabels: Record<InstallmentBillStatus, string> = {
  PENDING: 'Pendente',
  DONE: 'Concluída',
  CANCELED: 'Cancelada',
};

export function InstallmentBillFilters({ filters, onFiltersChange }: Props) {
  const [localFilters, setLocalFilters] = useState<Filters>(filters);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    onFiltersChange(localFilters);
  };

  const handleClear = () => {
    const clearedFilters: Filters = {
      page: 0,
      size: filters.size || 10,
      sortBy: 'purchase_date',
      sortDirection: 'DESC',
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const removeOperationType = (type: OperationType) => {
    const updated = localFilters.operation_type?.filter(t => t !== type) || [];
    const newFilters = {
      ...localFilters,
      operation_type: updated.length > 0 ? updated : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const removeStatus = (status: InstallmentBillStatus) => {
    const updated = localFilters.status?.filter(s => s !== status) || [];
    const newFilters = {
      ...localFilters,
      status: updated.length > 0 ? updated : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const activeFiltersCount = [
    localFilters.description,
    localFilters.operation_type?.length,
    localFilters.status?.length,
  ].filter(Boolean).length;

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="space-y-4">
          {/* Barra de Busca Principal */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por descrição..."
                value={localFilters.description || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, description: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 px-1.5 py-0.5 text-xs"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filtros Ativos (Tags) */}
          {(localFilters.operation_type?.length || localFilters.status?.length) && (
            <div className="flex flex-wrap gap-2">
              {localFilters.operation_type?.map(type => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {operationTypeLabels[type]}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-red-600"
                    onClick={() => removeOperationType(type)}
                  />
                </Badge>
              ))}
              {localFilters.status?.map(status => (
                <Badge key={status} variant="secondary" className="gap-1">
                  {statusLabels[status]}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-red-600"
                    onClick={() => removeStatus(status)}
                  />
                </Badge>
              ))}
            </div>
          )}

          {/* Filtros Avançados */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              {/* Tipo de Operação */}
              <div className="space-y-2">
                <Label>Tipo de Operação</Label>
                <Select
                  value={localFilters.operation_type?.[0] || 'all'}
                  onValueChange={(value) => {
                    setLocalFilters({
                      ...localFilters,
                      operation_type: value === 'all' ? undefined : [value as OperationType],
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="DEBIT">Débito</SelectItem>
                    <SelectItem value="CREDIT">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={localFilters.status?.[0] || 'all'}
                  onValueChange={(value) => {
                    setLocalFilters({
                      ...localFilters,
                      status: value === 'all' ? undefined : [value as InstallmentBillStatus],
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="DONE">Concluída</SelectItem>
                    <SelectItem value="CANCELED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ordenação */}
              <div className="space-y-2">
                <Label>Ordenar por</Label>
                <Select
                  value={`${localFilters.sortBy}_${localFilters.sortDirection}`}
                  onValueChange={(value) => {
                    const [sortBy, sortDirection] = value.split('_');
                    setLocalFilters({
                      ...localFilters,
                      sortBy,
                      sortDirection: sortDirection as 'ASC' | 'DESC',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase_date_DESC">Data de compra (mais recente)</SelectItem>
                    <SelectItem value="purchase_date_ASC">Data de compra (mais antigo)</SelectItem>
                    <SelectItem value="description_ASC">Descrição (A-Z)</SelectItem>
                    <SelectItem value="description_DESC">Descrição (Z-A)</SelectItem>
                    <SelectItem value="amount_DESC">Valor (maior)</SelectItem>
                    <SelectItem value="amount_ASC">Valor (menor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botão Limpar */}
              <div className="md:col-span-3 flex justify-end gap-2">
                <Button variant="outline" onClick={handleClear}>
                  Limpar Filtros
                </Button>
                <Button onClick={handleSearch}>
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
