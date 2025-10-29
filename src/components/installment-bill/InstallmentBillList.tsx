import { Edit, Trash2, CreditCard, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import type { InstallmentBill } from '@/types/installment-bill';

interface Props {
  installmentBills: InstallmentBill[];
  onEdit: (bill: InstallmentBill) => void;
  onDelete: (code: string) => void;
  isDeleting?: boolean;
}

const operationTypeLabels: Record<string, string> = {
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  DONE: 'Concluída',
  CANCELED: 'Cancelada',
};

const statusColors: Record<string, 'default' | 'destructive' | 'secondary'> = {
  PENDING: 'default',
  DONE: 'secondary',
  CANCELED: 'destructive',
};

export function InstallmentBillList({ 
  installmentBills, 
  onEdit, 
  onDelete, 
  isDeleting 
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

  const calculateProgress = (count: number, total: number) => {
    return (count / total) * 100;
  };

  const calculateInstallmentValue = (amount: number, total: number) => {
    return amount / total;
  };

  if (installmentBills.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma conta parcelada encontrada.</p>
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
            <TableHead>Valor Total</TableHead>
            <TableHead>Valor Parcela</TableHead>
            <TableHead>Parcelas</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Próxima Parcela</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installmentBills.map((bill) => {
            const progress = calculateProgress(bill.installment_count || 0, bill.installment_total);
            const installmentValue = calculateInstallmentValue(bill.amount, bill.installment_total);
            
            return (
              <TableRow key={bill.code}>
                <TableCell className="font-medium">{bill.description}</TableCell>
                <TableCell>
                  <Badge variant={bill.operation_type === 'DEBIT' ? 'destructive' : 'default'}>
                    {operationTypeLabels[bill.operation_type]}
                  </Badge>
                </TableCell>
                <TableCell className={bill.operation_type === 'DEBIT' ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(bill.amount)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCurrency(installmentValue)}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span className="font-medium">{bill.installment_count || 0}</span>
                    <span className="text-muted-foreground"> / {bill.installment_total}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-1">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">{progress.toFixed(0)}%</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{bill.installment_count || 0} de {bill.installment_total} parcelas pagas</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-sm">
                  {bill.next_installment_date ? (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(bill.next_installment_date)}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusColors[bill.status]}>
                    {statusLabels[bill.status]}
                  </Badge>
                </TableCell>
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}