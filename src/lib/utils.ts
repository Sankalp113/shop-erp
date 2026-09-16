import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format number as Indian Rupees */
export function formatCurrency(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/** Format date string DD/MM/YYYY */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr), 'dd/MM/yyyy') } catch { return dateStr }
}

/** Relative time e.g. "3 days ago" */
export function timeAgo(dateStr: string): string {
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }) } catch { return dateStr }
}

/** Today's date as YYYY-MM-DD */
export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

/** Current month as YYYY-MM */
export function currentMonth(): string {
  return new Date().toISOString().substring(0, 7)
}

/** Truncate long strings */
export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

/** Calculate gross profit percentage */
export function profitPercent(selling: number, purchase: number): number {
  if (!purchase) return 0
  return Math.round(((selling - purchase) / selling) * 100)
}

/** Get initials from name */
export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
