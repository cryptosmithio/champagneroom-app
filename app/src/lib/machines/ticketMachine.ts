import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { nanoid } from 'nanoid';
import {
  assign,
  createActor,
  not,
  raise,
  sendTo,
  setup,
  type SnapshotFrom,
  spawnChild,
  type StateFrom,
  stopChild
} from 'xstate';

import type {
  DisputeType,
  FeedbackType,
  FinalizeType,
  RefundType,
  TransactionSummaryType
} from '$lib/models/common';
import {
  type CancelType,
  escrowSchema,
  finalizeSchema,
  redemptionSchema,
  refundSchema,
  type SaleType,
  ticketSaleSchema,
  transactionSummarySchema
} from '$lib/models/common';
import type { ShowDocument } from '$lib/models/show';
import type { TicketDocument } from '$lib/models/ticket';
import type { TransactionDocument } from '$lib/models/transaction';

import type { PayoutQueueType } from '$lib/workers/payoutWorker';

import type { CurrencyType } from '$lib/constants';
import {
  ActorType,
  CancelReason,
  DisputeDecision,
  EntityType,
  TicketStatus
} from '$lib/constants';
import type { DisplayInvoice } from '$lib/ext/bitcart/models';
import {
  calcTotal,
  InvoiceJobType,
  type PaymentType,
  PayoutJobType
} from '$lib/payments';

import { showMachine, type ShowMachineEventType } from './showMachine';

type TicketMachineContext = {
  ticket: TicketDocument;
  show: ShowDocument;
  redisConnection: IORedis;
  errorMessage: string | undefined;
  id: string;
};

//#region Event Types
export type TicketMachineEventType =
  | {
      type: 'CANCELLATION REQUESTED';
      cancel?: CancelType;
    }
  | {
      type: 'REFUND RECEIVED';
      transaction: TransactionDocument;
    }
  | {
      type: 'REFUND INITIATED';
      refund: RefundType;
    }
  | {
      type: 'PAYMENT RECEIVED';
      transaction: TransactionDocument;
    }
  | {
      type: 'FEEDBACK RECEIVED';
      feedback: FeedbackType;
    }
  | {
      type: 'DISPUTE INITIATED';
      dispute: DisputeType;
      refund: RefundType;
    }
  | {
      type: 'INVOICE RECEIVED';
      invoice: DisplayInvoice;
    }
  | {
      type: 'TICKET RESERVED';
    }
  | {
      type: 'SHOW JOINED';
    }
  | {
      type: 'SHOW LEFT';
    }
  | {
      type: 'SHOW ENDED';
    }
  | {
      type: 'SHOW CANCELLED';
      cancel: CancelType;
    }
  | {
      type: 'TICKET FINALIZED';
      finalize: FinalizeType;
    }
  | {
      type: 'DISPUTE DECIDED';
      decision: DisputeDecision;
      refund?: RefundType;
    }
  | {
      type: 'PAYMENT INITIATED';
      paymentCurrency: CurrencyType;
      paymentAddress: string;
      paymentId: string;
    }
  | {
      type: 'SHOW UPDATED';
      show: ShowDocument;
    };

//endregion

export type TicketMachineInput = {
  ticket: TicketDocument;
  show: ShowDocument;
  redisConnection: IORedis;
};

export type TicketMachineServiceType = ReturnType<
  typeof createTicketMachineService
>;

export type TicketMachineSnapshotType = SnapshotFrom<TicketMachineType>;

export type TicketMachineStateType = StateFrom<TicketMachineType>;

export type TicketMachineType = typeof ticketMachine;

export const createTicketMachineService = (input: TicketMachineInput) => {
  const ticketActor = createActor(ticketMachine, {
    input
  }).start();

  ticketActor.subscribe((state) => {
    if (state.context.ticket.save) {
      state.context.ticket.save();
    }
  });

  return ticketActor;
};

