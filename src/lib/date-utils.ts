/**
 * Utilitários para manipulação de datas
 * Evita problemas de timezone ao trabalhar com datas ISO
 */

/**
 * Converte string de data ISO (YYYY-MM-DD) para Date sem conversão de timezone
 * @param dateString - Data no formato "YYYY-MM-DD"
 * @returns Date object na data local correta
 */
export function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formata data para exibição com dia da semana em português
 * @param dateString - Data no formato "YYYY-MM-DD"
 * @returns Data formatada "Seg, 28/10/2025"
 */
export function formatDateWithWeekday(dateString: string): string {
  const date = parseISODate(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formata data para exibição simples
 * @param dateString - Data no formato "YYYY-MM-DD"
 * @returns Data formatada "28/10/2025"
 */
export function formatDate(dateString: string): string {
  const date = parseISODate(dateString);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

/**
 * Obtém data de hoje no formato YYYY-MM-DD
 */
export function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata valor monetário para Real Brasileiro
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata percentual com tratamento de valores especiais
 */
export function formatPercentage(value: number): string {
  if (!isFinite(value)) return '∞';
  if (isNaN(value)) return '0.00';
  return value.toFixed(2);
}