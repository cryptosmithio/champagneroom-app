import type { Model } from 'mongoose';
import { default as mongoose, default as pkg } from 'mongoose';
import {
  genTimestampsSchema,
  mongooseZodCustomType,
  toMongooseSchema,
  toZodMongooseSchema,
  z
} from 'mongoose-zod';
import { nanoid } from 'nanoid';

import config from '$lib/config';

const { models } = pkg;

type RoomDocument = InstanceType<typeof Room>;

// Define the social media type enum
const SocialMediaType = z.enum([
  'FACEBOOK',
  'TWITTER',
  'INSTAGRAM',
  'LINKEDIN',
  'YOUTUBE',
  'TIKTOK',
  'OTHER'
]);

// Define the Mongoose model for 'Room'
const roomSchema = z
  .object({
    _id: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
      _id: true,
      auto: true
    }),
    name: z.string().trim().min(6).max(40),
    bannerImageUrl: z
      .string()
      .trim()
      .default(config.UI.defaultRoomBanner)
      .optional(),
    tagLine: z.string().min(6).max(40).optional(),
    announcement: z.string().min(10).max(256).optional(),
    uniqueUrl: z
      .string()
      .trim()
      .toLowerCase()
      .min(5)
      .max(40)
      .mongooseTypeOptions({
        default: () => nanoid(12)
      }),
    active: z.boolean().default(true),
    // Social media links with enum type
    socialMediaLinks: z
      .array(
        z.object({
          type: SocialMediaType, // Enum for social media type
          link: z.string().url(), // Actual URL to the social media profile
          displayUrl: z.string().url().optional(), // Display URL (optional)
          icon: z.string().url().optional() // URL to the icon image (optional)
        })
      )
      .optional()
  })
  .merge(genTimestampsSchema());

const roomZodMongooseSchema = toZodMongooseSchema(roomSchema, {
  schemaOptions: {
    collection: 'rooms'
  },
  typeOptions: {
    uniqueUrl: {
      index: true,
      unique: true
    },
    active: {
      index: true
    }
  }
});

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

const roomCRUDSchema = roomSchema
  .extend({
    _id: roomSchema.shape._id.optional()
  })
  .merge(
    z.object({
      image: z
        .instanceof(File, { message: 'Please upload a file.' })
        .refine(
          (f) => f.size < config.UI.maxImageSize,
          `Max ${config.UI.maxImageSize / 1024 / 1024} upload size.`
        )
        .refine((f) => ACCEPTED_IMAGE_TYPES.has(f.type), {
          message: 'Invalid file type.'
        })
        .optional(),

      id: z.string().optional()
    })
  );

type RoomDocumentType = z.infer<typeof roomSchema>;

const roomMongooseSchema = toMongooseSchema(roomZodMongooseSchema);

// Define TypeScript types for the Room document
const Room = models?.Room
  ? (models?.Room as Model<RoomDocumentType>)
  : mongoose.model<RoomDocumentType>('Room', roomMongooseSchema);

export type { RoomDocument, RoomDocumentType };

export { Room, SocialMediaType, roomCRUDSchema, roomSchema };
