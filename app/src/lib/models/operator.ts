import type { Model } from 'mongoose';
import { default as mongoose, default as pkg } from 'mongoose';
import mongooseAutoPopulate from 'mongoose-autopopulate';
import {
  genTimestampsSchema,
  mongooseZodCustomType,
  toMongooseSchema,
  toZodMongooseSchema,
  z
} from 'mongoose-zod';

import type { UserDocument } from './user';

const { models } = pkg;

const operatorZodSchema = toZodMongooseSchema(
  z
    .object({
      _id: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        _id: true,
        auto: true
      }),
      user: mongooseZodCustomType('ObjectId').mongooseTypeOptions({
        autopopulate: true,
        ref: 'User',
        required: true
      })
    })
    .merge(genTimestampsSchema('createdAt', 'updatedAt')),
  {
    schemaOptions: {
      collection: 'operators'
    }
  }
);

const operatorSchema = toMongooseSchema(operatorZodSchema);
operatorSchema.plugin(mongooseAutoPopulate);

export type OperatorDocument = InstanceType<typeof Operator> & {
  user: UserDocument;
};

export type OperatorDocumentType = z.infer<typeof operatorZodSchema>;

export const Operator = models?.Operator
  ? (models.Operator as Model<OperatorDocumentType>)
  : mongoose.model<OperatorDocumentType>('Operator', operatorSchema);
