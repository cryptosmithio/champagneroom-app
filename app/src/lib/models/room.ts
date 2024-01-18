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

const { models } = pkg;

type RoomDocument = InstanceType<typeof Room>;

// Define the social media type enum
const SocialMediaType = z.enum([
  'Facebook',
  'Twitter',
  'Instagram',
  'LinkedIn',
  'YouTube',
  'TikTok',
  'Other'
]);

// Define the Mongoose model for 'Room'
const roomZodSchema = z
  .object({
    _id: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
      _id: true,
      auto: true
    }),
    name: z.string().trim().min(6).max(40),
    bannerImageUrl: z.string().trim().optional(),
    tagLine: z.string().min(6).max(40).optional(),
    announcement: z.string().min(10).max(256).optional(),
    uniqueUrl: z
      .string()
      .trim()
      .toLowerCase()
      .min(5)
      .max(40)
      .default(() => nanoid()),
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

const roomZodMongooseSchema = toZodMongooseSchema(roomZodSchema, {
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

const roomCRUDSchema = roomZodSchema.extend({
  _id: roomZodSchema.shape._id.optional()
});

type RoomDocumentType = z.infer<typeof roomZodSchema>;

const roomMongooseSchema = toMongooseSchema(roomZodMongooseSchema);

// Define TypeScript types for the Room document
const Room = models?.Room
  ? (models?.Room as Model<RoomDocumentType>)
  : mongoose.model<RoomDocumentType>('Room', roomMongooseSchema);

export type { RoomDocument, RoomDocumentType };
export { Room, roomCRUDSchema, roomZodSchema };
