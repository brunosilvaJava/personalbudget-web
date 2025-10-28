import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
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
import type { FixedBillFilters as Filters, OperationType, RecurrenceType, FixedBillStatus } from '@/types/fixed-bill';

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function FixedBillFilters({ filters, onFiltersChange }: Props) {
  const [localFilters, setLocalFilters] = useState<Filters>(filters);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    onFiltersChange(localFilters);
  };

  const handleClear = () => {
    const clearedFilters: Filters = {};
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

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
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>

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
                      status: value === 'all' ? undefined : [value as FixedBillStatus],
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                    <SelectItem value="INACTIVE">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Recorrência */}
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select
                  value={localFilters.recurrence_type?.[0] || 'all'}
                  onValueChange={(value) => {
                    setLocalFilters({
                      ...localFilters,
                      recurrence_type: value === 'all' ? undefined : [value as RecurrenceType],
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botão Limpar */}
              <div className="md:col-span-3 flex justify-end">
                <Button variant="outline" onClick={handleClear}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
