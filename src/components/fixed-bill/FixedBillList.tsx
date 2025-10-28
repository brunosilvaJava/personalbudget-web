import { Edit, Trash2, Calendar, Repeat, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FixedBill } from '@/types/fixed-bill';

interface Props {
  fixedBills: FixedBill[];
  onEdit: (fixedBill: FixedBill) => void;
  onDelete: (code: string) => void;
  onActivate: (code: string) => void;
  onInactivate: (code: string) => void;
  isDeleting?: boolean;
  isChangingStatus?: boolean;
}

const recurrenceTypeLabels: Record<string, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
};

const operationTypeLabels: Record<string, string> = {
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

export function FixedBillList({ 
  fixedBills, 
  onEdit, 
  onDelete, 
  onActivate, 
  onInactivate,
  isDeleting,
  isChangingStatus 
}: Props) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const dayOfYearToDate = (dayOfYear: number, year: number): Date => {
    const date = new Date(year, 0);
    date.setDate(dayOfYear);
    return date;
  };

  const formatDays = (days: number[], recurrenceType: string, referenceYear?: number) => {
    if (!days || days.length === 0) return '-';
    
    const sortedDays = [...days].sort((a, b) => a - b);
    
    if (recurrenceType === 'WEEKLY') {
      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return sortedDays.map(d => weekDays[d - 1] || d).join(', ');
    }
    
    if (recurrenceType === 'MONTHLY') {
      return sortedDays.join(', ');
    }

    // YEARLY - converter para datas legíveis usando reference_year
    if (recurrenceType === 'YEARLY') {
      const year = referenceYear || new Date().getFullYear();
      if (sortedDays.length <= 3) {
        return sortedDays
          .map(day => {
            const date = dayOfYearToDate(day, year);
            return format(date, "dd/MM", { locale: ptBR });
          })
          .join(', ');
      } else {
        const first = dayOfYearToDate(sortedDays[0], year);
        const last = dayOfYearToDate(sortedDays[sortedDays.length - 1], year);
        return `${format(first, "dd/MM", { locale: ptBR })} ... ${format(last, "dd/MM", { locale: ptBR })} (${sortedDays.length})`;
      }
    }
    
    return sortedDays.join(', ');
  };

  if (fixedBills.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma conta fixa encontrada.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Recorrência</TableHead>
            <TableHead>Datas/Dias</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data Início</TableHead>
            <TableHead>Data Fim</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fixedBills.map((bill) => (
            <TableRow key={bill.code} className={bill.status === 'INACTIVE' ? 'opacity-60' : ''}>
              <TableCell className="font-medium">{bill.description}</TableCell>
              <TableCell>
                <Badge variant={bill.operation_type === 'DEBIT' ? 'destructive' : 'default'}>
                  {operationTypeLabels[bill.operation_type]}
                </Badge>
              </TableCell>
              <TableCell className={bill.operation_type === 'DEBIT' ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(bill.amount)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  {recurrenceTypeLabels[bill.recurrence_type]}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {formatDays(bill.days, bill.recurrence_type, bill.reference_year)}
              </TableCell>
              <TableCell>
                <Badge variant={bill.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {statusLabels[bill.status]}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(bill.start_date)}</TableCell>
              <TableCell>{formatDate(bill.end_date)}</TableCell>
              <TableCell className="text-right">
                <TooltipProvider>
                  <div className="flex justify-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(bill)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Editar</p>
                      </TooltipContent>
                    </Tooltip>

                    {bill.status === 'ACTIVE' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onInactivate(bill.code)}
                            disabled={isChangingStatus}
                            title="Inativar"
                          >
                            <PowerOff className="h-4 w-4 text-orange-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Inativar</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onActivate(bill.code)}
                            disabled={isChangingStatus}
                            title="Ativar"
                          >
                            <Power className="h-4 w-4 text-green-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ativar</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(bill.code)}
                          disabled={isDeleting}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Excluir</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
