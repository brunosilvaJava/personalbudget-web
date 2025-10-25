import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (date: string | Date): string => {
  try {
    if (typeof date === 'string') {
      // Tenta parseISO para strings ISO 8601
      const parsedDate = parseISO(date);
      return format(parsedDate, 'dd/MM/yyyy', { locale: ptBR });
    }
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', date, error);
    return String(date);
  }
};

export const formatDateTime = (date: string | Date): string => {
  try {
    if (typeof date === 'string') {
      const parsedDate = parseISO(date);
      return format(parsedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    }
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data/hora:', date, error);
    return String(date);
  }
};

export const formatDateToISO = (date: Date): string => {
  try {
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Erro ao formatar data para ISO:', date, error);
    return '';
  }
};

export const formatDateTimeToISO = (date: Date): string => {
  try {
    return date.toISOString();
  } catch (error) {
    console.error('Erro ao formatar data/hora para ISO:', date, error);
    return '';
  }
};
