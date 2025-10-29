import { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BalanceFilters as Filters } from '@/types/balance';

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onExport?: () => void;
}

export function BalanceFilters({ filters, onFiltersChange, onExport }: Props) {
  const [localFilters, setLocalFilters] = useState<Filters>(filters);

  const handleSearch = () => {
    onFiltersChange(localFilters);
  };

  const handleQuickFilter = (value: string) => {
    const today = new Date();
    let startDate: Date;
    let endDate = today;

    switch (value) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last-month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    const newFilters = {
      initialDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="space-y-4">
          {/* Filtros Rápidos */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Período:</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('today')}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('week')}
              >
                Última Semana
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('month')}
              >
                Este Mês
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('last-month')}
              >
                Mês Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('year')}
              >
                Este Ano
              </Button>
            </div>
          </div>

          {/* Datas Personalizadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initialDate">Data Inicial</Label>
              <Input
                id="initialDate"
                type="date"
                value={localFilters.initialDate}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, initialDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={localFilters.endDate}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, endDate: e.target.value })
                }
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex-1">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
              {onExport && (
                <Button variant="outline" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}