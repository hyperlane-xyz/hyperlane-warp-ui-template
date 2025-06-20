import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  // @todo tw-merge doesn't respond to custom typography/icon classes
  return twMerge(clsx(inputs));
}