export const ticketMachine = setup({
  types: {
    events: {} as TicketMachineEventType,
    context: {} as TicketMachineContext,
    input: {} as TicketMachineInput
  },

  actions: {
    sendToShow: sendTo(
      'showActor',
      (
        _,
        params: { ticket: TicketDocument; type: ShowMachineEventType['type'] }
      ) => {
        return {
          type: params.type,
          ticket: params.ticket
        };
      }
    ),

    queueUpdateInvoiceAddress: (
      _,
      params: {
        ticket: TicketDocument;
        connection?: IORedis;
        paymentAddress?: string;
        paymentId?: string;
      }
    ) => {
      if (params.connection === undefined) return;
      const connection = params.connection as IORedis;
      const ticket = params.ticket;
      const invoiceQueue = new Queue(EntityType.INVOICE, {
        connection
      });
      invoiceQueue.add(InvoiceJobType.UPDATE_ADDRESS, {
        ticketId: ticket._id,
        paymentAddress: params.paymentAddress,
        paymentId: params.paymentId
      });
      invoiceQueue.close();
    },

    initiatePayment: assign(
      (
        _,
        params: {
          ticket: TicketDocument;
          paymentCurrency: CurrencyType;
        }
      ) => {
        const ticket = params.ticket;
        const paymentCurrency = params.paymentCurrency;

        ticket.ticketState.status = TicketStatus.PAYMENT_INITIATED;
        ticket.ticketState.sale = ticketSaleSchema.parse({
          totals: {
            [paymentCurrency]: 0
          },
          payments: [],
          currency: paymentCurrency
        }) as SaleType;
        return {
          ticket
        };
      }
    ),

    setFullyPaid: assign((_, params: { ticket: TicketDocument }) => {
      const ticket = params.ticket;
      ticket.ticketState.status = TicketStatus.FULLY_PAID;
      return { ticket };
    }),

    redeemTicket: assign((_, params: { ticket: TicketDocument }) => {
      const ticket = params.ticket;
      if (ticket.ticketState.status === TicketStatus.REDEEMED)
        return { ticket };
      ticket.ticketState.status = TicketStatus.REDEEMED;
      ticket.ticketState.redemption = redemptionSchema.parse({});
      return { ticket };
    }),

    reserveTicket: assign(
      (_, params: { ticket: TicketDocument; status: TicketStatus }) => {
        const ticket = params.ticket;
        ticket.ticketState.status = params.status;
        return { ticket };
      }
    ),

    cancelTicket: assign((_, params: { ticket: TicketDocument }) => {
      const ticket = params.ticket;
      ticket.ticketState.status = TicketStatus.CANCELLED;
      return { ticket };
    }),

    queueCancelInvoice: (
      _,
      params: { ticket: TicketDocument; connection?: IORedis }
    ) => {
      const ticket = params.ticket;
      if (!ticket.bcInvoiceId || !params.connection) return;
      const invoiceQueue = new Queue(EntityType.INVOICE, {
        connection: params.connection
      });
      invoiceQueue.add(InvoiceJobType.CANCEL, {
        bcInvoiceId: ticket.bcInvoiceId
      });
      invoiceQueue.close();
    },

    createInvoice: (
      _,
      params: { ticket: TicketDocument; connection?: IORedis }
    ) => {
      const ticket = params.ticket;
      if (!params.connection) return;
      const invoiceQueue = new Queue(EntityType.INVOICE, {
        connection: params.connection
      });
      invoiceQueue.add(InvoiceJobType.CREATE, {
        ticketId: ticket._id
      });
      invoiceQueue.close();
    },

    createRefundPayout: (
      _,
      params: { ticket: TicketDocument; connection?: IORedis }
    ) => {
      const ticket = params.ticket;
      if (!ticket.bcInvoiceId || !params.connection) return;
      const payoutQueue = new Queue(EntityType.PAYOUT, {
        connection: params.connection
      }) as PayoutQueueType;
      payoutQueue.add(PayoutJobType.REFUND_SHOW, {
        bcInvoiceId: ticket.bcInvoiceId,
        ticketId: ticket._id
      });
      payoutQueue.close();
    },

    receiveInvoice: assign(
      (_, params: { ticket: TicketDocument; invoice: DisplayInvoice }) => {
        let paymentAddress = params.ticket.paymentAddress;
        const payment = params.invoice.payments
          ? (params.invoice.payments[0] as PaymentType) // Use the first wallet
          : undefined;

        if (payment && 'payment_address' in payment) {
          paymentAddress = payment['payment_address'] as string;
        }
        const ticket = params.ticket;
        ticket.bcInvoiceId = params.invoice.id;
        ticket.paymentAddress = paymentAddress;
        return { ticket };
      }
    ),

    receivePayment: assign(
      (
        _,
        params: { ticket: TicketDocument; transaction: TransactionDocument }
      ) => {
        const ticket = params.ticket;
        const transaction = params.transaction;
        if (!ticket.ticketState.sale) return { ticket };
        const payment = transactionSummarySchema.parse({
          amount: transaction.amount,
          currency: transaction.currency.toUpperCase() as CurrencyType,
          rate: +(transaction.rate || 0),
          transaction: transaction._id
        });
        ticket.$inc('ticketState.sale.total', payment.amount);
        ticket.ticketState.sale.payments.push(payment);
        ticket.ticketState.status = TicketStatus.PAYMENT_RECEIVED;
        return { ticket };
      }
    ),

    requestRefund: assign(
      (
        _,
        params: {
          ticket: TicketDocument;
          refund: RefundType;
          cancel: CancelType;
        }
      ) => {
        const ticket = params.ticket;
        ticket.ticketState.status = TicketStatus.REFUND_REQUESTED;
        ticket.ticketState.cancel = params.cancel;
        ticket.ticketState.refund = params.refund;
        return {
          ticket
        };
      }
    ),

    initiateRefund: assign(
      (_, params: { ticket: TicketDocument; refund: RefundType }) => {
        const ticket = params.ticket;
        const refund = params.refund;
        ticket.ticketState.status = TicketStatus.WAITING_FOR_REFUND;
        ticket.ticketState.refund = refund;
        return { ticket };
      }
    ),

    receiveRefund: assign(
      (
        _,
        params: { ticket: TicketDocument; transaction: TransactionDocument }
      ) => {
        const ticket = params.ticket;
        const transaction = params.transaction;
        if (!ticket.ticketState.refund) return { ticket };
        const currency = transaction.currency.toUpperCase();
        const payout = transactionSummarySchema.parse({
          amount: +transaction.amount,
          currency,
          rate: +(transaction.rate || 0),
          transaction: transaction._id
        });
        ticket.ticketState.refund.payouts.push(payout);
        ticket.$inc('ticketState.refund.total', payout.amount);
        return { ticket };
      }
    ),

    receiveFeedback: assign(
      (_, params: { ticket: TicketDocument; feedback: FeedbackType }) => {
        const ticket = params.ticket;
        const feedback = params.feedback;
        ticket.ticketState.feedback = feedback;
        return { ticket };
      }
    ),

    initiateDispute: assign(
      (
        _,
        params: {
          ticket: TicketDocument;
          dispute: DisputeType;
          refund: RefundType;
        }
      ) => {
        const ticket = params.ticket;
        if (!ticket.ticketState.sale) return { ticket };
        ticket.ticketState.status = TicketStatus.IN_DISPUTE;
        ticket.ticketState.dispute = params.dispute;
        ticket.ticketState.refund = params.refund;
        return { ticket };
      }
    ),

    endShow: assign((_, params: { ticket: TicketDocument }) => {
      const ticket = params.ticket;
      ticket.ticketState.status = TicketStatus.IN_ESCROW;
      ticket.ticketState.escrow = escrowSchema.parse({});
      return { ticket };
    }),

    finalizeTicket: assign(
      (_, params: { ticket: TicketDocument; finalize: FinalizeType }) => {
        const ticket = params.ticket;
        const finalize = params.finalize;
        if (ticket.ticketState.status === TicketStatus.FINALIZED)
          return { ticket };

        ticket.ticketState.status = TicketStatus.FINALIZED;
        ticket.ticketState.finalize = finalize;
        return { ticket };
      }
    ),

    decideDispute: assign(
      (
        _,
        params: {
          ticket: TicketDocument;
          decision: DisputeDecision;
          refund?: RefundType;
        }
      ) => {
        const ticket = params.ticket;
        const decision = params.decision;
        const refund = params.refund;

        if (!ticket.ticketState.dispute) return { ticket };
        ticket.ticketState.dispute.decision = decision;
        ticket.ticketState.dispute.endedAt = new Date();
        ticket.ticketState.dispute.resolved = true;
        if (refund) ticket.ticketState.refund = refund;
        ticket.ticketState.status = TicketStatus.WAITING_FOR_DISPUTE_REFUND;
        return { ticket };
      }
    ),

    deactivateTicket: assign((_, params: { ticket: TicketDocument }) => {
      const ticket = params.ticket;
      ticket.ticketState.isActive = false;
      return { ticket };
    }),

    missShow: assign((_, params: { ticket: TicketDocument }) => {
      const ticket = params.ticket;
      ticket.ticketState.status = TicketStatus.MISSED_SHOW;
      return { ticket };
    })
  },
  guards: {
    ticketCreated: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.CREATED,
    ticketCancelled: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.CANCELLED,
    ticketFinalized: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.FINALIZED,
    ticketInDispute: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.IN_DISPUTE,
    ticketInEscrow: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.IN_ESCROW,
    ticketIsWaiting4Invoice: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.WAITING_FOR_INVOICE,
    ticketRedeemed: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.REDEEMED,
    ticketHasPaymentInitiated: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.PAYMENT_INITIATED,
    ticketHasPayment: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.PAYMENT_RECEIVED,
    ticketFullyPaid: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.FULLY_PAID,
    ticketHasRefundRequested: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.REFUND_REQUESTED,
    ticketIsWaitingForRefund: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.WAITING_FOR_REFUND,
    ticketMissedShow: ({ context }) =>
      context.ticket.ticketState.status === TicketStatus.MISSED_SHOW,
    ticketInDisputeRefund: ({ context }) =>
      context.ticket.ticketState.status ===
      TicketStatus.WAITING_FOR_DISPUTE_REFUND,
    fullyPaid: (
      { context, event },
      params: { transaction: TransactionDocument }
    ) => {
      const { transaction } = params;
      const amount =
        event.type === 'PAYMENT RECEIVED' ? +transaction.amount : 0;
      let total = +(amount * +(transaction.rate || 0)).toFixed(0);

      // Check total payments with rates at time of transaction.
      const payouts = (context.ticket.ticketState.sale?.payments ||
        new Map<string, TransactionSummaryType[]>()) as Map<
        string,
        TransactionSummaryType[]
      >;
      total += calcTotal(payouts);
      return total >= context.ticket.price.amount;
    },
    showMissed: ({ context }) => {
      return (
        context.ticket.ticketState.redemption === undefined ||
        context.ticket.ticketState.redemption?.redeemedAt === undefined
      );
    },
    fullyRefunded: ({ context, event }) => {
      const refund = context.ticket.ticketState.refund;
      if (refund === undefined) return false;
      const refundApproved = refund.approvedAmount || 0;
      if (refundApproved === 0) return false;
      const amount =
        event.type === 'REFUND RECEIVED' ? +event.transaction?.amount : 0;
      const totalRefundsAmount = refund.total || 0 + amount;

      return totalRefundsAmount >= refundApproved;
    },
    canWatchShow: ({ context }) => {
      return (
        context.ticket.ticketState.status === TicketStatus.REDEEMED ||
        context.ticket.ticketState.status === TicketStatus.FULLY_PAID
      );
    },
    canBeRefunded: ({ context }) => {
      const currency = context.ticket.price.currency;
      return (
        context.ticket.price.amount !== 0 &&
        (!context.ticket.ticketState.sale ||
          !context.ticket.ticketState.sale?.payments ||
          (context.ticket.ticketState.sale?.payments as any)[currency]
            ?.length === 0)
      );
    },
    noDisputeRefund: ({ context }, params: { decision: DisputeDecision }) => {
      const decision =
        context.ticket.ticketState.dispute?.decision || params.decision;
      if (!decision) return false;
      return decision === DisputeDecision.NO_REFUND;
    },
    canReserveFreeTicket: ({ context }) =>
      context.show.showState.salesStats.ticketsAvailable >= 0 &&
      context.ticket.price.amount === 0,
    canReservePaidTicket: ({ context }) =>
      context.show.showState.salesStats.ticketsAvailable >= 0 &&
      context.ticket.price.amount > 0
  }
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBcCWBjA1mZBZAhugBaoB2YAxAMICCAclQKIAyzNAKgJIDydABACVGARQCqjAMrtGAEQDaABgC6iUAAcA9rFRoNpVSAAeiAKwB2ADQgAnogDMAJgCcAOjsmnZ505MBGACz+AGx2AL6hVmhYOATEZJS0DCxsXLyCIuJSsnK+Kkggmtq6+vnGCOZWtgj+ZgAcLg6+TnZBQf5NCiFB4ZEY2HiEJOQUEgAS3ADqfIlMrNnKBoU6qHoGZRU2iEEKCi5BDib+Jo4HTrUtPSBR-bFDlGOT0-SzzNm5i1rLq6WmlpsIvlquxMOwUzX851qzku1xig3iI3GU1EAAUZBx5nl1J9imtEIDDi4AgpajVan4zHZKvY7L5gXZyR0gb4zCSYX04XFhg8pow6DJMR8iisSqB1n8qgd2i4vEFmiFmnZ3N0IlcOQMuWAXLDkMwNPgIJAKIosQUcSK8QgHMEGkETPszBC6Q5zkFqQDzEEGtaWi7GkE6iretENXdteq9QajTlTUtcT8rfbbfaHI7as7zlT-iy7K47IEHApDmcnP4DuyQ7d4uGQ5HDRBjQ5Y+bvmLEA4WsmHU6FC6Wu7fAcHA0TEDtvmzL57WFVTqq+Qa-069G7M3ha2jO2HF7tym0xn+9nfAGGumQv5Oi0nAoZ8GbvCFzrlw25P4119RZurceu6me323WzItXBvHNaScM5JzMCt701RccGfY0THfeM2ytTpf33XtXXdMxzDcF19hJIJalJJoYM5MMn31etjSCFCLQTQsdztbt02ww9JUCepC1pIszDlfMHAo0Nq2oqMXzMBiNzKA4WL3f9MwHWpWTcAsi38EsyxMET5y1cTaLkWppM-WTt0wxTOPbOxezcOlBwUNM5WE2d1T0+DdRo6MnBMy0O3ktiD0AyUi2HfNtNqfZnFzXSH30iMvJfOlfKYn9d0CjjgvbC9h14g4QT8G9-FiuCDOjXx3nyONGLQ60Ar-diAPdQsMPCi8zGvYIbJ01zKzilx0AAJzAfBkCNLgqAAaUYdh0gkRgBAANUFKqW1M0wGRcUkWlI8cwXzAdDn8Fx-DsDqmnTFlAxKsMhpGsaGwm6bZqEealreFK0OOeptpIyKb32-wBzLYdQMzHYIVHHq70o6thtgMBBoAN0gFwAHd8GWUgoH8ThSCRjQMEoCA9C1MgCewAbhtGsA8YJomTSFD9LV8Wl6jqOkSKLIErI9RoGknFlItaVNJxuuG4ERlGIHRzG0Gx-wUXwawAFswFIZAKBRGgAE1cD5WbODoTguAxeQFlW9d1oBOVfBlfNaVZWp5RMExDqaGVJxaTpNJvFyYdEhd4al1GyGWGmICV1X1c17W9YN9ImE4Zbzc+r9CyBFwUxUtojknBxDows4IQDOlIsdaG1T6uDg+R0PSHDh6o7VjWtd1-W6Bexgk5TmMmdQ9OSWBfYc8CcxBwHM7djw9iILzklanFoPJbrmXhvQMBUGl5uY7b+PO8Txhk5W7Erb8rxjpUkwO0nX3zCzKpWbOlwNKcOr3GCASl61WvpZcdfN7b2Vi3WO7cE5CB7h9fuNV045RlB0e0HVKSkiBtmF0JgZRnldFFMsi9eqwTDL-VGGMsY4wkEQDQaMKBPRmukAUjB9ap2gTJew1oMFnXtOSccU8soeinFtIIU5BwBmdumYq+DYbLwRqvWWpD-ACDAAAMwAK6kAbEIAAYqIfkh9j5MMtszBMjgjhuDwiRe0N4eHuggl6bYTQ2j2mCFOaCEjA4-xXn-Eh8scYKJUWoigmjtEyF0b3Sqp9DFoTpEWNwHglSNFpLmTo1iTGOHJBBdwTQ36+G-v-SAYAwBqwbDyPgrwNHsEZgYge6xATAknCpHwhwGQF2zAJMwex2hNFHJ1QRQYq4EIloaApRpikACluBGxPmaM+CY-D8MEfxEiY83bZlLnsepT9HKkhUjk9WtEaGzQ0UbGgzBOAAC1JnVRYQCSkrhgg+Cfqku0zUoYvx2MeKc+xII7LUfXRgsAhqUIoBoxgsgABCNApohIuWtFm3h4G5mPMEG8o5mmShqSdG8aSbmAlTN8+sLgyB-IBVQmQnAJAolENIPgRsTacDNhU8JVTEBmJcMXHOdIrxOF8M1FkuwUGAlzFCfalc5z9V2b8-5g1AUMqmREr8LK2UCQ5XKLlzVoojl7KyOo15WYircmKn5MsyAyFQLANQyixqyO8f4GQYB0CmpFBQUl5LKWMD4AKKgnABT6MZTAsoHUMEBgcD6MEIQyLNS8LsXiT9GQKECL00VcFxVGtICas1FqtReLIDjW19rtB6CdWSilVKPVeqgZUv1+IAh2A1YGZ0F1ajNShMdJp7gPBcsck4PF9c03mstVmhWvaM2+NUeoxgWidEQKPr3C2vqrkBBInscedRWkkldhG2kL8zDboqo4vCXbXHuWTS4FWpqEYQHIYC51xa3U0tNtIH1sqmXlD8DKEEu6uWO08M1CCbSQgdmCLbU6PVVSkA0IaeA+RE13GYdbJw7oAC0GCIIodQ6hqcOSyoQFg5aDYj9y5ElZkcUixi345LuhHHDCYywgXlIEXl5JSLLMfuYY6NRToqUdgoAIOSiHYYrVcnwbT3CKniaza8vDyRtKhOXONAZcxll4x44hcts243xoTDeVHIk7DzC6CqO6mgMndrczwpJBGHCgkp6RnjVMKx3hrbTX4hF8tOh1N+zhgioJY2WVlnhPAkTOoObJh7+p8YJQ3NAEcHPICc2UDoNbKTcQgq7a06ZDoggaGSbYTg7ROLwQHdy4WAFb0gDFuL2VKR7ClCEC6IIH74gZF6JLUEBLbA8NZkOMsB1kIoWjCrCBurDja8SQcXtHIZbCgEY4YIOrBsU6Fmuynut2Z8Uo0dA26R4VZccKcwbOiAghAOOTp5jxKiOKOEkt4+mSPcYMwpA2P7SaaE0AD76jjKUXR4EGKGyzboKzdtxA18CkA3gAGzB5AR72xhxHF9KdUN5xrHND2LSO0TR57BByYosg+AweoAAF5Q4E9bIzz3HBcuvqRCG7o2b0ihPsc7XhcWLbDMmgb9W33canJ+lk37-gZxreFfKs3NJ6urmzw1EWiVSv6yT3DzsGieABiEYiRZmo2Wk2CUseX5kum7SmodY0BuOj-czhHuWGTtGav+mURVjhjx9C4wrBr8XGtNX2zNq2bV2odRuS51t6knUZBk0cUI8JNpqHsME+27QdTaM7wHR6pfu-Tf273RuwAjrUZto4LboqlgZFCLljaBeMeD2dM4QWAwHpd0mqXp7YDnsvXLudcHWZqWCDJyEHZmPZQhA0UClntjcZZ+EIAA */
  context: ({ input }) => ({
    ticket: input.ticket,
    show: input.show,
    errorMessage: undefined as string | undefined,
    id: nanoid(),
    redisConnection: input.redisConnection
  }),
  id: 'ticketMachine',
  initial: 'ticketLoaded',
  exit: [stopChild('showActor')],
  entry: [
    ({ context }) => {
      spawnChild(showMachine, {
        id: 'showActor',
        input: {
          show: context.show,
          redisConnection: context.redisConnection
        }
      });
    }
  ],
  states: {
    ticketLoaded: {
      always: [
        {
          target: '#ticketMachine.created',
          guard: 'ticketCreated'
        },
        {
          target: '#ticketMachine.reserved.waiting4Invoice',
          guard: 'ticketIsWaiting4Invoice'
        },
        {
          target: '#ticketMachine.reserved.initiatedPayment',
          guard: 'ticketHasPaymentInitiated'
        },
        {
          target: '#ticketMachine.reserved.receivedPayment',
          guard: 'ticketHasPayment'
        },
        {
          target: '#ticketMachine.reserved.waiting4Show',
          guard: 'ticketFullyPaid'
        },
        {
          target: '#ticketMachine.reserved.waiting4Refund',
          guard: 'ticketIsWaitingForRefund'
        },
        {
          target: 'cancelled',
          guard: 'ticketCancelled'
        },
        {
          target: 'finalized',
          guard: 'ticketFinalized'
        },
        {
          target: 'redeemed',
          guard: 'ticketRedeemed'
        },
        {
          target: '#ticketMachine.ended.inEscrow',
          guard: 'ticketInEscrow'
        },
        {
          target: '#ticketMachine.ended.inDispute',
          guard: 'ticketInDispute'
        },
        {
          target: '#ticketMachine.ended.missedShow',
          guard: 'ticketMissedShow'
        },
        {
          target: '#ticketMachine.ended.inDispute.waiting4DisputeRefund',
          guard: 'ticketInDisputeRefund'
        }
      ]
    },
    created: {
      on: {
        'TICKET RESERVED': [
          {
            target: '#ticketMachine.reserved.waiting4Show',
            guard: 'canReserveFreeTicket',
            actions: [
              {
                type: 'reserveTicket',
                params: ({ context }) => ({
                  ticket: context.ticket,
                  status: TicketStatus.FULLY_PAID
                })
              },
              {
                type: 'sendToShow',
                params: ({ context }) => ({
                  ticket: context.ticket,
                  type: 'TICKET SOLD'
                })
              }
            ]
          },
          {
            target: '#ticketMachine.reserved.waiting4Invoice',
            guard: 'canReservePaidTicket',
            actions: [
              {
                type: 'reserveTicket',
                params: ({ context }) => ({
                  ticket: context.ticket,
                  status: TicketStatus.WAITING_FOR_INVOICE
                })
              },
              {
                type: 'sendToShow',
                params: ({ context }) => ({
                  ticket: context.ticket,
                  type: 'TICKET RESERVED'
                })
              },
              {
                type: 'createInvoice',
                params: ({ context }) => ({
                  ticket: context.ticket
                })
              }
            ]
          }
        ]
      }
    },
    reserved: {
      initial: 'waiting4Invoice',
      states: {
        waiting4Invoice: {
          on: {
            'INVOICE RECEIVED': {
              target: 'waiting4Payment',
              actions: [
                {
                  type: 'receiveInvoice',
                  params: ({ context, event }) => ({
                    ticket: context.ticket,
                    invoice: event.invoice
                  })
                }
              ]
            }
          }
        },
        waiting4Payment: {
          on: {
            'PAYMENT INITIATED': {
              target: '#ticketMachine.reserved.initiatedPayment',
              actions: [
                {
                  type: 'initiatePayment',
                  params: ({ context, event }) => ({
                    ticket: context.ticket,
                    paymentCurrency: event.paymentCurrency
                  })
                },
                {
                  type: 'queueUpdateInvoiceAddress',
                  params: ({ context, event }) => ({
                    ticket: context.ticket,
                    connection: context.redisConnection,
                    paymentAddress: event.paymentAddress,
                    paymentId: event.paymentId
                  })
                }
              ]
            }
          }
        },
        initiatedPayment: {
          on: {
            'PAYMENT RECEIVED': [
              {
                target: '#ticketMachine.reserved.waiting4Show',
                guard: {
                  type: 'fullyPaid',
                  params: ({ event }) => ({
                    transaction: event.transaction
                  })
                },
                actions: [
                  {
                    type: 'receivePayment',
                    params: ({ context, event }) => ({
                      ticket: context.ticket,
                      transaction: event.transaction
                    })
                  },
                  {
                    type: 'setFullyPaid',
                    params: ({ context }) => ({
                      ticket: context.ticket
                    })
                  },
                  {
                    type: 'sendToShow',
                    params: ({ context }) => ({
                      ticket: context.ticket,
                      type: 'TICKET SOLD'
                    })
                  }
                ]
              },
              {
                target: '#ticketMachine.reserved.receivedPayment',
                actions: [
                  {
                    type: 'receivePayment',
                    params: ({ context, event }) => ({
                      ticket: context.ticket,
                      transaction: event.transaction
                    })
                  }
                ]
              }
            ]
          }
        },
        receivedPayment: {
          // under paid
          on: {
            'PAYMENT RECEIVED': [
              {
                target: '#ticketMachine.reserved.waiting4Show',
                guard: {
                  type: 'fullyPaid',
                  params: ({ event }) => ({
                    transaction: event.transaction
                  })
                },
                actions: [
                  {
                    type: 'receivePayment',
                    params: ({ context, event }) => ({
                      ticket: context.ticket,
                      transaction: event.transaction
                    })
                  },
                  {
                    type: 'setFullyPaid',
                    params: ({ context }) => ({ ticket: context.ticket })
                  },
                  {
                    type: 'sendToShow',
                    params: ({ context }) => ({
                      ticket: context.ticket,
                      type: 'TICKET SOLD'
                    })
                  }
                ]
              },
              {
                actions: [
                  {
                    type: 'receivePayment',
                    params: ({ context, event }) => ({
                      ticket: context.ticket,
                      transaction: event.transaction
                    })
                  }
                ]
              }
            ]
          }
        },
        waiting4Show: {
          on: {
            'SHOW JOINED': {
              target: '#ticketMachine.redeemed',
              guard: 'canWatchShow',
              actions: [
                {
                  type: 'redeemTicket',
                  params: ({ context }) => ({
                    ticket: context.ticket
                  })
                },
                {
                  type: 'sendToShow',
                  params: ({ context }) => ({
                    ticket: context.ticket,
                    type: 'TICKET REDEEMED'
                  })
                }
              ]
            }
          }
        },
        waiting4Refund: {
          on: {
            'REFUND RECEIVED': [
              {
                target: '#ticketMachine.cancelled',
                guard: 'fullyRefunded',
                actions: [
                  {
                    type: 'receiveRefund',
                    params: ({ context, event }) => ({
                      ticket: context.ticket,
                      transaction: event.transaction
                    })
                  },
                  {
                    type: 'cancelTicket',
                    params: ({ context }) => ({
                      ticket: context.ticket
                    })
                  },
                  {
                    type: 'sendToShow',
                    params: ({ context }) => ({
                      ticket: context.ticket,
                      type: 'TICKET REFUNDED'
                    })
                  }
                ]
              },
              {
                actions: [
                  {
                    type: 'receiveRefund',
                    params: ({ context, event }) => ({
                      ticket: context.ticket,
                      transaction: event.transaction
                    })
                  }
                ]
              }
            ]
          }
        }
      }
    },
    redeemed: {
      on: {
        'SHOW LEFT': {
          actions: [
            {
              type: 'sendToShow',
              params: ({ context }) => ({
                ticket: context.ticket,
                type: 'CUSTOMER LEFT'
              })
            }
          ]
        },
        'SHOW JOINED': {
          guard: 'canWatchShow',
          actions: [
            {
              type: 'sendToShow',
              params: ({ context }) => ({
                ticket: context.ticket,
                type: 'CUSTOMER JOINED'
              })
            }
          ]
        }
      }
    },
    cancelled: {
      type: 'final',
      entry: [
        {
          type: 'deactivateTicket',
          params: ({ context }) => ({
            ticket: context.ticket
          })
        }
      ]
    },
    finalized: {
      type: 'final',
      entry: [
        {
          type: 'deactivateTicket',
          params: ({ context }) => ({
            ticket: context.ticket
          })
        }
      ]
    },
    ended: {
      initial: 'inEscrow',
      on: {
        'TICKET FINALIZED': {
          target: '#ticketMachine.finalized',
          actions: [
            {
              type: 'finalizeTicket',
              params: ({ context, event }) => ({
                ticket: context.ticket,
                finalize: event.finalize
              })
            },
            {
              type: 'sendToShow',
              params: ({ context }) => ({
                ticket: context.ticket,
                type: 'TICKET FINALIZED'
              })
            }
          ]
        }
      },
      states: {
        inEscrow: {
          always: [
            {
              target: 'missedShow',
              guard: 'showMissed',
              actions: [
                {
                  type: 'missShow',
                  params: ({ context }) => ({
                    ticket: context.ticket
                  })
                }
              ]
            }
          ],
          on: {
            'FEEDBACK RECEIVED': {
              actions: [
                {
                  type: 'receiveFeedback',
                  params: ({ context, event }) => ({
                    ticket: context.ticket,
                    feedback: event.feedback
                  })
                },
                raise({
                  type: 'TICKET FINALIZED',
                  finalize: finalizeSchema.parse({
                    finalizedBy: ActorType.CUSTOMER
                  })
                })
              ]
            },
            'DISPUTE INITIATED': {
              target: 'inDispute',
              actions: [
                {
                  type: 'initiateDispute',
                  params: ({ context, event }) => ({
                    ticket: context.ticket,
                    dispute: event.dispute,
                    refund: event.refund
                  })
                },
                {
                  type: 'sendToShow',
                  params: ({ context }) => ({
                    ticket: context.ticket,
                    type: 'TICKET DISPUTED'
                  })
                }
              ]
            }
          }
        },
        inDispute: {
          initial: 'waiting4Decision',
          states: {
            waiting4Decision: {
              on: {
                'DISPUTE DECIDED': [
                  {
                    actions: [
                      {
                        type: 'decideDispute',
                        params: ({ context, event }) => ({
                          ticket: context.ticket,
                          decision: event.decision,
                          refund: event.refund
                        })
                      },
                      raise({
                        type: 'TICKET FINALIZED',
                        finalize: finalizeSchema.parse({
                          finalizedBy: ActorType.ARBITRATOR
                        })
                      })
                    ],
                    guard: {
                      type: 'noDisputeRefund',
                      params: ({ event }) => ({
                        decision: event.decision
                      })
                    }
                  },
                  {
                    actions: [
                      {
                        type: 'decideDispute',
                        params: ({ context, event }) => ({
                          ticket: context.ticket,
                          decision: event.decision,
                          refund: event.refund
                        })
                      }
                    ],
                    target: 'waiting4DisputeRefund'
                  }
                ]
              }
            },
            waiting4DisputeRefund: {
              on: {
                'REFUND RECEIVED': {
                  actions: [
                    {
                      type: 'receiveRefund',
                      params: ({ context, event }) => ({
                        ticket: context.ticket,
                        transaction: event.transaction
                      })
                    },
                    raise({
                      type: 'TICKET FINALIZED',
                      finalize: finalizeSchema.parse({
                        finalizedBy: ActorType.ARBITRATOR
                      })
                    })
                  ]
                }
              }
            }
          }
        },
        missedShow: {
          on: {
            'DISPUTE INITIATED': {
              target: 'inDispute',
              actions: [
                {
                  type: 'initiateDispute',
                  params: ({ context, event }) => ({
                    ticket: context.ticket,
                    dispute: event.dispute,
                    refund: event.refund
                  })
                },
                {
                  type: 'sendToShow',
                  params: ({ context }) => ({
                    ticket: context.ticket,
                    type: 'TICKET DISPUTED'
                  })
                }
              ]
            }
          }
        }
      }
    }
  },
  on: {
    'CANCELLATION REQUESTED': [
      {
        guard: not('canBeRefunded'),
        target: '#ticketMachine.cancelled',
        actions: [
          {
            type: 'cancelTicket',
            params: ({ context, event }) => ({
              ticket: context.ticket,
              cancel:
                event.cancel ??
                ({
                  cancelledAt: new Date(),
                  cancelledBy: ActorType.CUSTOMER,
                  reason: CancelReason.CUSTOMER_CANCELLED,
                  cancelledInState: context.show.showState.status
                } as CancelType)
            })
          },
          {
            type: 'queueCancelInvoice',
            params: ({ context }) => ({
              ticket: context.ticket,
              connection: context.redisConnection
            })
          },
          {
            type: 'sendToShow',
            params: ({ context }) => ({
              ticket: context.ticket,
              type: 'TICKET CANCELLED'
            })
          }
        ]
      },
      {
        target: '#ticketMachine.reserved.waiting4Refund',
        actions: [
          {
            type: 'requestRefund',
            params: ({ context, event }) => ({
              ticket: context.ticket,
              cancel:
                event.cancel ??
                ({
                  cancelledAt: new Date(),
                  cancelledBy: ActorType.CUSTOMER,
                  reason: CancelReason.CUSTOMER_CANCELLED,
                  cancelledInState: context.show.showState.status
                } as CancelType),
              refund: refundSchema.parse({
                reason: CancelReason.CUSTOMER_CANCELLED,
                requestedAmounts: context.ticket.ticketState.sale?.total || 0,
                refundCurrency: context.ticket.ticketState.sale?.paymentCurrency
              })
            })
          },
          {
            type: 'createRefundPayout',
            params: ({ context }) => ({
              ticket: context.ticket,
              connection: context.redisConnection
            })
          }
        ]
      }
    ],
    'SHOW CANCELLED': [
      {
        target: '#ticketMachine.reserved.waiting4Refund',
        actions: [
          {
            type: 'requestRefund',
            params: ({ context }) => ({
              ticket: context.ticket,
              cancel: {
                cancelledAt: new Date(),
                cancelledBy: ActorType.AGENT,
                reason: CancelReason.CREATOR_CANCELLED,
                cancelledInState: context.show.showState.status
              } as CancelType,
              refund: refundSchema.parse({
                reason: CancelReason.CREATOR_CANCELLED,
                requestedAmounts: context.ticket.ticketState.sale?.total || 0,
                refundCurrency: context.ticket.ticketState.sale?.paymentCurrency
              })
            })
          },
          {
            type: 'createRefundPayout',
            params: ({ context }) => ({
              ticket: context.ticket,
              connection: context.redisConnection
            })
          }
        ],
        guard: 'canBeRefunded'
      },
      {
        target: '#ticketMachine.cancelled',
        actions: [
          {
            type: 'cancelTicket',
            params: ({ context }) => ({
              ticket: context.ticket
            })
          },
          {
            type: 'queueCancelInvoice',
            params: ({ context }) => ({
              ticket: context.ticket,
              connection: context.redisConnection
            })
          },
          {
            type: 'sendToShow',
            params: ({ context }) => ({
              ticket: context.ticket,
              type: 'TICKET CANCELLED'
            })
          }
        ]
      }
    ],
    'SHOW UPDATED': {
      actions: [
        assign({
          show: ({ event }) => event.show
        }),
        stopChild('showActor'),
        ({ context }) => {
          spawnChild(showMachine, {
            id: 'showActor',
            input: {
              show: context.show,
              redisConnection: context.redisConnection
            }
          });
        }
      ]
    },
    'SHOW ENDED': {
      target: '#ticketMachine.ended',
      actions: [
        {
          type: 'endShow',
          params: ({ context }) => ({
            ticket: context.ticket
          })
        }
      ]
    }
  }
});
