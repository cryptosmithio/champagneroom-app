import { nanoid } from 'nanoid';
import { z } from 'zod';

export type RoomDocumentType = z.infer<typeof roomZodSchema>;

export const roomZodSchema = z.object({
  name: z.string().trim().min(6).max(40),
  coverImageUrl: z.string().trim().optional(),
  tagLine: z.string().optional(),
  announcement: z.string().trim().optional(),
  uniqueUrl: z
    .string()
    .trim()
    .toLowerCase()
    .min(5)
    .max(40)
    .default(() => nanoid()),
  active: z.boolean().default(true)
});