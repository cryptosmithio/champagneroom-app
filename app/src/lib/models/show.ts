import { default as pkg } from 'mongoose';
import { fieldEncryption } from 'mongoose-field-encryption';
import {
  genTimestampsSchema,
  mongooseZodCustomType,
  toMongooseSchema,
  z
} from 'mongoose-zod';
import { toZodMongooseSchema } from 'mongoose-zod';
import { nanoid } from 'nanoid';

import { ShowStatus } from '$lib/constants';

import {
  cancelZodSchema,
  creatorInfoZodSchema,
  disputeStatsZodSchema,
  escrowZodSchema,
  feedbackStatsZodSchema,
  finalizeZodSchema,
  moneyZodSchema,
  runtimeZodSchema,
  salesStatsZodSchema,
  showSalesStatsZodSchema
} from './common';

export type ShowDocument = InstanceType<typeof Show>;

const showStateZodSchema = z.object({
  status: z.nativeEnum(ShowStatus).default(ShowStatus.CREATED),
  active: z.boolean().default(true),
  salesStats: showSalesStatsZodSchema.default({}),
  feedbackStats: feedbackStatsZodSchema.default({}),
  disputeStats: disputeStatsZodSchema.default({}),
  cancel: cancelZodSchema.optional(),
  finalize: finalizeZodSchema.optional(),
  escrow: escrowZodSchema.optional(),
  runtime: runtimeZodSchema.optional(),
  refunds: z
    .array(
      mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        ref: 'Ticket',
        get: (value) => value?.toString()
      })
    )
    .default([]),
  sales: z
    .array(
      mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        ref: 'Ticket',
        get: (value) => value?.toString()
      })
    )
    .default([]),
  disputes: z
    .array(
      mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        ref: 'Ticket',
        get: (value) => value?.toString()
      })
    )
    .default([]),
  reservations: z
    .array(
      mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        ref: 'Ticket',
        get: (value) => value?.toString()
      })
    )
    .default([]),
  redemptions: z
    .array(
      mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        ref: 'Ticket',
        get: (value) => value?.toString()
      })
    )
    .default([]),
  finalizations: z
    .array(
      mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        ref: 'Ticket',
        get: (value) => value?.toString()
      })
    )
    .default([]),
  cancellations: z
    .array(mongooseZodCustomType('ObjectId'))
    .mongooseTypeOptions({
      ref: 'Ticket',
      get: (value) => value?.toString()
    })
    .default([]),
  current: z.boolean().default(true)
});

const showZodSchema = toZodMongooseSchema(
  z
    .object({
      _id: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        _id: true,
        auto: true,
        get: (value) => value?.toString()
      }),
      creator: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        ref: 'Creator',
        get: (value) => value?.toString()
      }),
      agent: mongooseZodCustomType('ObjectId')
        .mongooseTypeOptions({
          ref: 'Agent',
          get: (value) => value?.toString()
        })
        .optional(),
      roomId: z.string().default(nanoid),
      coverImageUrl: z.string().trim().optional(),
      duration: z
        .number()
        .min(0, { message: 'Duration must be over 0' })
        .max(180, { message: 'Duration must be under 180 minutes' }),
      name: z
        .string()
        .min(3, { message: 'Name must be at least 3 characters' })
        .max(50, { message: 'Name must be under 50 characters' })
        .trim(),
      capacity: z.number().min(1).default(1),
      price: moneyZodSchema.default({}),
      creatorInfo: creatorInfoZodSchema,
      showState: showStateZodSchema.default({})
    })
    .merge(genTimestampsSchema()),
  {
    schemaOptions: {
      collection: 'shows'
    },
    typeOptions: {
      _id: {
        auto: true,
        get: (value) => value?.toString()
      }
    }
  }
);

const showSchema = toMongooseSchema(showZodSchema);

export type ShowStateType = z.infer<typeof showStateZodSchema>;

export const SaveState = (show: ShowDocument, newState: ShowStateType) => {
  Show.updateOne({ _id: show._id }, { $set: { showState: newState } }).exec();
};

type ShowDocumentType = z.infer<typeof showZodSchema>;

showSchema.index({ agent: 1, 'showState.finalize.finalizedAt': -1 });
showSchema.plugin(fieldEncryption, {
  fields: ['roomId'],
  secret: process.env.MONGO_DB_FIELD_SECRET,
  saltGenerator: (secret: string) => secret.slice(0, 16)
});
export const Show = pkg.models.Show ?? pkg.model('Show', showSchema);

export { ShowDocumentType };
