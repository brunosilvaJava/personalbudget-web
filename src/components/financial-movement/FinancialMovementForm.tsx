import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FinancialMovement, FinancialMovementRequest } from '@/types/financial-movement';

interface FinancialMovementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FinancialMovementRequest) => void;
  editingMovement?: FinancialMovement | null;
  isSubmitting?: boolean;
}

export function FinancialMovementForm({
  open,
  onOpenChange,
  onSubmit,
  editingMovement,
  isSubmitting,
}: FinancialMovementFormProps) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FinancialMovementRequest>({
    defaultValues: {
      status: 'PENDING',
      operationType: 'DEBIT',
    }
  });

  useEffect(() => {
    if (editingMovement) {
      reset({
        operationType: editingMovement.operationType,
        status: editingMovement.status,
        description: editingMovement.description,
        amount: editingMovement.amount,
        amountPaid: editingMovement.amountPaid,
        movementDate: editingMovement.movementDate.split('T')[0],
        dueDate: editingMovement.dueDate.split('T')[0],
        payDate: editingMovement.payDate?.split('T')[0],
      });
    } else {
      reset({
        status: 'PENDING',
        operationType: 'DEBIT',
        description: '',
        amount: undefined,
        amountPaid: undefined,
        movementDate: '',
        dueDate: '',
        payDate: undefined,
      });
    }
  }, [editingMovement, reset, open]);

  const handleFormSubmit = (data: any) => {
    const payload: FinancialMovementRequest = {
      operationType: data.operationType,
      description: data.description,
      amount: data.amount,
      amountPaid: data.amountPaid,
      movementDate: `${data.movementDate}T00:00:00`,
      dueDate: `${data.dueDate}T23:59:59`,
      payDate: data.payDate ? `${data.payDate}T00:00:00` : undefined,
      status: data.status,
    };
    
    console.log('Payload sendo enviado:', payload);
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editingMovement ? 'Editar' : 'Nova'} Movimentação
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da movimentação financeira
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Tipo de Operação */}
            <div className="space-y-2">
              <Label htmlFor="operationType">Tipo *</Label>
              <Controller
                name="operationType"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT">Receita</SelectItem>
                      <SelectItem value="DEBIT">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Controller
                name="status"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pendente</SelectItem>
                      <SelectItem value="PAID_OUT">Pago</SelectItem>
                      <SelectItem value="LATE">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              placeholder="Ex: Salário, Aluguel, Supermercado..."
              {...register('description', { required: true })}
            />
            {errors.description && (
              <p className="text-sm text-red-500">Descrição é obrigatória</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('amount', { required: true, min: 0.01 })}
              />
              {errors.amount && (
                <p className="text-sm text-red-500">Valor deve ser maior que zero</p>
              )}
            </div>

            {/* Valor Pago */}
            <div className="space-y-2">
              <Label htmlFor="amountPaid">Valor Pago</Label>
              <Input
                id="amountPaid"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('amountPaid', { min: 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Data da Movimentação */}
            <div className="space-y-2">
              <Label htmlFor="movementDate">Data da Movimentação *</Label>
              <Input
                id="movementDate"
                type="date"
                {...register('movementDate', { required: true })}
              />
            </div>

            {/* Data de Vencimento */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vencimento *</Label>
              <Input
                id="dueDate"
                type="date"
                {...register('dueDate', { required: true })}
              />
            </div>

            {/* Data de Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="payDate">Data de Pagamento</Label>
              <Input
                id="payDate"
                type="date"
                {...register('payDate')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}