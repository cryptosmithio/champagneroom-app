import type { Model } from 'mongoose';
import { default as mongoose, default as pkg } from 'mongoose';
import {
  genTimestampsSchema,
  mongooseZodCustomType,
  toMongooseSchema,
  z
} from 'mongoose-zod';

import type { ShowDocumentType } from './show';
import type { TransactionDocumentType } from './transaction';
const { models } = pkg;

const showEventZodSchema = z
  .object({
    _id: mongooseZodCustomType('ObjectId')
      .default(() => new mongoose.Types.ObjectId())
      .mongooseTypeOptions({ _id: true })
      .optional(),
    type: z.string(),
    show: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
      ref: 'Show'
    }),
    creator: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
      ref: 'Creator'
    }),
    agent: mongooseZodCustomType('ObjectId').optional().mongooseTypeOptions({
      ref: 'Agent'
    }),
    ticket: mongooseZodCustomType('ObjectId').optional().mongooseTypeOptions({
      ref: 'Ticket'
    }),
    transaction: mongooseZodCustomType('ObjectId')
      .optional()
      .mongooseTypeOptions({
        ref: 'Transaction'
      }),
    ticketInfo: z
      .object({
        customerName: z.string().trim().optional()
      })
      .optional()
  })
  .merge(genTimestampsSchema('createdAt', 'updatedAt'))
  .strict()
  .mongoose({
    schemaOptions: {
      collection: 'showevents'
    }
  });

const showeventSchema = toMongooseSchema(showEventZodSchema);
showeventSchema.index({ show: 1, createdAt: -1 });

export type ShowEventDocument = InstanceType<typeof ShowEvent>;

export type ShowEventDocumentType = z.infer<typeof showEventZodSchema>;

export const ShowEvent = models?.ShowEvent
  ? (models.ShowEvent as Model<ShowEventDocumentType>)
  : mongoose.model<ShowEventDocumentType>('ShowEvent', showeventSchema);

export const createShowEvent = ({
  show,
  type,
  ticketId,
  transaction,
  ticketInfo
}: {
  show: ShowDocumentType;
  type: string;
  ticketId?: string;
  transaction?: TransactionDocumentType;
  ticketInfo?: { customerName: string };
}) => {
  ShowEvent.create({
    show: show._id,
    type,
    ticketId,
    transaction: transaction?._id,
    agent: show.agent,
    creator: show.creator,
    ticketInfo
  });
};
