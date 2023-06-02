import { ActorType } from '$lib/constants';
import type { InferSchemaType, Model } from 'mongoose';
import { default as mongoose, default as pkg } from 'mongoose';
import { fieldEncryption } from 'mongoose-field-encryption';
import { nanoid } from 'nanoid';
const { Schema, models } = pkg;
export enum ShowStatus {
  CREATED = 'CREATED',
  BOX_OFFICE_OPEN = 'BOX OFFICE OPEN',
  BOX_OFFICE_CLOSED = 'BOX OFFICE CLOSED',
  CANCELLED = 'CANCELLED',
  FINALIZED = 'FINALIZED',
  CANCELLATION_INITIATED = 'CANCELLATION INITIATED',
  REFUND_INITIATED = 'REFUND INITIATED',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
  STOPPED = 'STOPPED',
  IN_ESCROW = 'IN ESCROW',
}

export enum ShowCancelReason {
  TALENT_NO_SHOW = 'TALENT NO SHOW',
  CUSTOMER_NO_SHOW = 'CUSTOMER NO SHOW',
  SHOW_RESCHEDULED = 'SHOW RESCHEDULED',
  TALENT_CANCELLED = 'TALENT CANCELLED',
  CUSTOMER_CANCELLED = 'CUSTOMER CANCELLED',
}

const cancelSchema = new Schema({
  cancelledAt: { type: Date, required: true, default: Date.now },
  cancelledInState: { type: String },
  requestedBy: { type: String, enum: ActorType, required: true },
  reason: { type: String, enum: ShowCancelReason, required: true },
});

const finalizeSchema = new Schema({
  finalizedAt: { type: Date, required: true, default: Date.now },
  finalizedBy: { type: String, enum: ActorType, required: true },
});

const escrowSchema = new Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date },
});

const refundSchema = new Schema({
  refundedAt: { type: Date, required: true, default: Date.now },
  transactions: [
    { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  ],
  ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
  requestedBy: { type: String, enum: ActorType, required: true },
  amount: { type: Number, required: true, default: 0 },
});

const saleSchema = new Schema({
  soldAt: { type: Date, required: true, default: Date.now },
  transactions: [
    { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  ],
  ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
  amount: { type: Number, required: true, default: 0 },
});

const runtimeSchema = new Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date },
});

const salesStatsSchema = new Schema({
  ticketsAvailable: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
  ticketsSold: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
  ticketsReserved: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
  ticketsRefunded: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
  ticketsRedeemed: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
  totalSales: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
  totalRefunded: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
});

const feedbackStatsSchema = new Schema({
  totalReviews: {
    type: Number,
    required: true,
    default: 0,
  },
  averageRating: {
    type: Number,
    required: true,
    default: 0,
  },
});

const showStateSchema = new Schema(
  {
    status: {
      type: String,
      enum: ShowStatus,
      required: true,
      default: ShowStatus.CREATED,
    },
    active: { type: Boolean, required: true, default: true },
    salesStats: {
      type: salesStatsSchema,
      required: true,
      default: () => ({}),
    },
    feedbackStats: {
      type: feedbackStatsSchema,
      required: true,
      default: () => ({}),
    },
    cancel: cancelSchema,
    finalize: finalizeSchema,
    escrow: escrowSchema,
    runtime: runtimeSchema,
    refunds: { type: [refundSchema], required: true, default: () => [] },
    sales: { type: [saleSchema], required: true, default: () => [] },
  },
  { timestamps: true }
);

const showSchema = new Schema(
  {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _id: { type: Schema.Types.ObjectId, required: true, auto: true },
    talent: { type: Schema.Types.ObjectId, ref: 'Talent', required: true },
    agent: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    roomId: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(),
    },
    coverImageUrl: { type: String, trim: true },
    duration: {
      type: Number,
      required: true,
      min: [0, 'Duration must be over 0'],
      max: [180, 'Duration must be under 180 minutes'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value',
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minLength: [3, 'Name must be at least 3 characters'],
      maxLength: [50, 'Name must be under 50 characters'],
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value',
      },
    },
    price: { type: Number, required: true, min: 1 },
    talentInfo: {
      type: {
        name: { type: String, required: true },
        profileImageUrl: { type: String, required: true },
        ratingAvg: { type: Number, required: true, default: 0 },
        numReviews: { type: Number, required: true, default: 0 },
      },
      required: true,
    },
    showState: { type: showStateSchema, required: true, default: () => ({}) },
  },
  { timestamps: true }
);

showSchema.plugin(fieldEncryption, {
  fields: ['roomId'],
  secret: process.env.MONGO_DB_FIELD_SECRET,
});

export type ShowStateType = InferSchemaType<typeof showStateSchema>;

export type ShowCancelType = InferSchemaType<typeof cancelSchema>;

export type ShowDocumentType = InferSchemaType<typeof showSchema>;

export type ShowRefundType = InferSchemaType<typeof refundSchema>;

export type ShowSaleType = InferSchemaType<typeof saleSchema>;

export type ShowFinalizedType = InferSchemaType<typeof finalizeSchema>;

export const Show = models?.Show
  ? (models.Show as Model<ShowDocumentType>)
  : mongoose.model<ShowDocumentType>('Show', showSchema);

export type ShowType = InstanceType<typeof Show>;
