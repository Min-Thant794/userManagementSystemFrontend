import { z } from 'zod';
export const username = z
  .string()
  .trim()
  .min(3, 'Use at least 3 characters.')
  .max(50, 'Use at most 50 characters.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers and underscores.');
export const email = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(255);
export const phoneNumber = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'Use 7–15 digits, optionally starting with +.');
export const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[a-zA-Z]/, 'Include a letter.')
  .regex(/[0-9]/, 'Include a number.');
