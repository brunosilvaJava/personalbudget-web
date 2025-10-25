// <permalink: ajuste conforme o path real no repo>
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
import { formatDateToISO } from '@/utils/format';
import type { FinancialMovementFilters } from '@/types/financial-movement';

interface FinancialMovementFiltersProps {
  filters: FinancialMovementFilters;
  onFiltersChange: (filters: FinancialMovementFilters) => void;
}

export function FinancialMovementFilters({ 
  filters, 
  onFiltersChange 
}: FinancialMovementFiltersProps) {
  const [description, setDescription] = useState(filters.description || '');
  const [operationType, setOperationType] = useState<string>(
    filters.operationTypes?.[0] || 'all'
  );
  const [status, setStatus] = useState<string>(
    filters.statuses?.[0] || 'all'
  );
  
  const handleApplyFilters = () => {
    onFiltersChange({
      ...filters,
      description: description.trim(),
      operationTypes: operationType && operationType !== 'all' 
        ? [operationType as any] 
        : undefined,
      statuses: status && status !== 'all' 
        ? [status as any] 
        : undefined,
    });
  };

  const handleClearFilters = () => {
    setDescription('');
    setOperationType('all');
    setStatus('all');
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    onFiltersChange({
      description: '',
      operationTypes: undefined,
      statuses: undefined,
      startDate: formatDateToISO(firstDay),
      endDate: formatDateToISO(lastDay),
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  const handleOperationTypeChange = (value: string) => {
    setOperationType(value);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Filtros</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleClearFilters}
        >
          <X className="h-4 w-4 mr-2" />
          Limpar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Descrição */}
        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="description"
              placeholder="Buscar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="pl-8"
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            />
          </div>
        </div>

        {/* Tipo */}
        <div className="space-y-2">
          <Label htmlFor="operation-type">Tipo</Label>
          <Select 
            value={operationType} 
            onValueChange={handleOperationTypeChange}
          >
            <SelectTrigger id="operation-type">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="CREDIT">Receita</SelectItem>
              <SelectItem value="DEBIT">Despesa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select 
            value={status} 
            onValueChange={handleStatusChange}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="PAID_OUT">Pago</SelectItem>
              <SelectItem value="LATE">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data Início */}
        <div className="space-y-2">
          <Label htmlFor="start-date">Data Início</Label>
          <Input
            id="start-date"
            type="date"
            value={filters.startDate}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
          />
        </div>

        {/* Data Fim */}
        <div className="space-y-2">
          <Label htmlFor="end-date">Data Fim</Label>
          <Input
            id="end-date"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleApplyFilters}>
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
      </div>
    </div>
  );
}

// Adiciona export default para compatibilidade com imports default
export default FinancialMovementFilters;