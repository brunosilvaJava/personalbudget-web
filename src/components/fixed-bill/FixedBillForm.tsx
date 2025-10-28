import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar as CalendarIcon, X } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format, getDayOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FixedBill, FixedBillRequest, OperationType, RecurrenceType } from '@/types/fixed-bill';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FixedBillRequest) => Promise<void>;
  editingBill: FixedBill | null;
  isSubmitting?: boolean;
}

interface SelectedDate {
  date: Date;
  dayOfYear: number;
  formatted: string;
}

// Dias da semana: 1=Domingo, 2=Segunda, ..., 7=Sábado
const WEEK_DAYS = [
  { value: 1, label: 'Domingo' },
  { value: 2, label: 'Segunda-feira' },
  { value: 3, label: 'Terça-feira' },
  { value: 4, label: 'Quarta-feira' },
  { value: 5, label: 'Quinta-feira' },
  { value: 6, label: 'Sexta-feira' },
  { value: 7, label: 'Sábado' },
];

// Dias do mês: 1 a 31
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `Dia ${i + 1}`,
}));

export function FixedBillForm({ open, onOpenChange, onSubmit, editingBill, isSubmitting }: Props) {
  const [selectedDates, setSelectedDates] = useState<SelectedDate[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('WEEKLY');
  const [referenceYear, setReferenceYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FixedBillRequest>();

  const operationType = watch('operation_type');

  useEffect(() => {
    if (editingBill) {
      setValue('operation_type', editingBill.operation_type);
      setValue('description', editingBill.description);
      setValue('amount', editingBill.amount);
      setValue('recurrence_type', editingBill.recurrence_type);
      setValue('start_date', editingBill.start_date);
      setValue('end_date', editingBill.end_date || '');
      setRecurrenceType(editingBill.recurrence_type);
      
      // Restaurar seleções baseado no tipo de recorrência
      if (editingBill.recurrence_type === 'YEARLY') {
        // Usar reference_year do backend ou ano atual como fallback
        const year = editingBill.reference_year || new Date().getFullYear();
        setReferenceYear(year);
        setCalendarMonth(new Date(year, new Date().getMonth()));
        
        const dates: SelectedDate[] = editingBill.days.map(dayOfYear => {
          const date = dayOfYearToDate(dayOfYear, year);
          return {
            date,
            dayOfYear,
            formatted: format(date, "dd 'de' MMMM", { locale: ptBR })
          };
        });
        
        setSelectedDates(dates);
        setSelectedDays([]);
      } else {
        // WEEKLY ou MONTHLY
        setSelectedDays(editingBill.days || []);
        setSelectedDates([]);
      }
    } else {
      reset();
      setSelectedDates([]);
      setSelectedDays([]);
      setRecurrenceType('WEEKLY');
      const currentYear = new Date().getFullYear();
      setReferenceYear(currentYear);
      setCalendarMonth(new Date(currentYear, new Date().getMonth()));
    }
  }, [editingBill, reset, setValue]);

  const dayOfYearToDate = (dayOfYear: number, year: number): Date => {
    const date = new Date(year, 0);
    date.setDate(dayOfYear);
    return date;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    const dayOfYear = getDayOfYear(date);
    const formatted = format(date, "dd 'de' MMMM", { locale: ptBR });

    const exists = selectedDates.some(d => d.dayOfYear === dayOfYear);

    if (exists) {
      setSelectedDates(prev => prev.filter(d => d.dayOfYear !== dayOfYear));
    } else {
      setSelectedDates(prev => [...prev, { date, dayOfYear, formatted }].sort((a, b) => a.dayOfYear - b.dayOfYear));
    }
  };

  const removeDate = (dayOfYear: number) => {
    setSelectedDates(prev => prev.filter(d => d.dayOfYear !== dayOfYear));
  };

  const clearAllDates = () => {
    setSelectedDates([]);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const clearAllDays = () => {
    setSelectedDays([]);
  };

  const handleReferenceYearChange = (year: number) => {
    setReferenceYear(year);
    setCalendarMonth(new Date(year, new Date().getMonth()));
    
    const updatedDates = selectedDates.map(selected => {
      const date = dayOfYearToDate(selected.dayOfYear, year);
      return {
        date,
        dayOfYear: selected.dayOfYear,
        formatted: format(date, "dd 'de' MMMM", { locale: ptBR })
      };
    });
    setSelectedDates(updatedDates);
  };

  const handleMonthChange = (newMonth: Date) => {
    if (newMonth.getFullYear() === referenceYear) {
      setCalendarMonth(newMonth);
    }
  };

  const handleRecurrenceTypeChange = (newType: RecurrenceType) => {
    setRecurrenceType(newType);
    setValue('recurrence_type', newType);
    
    // Limpar seleções ao mudar tipo
    setSelectedDates([]);
    setSelectedDays([]);
    
    // Resetar calendário para mês atual se mudar para YEARLY
    if (newType === 'YEARLY') {
      setCalendarMonth(new Date(referenceYear, new Date().getMonth()));
    }
  };

  const handleFormSubmit = async (data: FixedBillRequest) => {
    let days: number[] = [];

    if (recurrenceType === 'YEARLY') {
      if (selectedDates.length === 0) {
        alert('Selecione pelo menos uma data no calendário');
        return;
      }
      days = selectedDates.map(d => d.dayOfYear);
    } else {
      // WEEKLY ou MONTHLY
      if (selectedDays.length === 0) {
        alert('Selecione pelo menos um dia');
        return;
      }
      days = selectedDays;
    }

    const submitData: FixedBillRequest = {
      operation_type: data.operation_type,
      description: data.description,
      amount: data.amount,
      recurrence_type: recurrenceType,
      start_date: data.start_date,
      days: days,
    };

    // Adicionar reference_year apenas para YEARLY
    if (recurrenceType === 'YEARLY') {
      submitData.reference_year = referenceYear;
    }

    // Adicionar end_date apenas se tiver valor
    if (data.end_date && data.end_date !== '') {
      submitData.end_date = data.end_date;
    }

    await onSubmit(submitData);
  };

  const getModifiers = () => {
    return {
      selected: (date: Date) => selectedDates.some(d => d.dayOfYear === getDayOfYear(date)),
    };
  };

  const getModifiersStyles = () => {
    return {
      selected: {
        backgroundColor: 'hsl(var(--primary))',
        color: 'hsl(var(--primary-foreground))',
      },
    };
  };

  const getDayLabel = (day: number) => {
    if (recurrenceType === 'WEEKLY') {
      return WEEK_DAYS.find(d => d.value === day)?.label || day.toString();
    }
    return `Dia ${day}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingBill ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para {editingBill ? 'atualizar' : 'criar'} uma conta fixa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Tipo de Operação */}
          <div className="space-y-2">
            <Label htmlFor="operation_type">Tipo de Operação *</Label>
            <Select
              value={operationType}
              onValueChange={(value) => setValue('operation_type', value as OperationType)}
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
                minLength: { value: 3, message: 'Mínimo de 3 caracteres' },
                maxLength: { value: 50, message: 'Máximo de 50 caracteres' },
              })}
              placeholder="Ex: Aluguel, Salário, etc."
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) *</Label>
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
            />
            {errors.amount && (
              <p className="text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Tipo de Recorrência */}
          <div className="space-y-2">
            <Label htmlFor="recurrence_type">Tipo de Recorrência *</Label>
            <Select
              value={recurrenceType}
              onValueChange={handleRecurrenceTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a recorrência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Semanal</SelectItem>
                <SelectItem value="MONTHLY">Mensal</SelectItem>
                <SelectItem value="YEARLY">Anual</SelectItem>
              </SelectContent>
            </Select>
            {errors.recurrence_type && (
              <p className="text-sm text-red-600">{errors.recurrence_type.message}</p>
            )}
          </div>

          {/* Seleção para WEEKLY */}
          {recurrenceType === 'WEEKLY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Dias da Semana *</Label>
                {selectedDays.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllDays}
                  >
                    Limpar todos
                  </Button>
                )}
              </div>

              <div className="border rounded-md p-4">
                <div className="space-y-3">
                  {WEEK_DAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-3">
                      <Checkbox
                        id={`weekday-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <label
                        htmlFor={`weekday-${day.value}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDays.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDays.map((day) => (
                    <Badge key={day} variant="secondary">
                      {getDayLabel(day)}
                      <X
                        className="h-3 w-3 ml-1 cursor-pointer hover:text-red-600"
                        onClick={() => toggleDay(day)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seleção para MONTHLY */}
          {recurrenceType === 'MONTHLY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Dias do Mês *</Label>
                {selectedDays.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllDays}
                  >
                    Limpar todos
                  </Button>
                )}
              </div>

              <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {MONTH_DAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`monthday-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <label
                        htmlFor={`monthday-${day.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {day.value}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDays.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDays.map((day) => (
                    <Badge key={day} variant="secondary">
                      {getDayLabel(day)}
                      <X
                        className="h-3 w-3 ml-1 cursor-pointer hover:text-red-600"
                        onClick={() => toggleDay(day)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seleção para YEARLY */}
          {recurrenceType === 'YEARLY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Datas de Lançamento *</Label>
                {selectedDates.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllDates}
                  >
                    Limpar todas
                  </Button>
                )}
              </div>

              {/* Seletor de Ano de Referência */}
              <div className="flex items-center gap-2">
                <Label htmlFor="reference_year" className="text-sm">Ano de Referência:</Label>
                <Select
                  value={referenceYear.toString()}
                  onValueChange={(value) => handleReferenceYearChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Calendário */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      selectedDates.length === 0 && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDates.length > 0
                      ? `${selectedDates.length} ${selectedDates.length === 1 ? 'data selecionada' : 'datas selecionadas'}`
                      : 'Selecione as datas no calendário'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={handleDateSelect}
                    month={calendarMonth}
                    onMonthChange={handleMonthChange}
                    fromDate={new Date(referenceYear, 0, 1)}
                    toDate={new Date(referenceYear, 11, 31)}
                    modifiers={getModifiers()}
                    modifiersStyles={getModifiersStyles()}
                    locale={ptBR}
                    className="rounded-md border"
                  />
                  <div className="p-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Clique nas datas para selecionar/desselecionar
                    </p>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Lista de Datas Selecionadas */}
              {selectedDates.length > 0 && (
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">
                    Datas selecionadas ({selectedDates.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDates.map((selected) => (
                      <Badge key={selected.dayOfYear} variant="secondary" className="gap-1">
                        <span>{selected.formatted}</span>
                        <X
                          className="h-3 w-3 ml-1 cursor-pointer hover:text-red-600"
                          onClick={() => removeDate(selected.dayOfYear)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Início */}
          <div className="space-y-2">
            <Label htmlFor="start_date">Data de Início *</Label>
            <Input
              id="start_date"
              type="date"
              {...register('start_date', {
                required: 'Data de início é obrigatória',
              })}
            />
            {errors.start_date && (
              <p className="text-sm text-red-600">{errors.start_date.message}</p>
            )}
          </div>

          {/* Data Fim */}
          <div className="space-y-2">
            <Label htmlFor="end_date">Data de Fim (Opcional)</Label>
            <Input
              id="end_date"
              type="date"
              {...register('end_date')}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para conta sem data de término
            </p>
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
              <CalendarIcon className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Salvando...' : editingBill ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
