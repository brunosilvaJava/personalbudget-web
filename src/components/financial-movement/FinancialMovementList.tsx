import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/utils/format';
import type { FinancialMovement, FinancialMovementStatus, OperationType } from '@/types/financial-movement';

interface FinancialMovementListProps {
  movements: FinancialMovement[];
  onEdit: (movement: FinancialMovement) => void;
  onDelete: (code: string) => void;
  isDeleting?: boolean;
}

const statusConfig: Record<FinancialMovementStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  PAID_OUT: { label: 'Pago', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  LATE: { label: 'Atrasado', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
};

const operationTypeConfig: Record<OperationType, { label: string; className: string }> = {
  CREDIT: { label: 'Receita', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  DEBIT: { label: 'Despesa', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
};

// Função helper para obter status com fallback
const getStatusConfig = (status: FinancialMovementStatus) => {
  return statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' };
};

// Função helper para obter tipo de operação com fallback
const getOperationTypeConfig = (operationType: OperationType) => {
  return operationTypeConfig[operationType] || { label: operationType, className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' };
};

// Função helper para formatar data com segurança
const formatDateSafe = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  try {
    // Tenta parseISO primeiro (formato ISO 8601)
    const date = parseISO(dateString);
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', dateString, error);
    return dateString; // Retorna a string original se falhar
  }
};

export function FinancialMovementList({ 
  movements, 
  onEdit, 
  onDelete,
  isDeleting 
}: FinancialMovementListProps) {
  
  if (movements.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-lg">Nenhuma movimentação encontrada</p>
        <p className="text-sm mt-2">Ajuste os filtros ou crie uma nova movimentação</p>
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
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Pago</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const statusInfo = getStatusConfig(movement.status);
            const operationInfo = getOperationTypeConfig(movement.operationType);
            
            return (
              <TableRow key={movement.code}>
                <TableCell className="font-medium">
                  {movement.description}
                </TableCell>
                
                <TableCell>
                  <Badge className={operationInfo.className}>
                    {operationInfo.label}
                  </Badge>
                </TableCell>
                
                <TableCell className={`text-right font-medium ${
                  movement.operationType === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(movement.amount)}
                </TableCell>
                
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(movement.amountPaid)}
                </TableCell>
                
                <TableCell>
                  {formatDateSafe(movement.dueDate)}
                </TableCell>
                
                <TableCell>
                  <Badge className={statusInfo.className}>
                    {statusInfo.label}
                  </Badge>
                </TableCell>
                
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Abrir menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(movement)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(movement.code)}
                        disabled={isDeleting}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
