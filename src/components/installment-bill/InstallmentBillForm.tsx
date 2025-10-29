import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CreditCard, Calendar as CalendarIcon } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { InstallmentBill, InstallmentBillRequest, OperationType } from '@/types/installment-bill';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InstallmentBillRequest) => Promise<void>;
  editingBill: InstallmentBill | null;
  isSubmitting?: boolean;
}

export function InstallmentBillForm({ open, onOpenChange, onSubmit, editingBill, isSubmitting }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InstallmentBillRequest>();

  const operationType = watch('operation_type');
  const amount = watch('amount');
  const installmentTotal = watch('installment_total');

  // Calcular valor da parcela
  const installmentValue = amount && installmentTotal 
    ? (amount / installmentTotal).toFixed(2) 
    : '0.00';

  // Resetar formulário quando abrir
  useEffect(() => {
    if (!open && !editingBill) {
      const timer = setTimeout(() => {
        reset();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, editingBill, reset]);

  useEffect(() => {
    if (editingBill) {
      setValue('operation_type', editingBill.operation_type);
      setValue('description', editingBill.description);
      setValue('amount', editingBill.amount);
      setValue('purchase_date', editingBill.purchase_date);
      setValue('installment_total', editingBill.installment_total);
    } else if (open) {
      reset();
    }
  }, [editingBill, open, reset, setValue]);

  const handleFormSubmit = async (data: InstallmentBillRequest) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      console.error('Erro ao salvar conta parcelada:', error);
    }
  };

  // Verificar se pode editar
  const canEditCriticalFields = !editingBill || (editingBill.installment_count || 0) === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingBill ? 'Editar Conta Parcelada' : 'Nova Conta Parcelada'}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para {editingBill ? 'atualizar' : 'criar'} uma conta parcelada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Alerta de restrição de edição */}
          {editingBill && !canEditCriticalFields && (
            <Alert>
              <AlertDescription className="text-sm">
                ⚠️ Campos críticos (tipo, valor, parcelas) não podem ser editados após o primeiro lançamento.
              </AlertDescription>
            </Alert>
          )}

          {/* Tipo de Operação */}
          <div className="space-y-2">
            <Label htmlFor="operation_type">Tipo de Operação *</Label>
            <Select
              value={operationType}
              onValueChange={(value) => setValue('operation_type', value as OperationType)}
              disabled={!canEditCriticalFields}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBIT">Débito (Despesa)</SelectItem>
                <SelectItem value="CREDIT">Crédito (Receita)</SelectItem>
              </SelectContent>
            </Select>
            {errors.operation_type && (
              <p className="text-sm text-red-600">{errors.operation_type.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              {...register('description', {
                required: 'Descrição é obrigatória',
                minLength: { value: 4, message: 'Mínimo de 4 caracteres' },
                maxLength: { value: 50, message: 'Máximo de 50 caracteres' },
              })}
              placeholder="Ex: Notebook, Geladeira, etc."
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Valor Total */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor Total (R$) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount', {
                required: 'Valor é obrigatório',
                min: { value: 0.01, message: 'Valor deve ser maior que zero' },
                valueAsNumber: true,
              })}
              placeholder="0,00"
              disabled={!canEditCriticalFields}
            />
            {errors.amount && (
              <p className="text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Data da Compra */}
          <div className="space-y-2">
            <Label htmlFor="purchase_date">Data da Compra *</Label>
            <Input
              id="purchase_date"
              type="date"
              {...register('purchase_date', {
                required: 'Data da compra é obrigatória',
              })}
            />
            {errors.purchase_date && (
              <p className="text-sm text-red-600">{errors.purchase_date.message}</p>
            )}
          </div>

          {/* Número de Parcelas */}
          <div className="space-y-2">
            <Label htmlFor="installment_total">Número de Parcelas *</Label>
            <Input
              id="installment_total"
              type="number"
              min="1"
              max="99"
              {...register('installment_total', {
                required: 'Número de parcelas é obrigatório',
                min: { value: 1, message: 'Mínimo de 1 parcela' },
                max: { value: 99, message: 'Máximo de 99 parcelas' },
                valueAsNumber: true,
              })}
              placeholder="12"
              disabled={!canEditCriticalFields}
            />
            {errors.installment_total && (
              <p className="text-sm text-red-600">{errors.installment_total.message}</p>
            )}
          </div>

          {/* Informação do Valor da Parcela */}
          {amount && installmentTotal && installmentTotal > 0 && (
            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Valor da Parcela:</span>
                  <span className="text-lg font-bold">
                    {installmentTotal}x de R$ {installmentValue}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Parcelas serão lançadas automaticamente a cada 30 dias
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Informações sobre edição */}
          {editingBill && (
            <Alert>
              <AlertDescription className="text-xs">
                <div className="space-y-1">
                  <p><strong>Parcelas pagas:</strong> {editingBill.installment_count || 0} de {editingBill.installment_total}</p>
                  {editingBill.last_installment_date && (
                    <p><strong>Última parcela:</strong> {new Date(editingBill.last_installment_date).toLocaleDateString('pt-BR')}</p>
                  )}
                  {editingBill.next_installment_date && (
                    <p><strong>Próxima parcela:</strong> {new Date(editingBill.next_installment_date).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

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
              <CalendarIcon className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Salvando...' : editingBill ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}