/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { assign, createMachine, interpret, type StateFrom } from 'xstate';
import { raise } from 'xstate/lib/actions';

import type {
  CancelType,
  DisputeDecision,
  DisputeType,
  FeedbackType,
  FinalizeType,
  MoneyType,
  RefundType,
  SaleType
} from '$lib/models/common';
import type { CurrencyType } from '$lib/models/common';
import { RefundReason } from '$lib/models/common';
import type { TicketDocumentType, TicketStateType } from '$lib/models/ticket';
import { TicketStatus } from '$lib/models/ticket';
import type { TransactionDocumentType } from '$lib/models/transaction';

import type { ShowJobDataType } from '$lib/workers/showWorker';

import { ActorType } from '$lib/constants';
import { calcTotal } from '$lib/util/payment';

import { ShowMachineEventString } from './showMachine';

export enum TicketMachineEventString {
  CANCELLATION_REQUESTED = 'CANCELLATION REQUESTED',
  REFUND_RECEIVED = 'REFUND RECEIVED',
  PAYMENT_INITIATED = 'PAYMENT INITIATED',
  PAYMENT_RECEIVED = 'PAYMENT RECEIVED',
  FEEDBACK_RECEIVED = 'FEEDBACK RECEIVED',
  DISPUTE_INITIATED = 'DISPUTE INITIATED',
  SHOW_JOINED = 'SHOW JOINED',
  SHOW_LEFT = 'SHOW LEFT',
  SHOW_ENDED = 'SHOW ENDED',
  SHOW_CANCELLED = 'SHOW CANCELLED',
  TICKET_FINALIZED = 'TICKET FINALIZED',
  DISPUTE_RESOLVED = 'DISPUTE RESOLVED',
  TICKET_REDEEMED = 'TICKET REDEEMED',
  REFUND_REQUESTED = 'REFUND REQUESTED',
  REFUND_INITIATED = 'REFUND INITIATED'
}
type TicketMachineEventType =
  | {
      type: 'CANCELLATION REQUESTED';
      cancel: CancelType;
    }
  | {
      type: 'REFUND RECEIVED';
      transaction: TransactionDocumentType;
    }
  | {
      type: 'REFUND REQUESTED';
      refund: RefundType;
    }
  | {
      type: 'REFUND INITIATED';
      refund: RefundType;
    }
  | {
      type: 'PAYMENT RECEIVED';
      transaction: TransactionDocumentType;
    }
  | {
      type: 'FEEDBACK RECEIVED';
      feedback: FeedbackType;
    }
  | {
      type: 'DISPUTE INITIATED';
      dispute: DisputeType;
    }
  | {
      type: 'TICKET REDEEMED';
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
      type: 'DISPUTE RESOLVED';
      decision: DisputeDecision;
    }
  | { type: 'PAYMENT INITIATED' };

const createTicketMachine = ({
  ticketDocument,
  ticketMachineOptions
}: {
  ticketDocument: TicketDocumentType;
  ticketMachineOptions?: TicketMachineOptions;
}) => {
  /** @xstate-layout N4IgpgJg5mDOIC5QBcCWBjA1mZBZAhugBaoB2YAxAMoASA8gOoAEAwgIIByLAogDK-cAIgG0ADAF1EoAA4B7WKjSzSUkAA9EAFgBMAGhABPRNoCM2zQDoAHCZObRVgOyaAnNqsuAvp-1osOAmIySlpGVk4efiFhE0kkEDkFJRV4jQQdfSMEEwBmF0cLAFYANjdtQtETYs0rYqtvXwxsPEIScgs-Zt5ZfAhICjE4mXlFVGVVNJzHQos7UWLi0ULzURcTZ0zEXNFLbRdC2tFHHM0qzRyGkE6A1uCOppxu3v6YoYSR5InEHMKZuYWlis1htDMYdjNKpoalZRDlio5HKJtJdri0gu1UU8+hABto3olRuNUogrHpQQhzG4LKZHNUctp5vkTCiHmi2mB7v5kFiXjl8R8xilQGltKZqcVfgdCvS3BVHJsEMUfhZXDlYZopSYdpoWVzAuzOV0etiBpp+UlBV8EFM-vYAct7MDNAqzAdqfs1vYEXZcrrmvq7pjjS9CubCUL1IhHGSstpSjMpnDnCVRKtkT4rqyAxjWTyccJimHPsSEMsFWq4yqrGqXOdYfNmRnUdmOUHnvnHEXLSWGSZxZKrNK9uUjgrRS4inkXE5HGtlm5in6buiOQAnOBgVcAN36oWY3A4gmiElUBOLwq2NgK6wZLhyHkKjisGXJJysFlh09K1cfn51TazW52nXWBNx3CALAAd3wUZSCgTQAAV8AMABbMBSGQCgELYABNXADwAFSYAAlbgeAASQANWPLsiQvbJYWKIpChqaZYQRGF5XJKxn1mJUjlycxim0RxG0aPUgLXDdt0gKCYLQODEOQtCMKw3D8I4IjSIo6iRFiU8BToyMEGOSw7RE4oTEfcpygVUkciKbYTGfeltkKJc2TuECwNk6DYPgpDUPQzD2C4PheDYAjyLoDgmHIjhyKiyKaIMi0jLSZyRNmaNVnvfYnxfLIqlEixZwOI48lsJwLgAiSVwsbyZIgvyFIC5TgooULIgiqKYrihKkoI6J9PiM9u3orVK1+ViKimJ9R3JMwsufOMdGqdZan-cT-UkhrpPAuT-KUoLVMGVLwytSamOmpxZo4hasmrd8qhyMxNAWWkdhq7blwNRqDpash4KoIhZEg6h6GYAApOh4pS0bDIjDKr2y288sfFa7PmUqtVTFx+Oc+YPJbPbQKaiwyFGfBkEgFh8FIdAwAAGyZ6nBUO1rNGIsAADMAFdSBxUiADEAFVDxIsjuCo+HhjSpHL3WVHcofAqY0vUVZl+WwrMfKzYWJ3b-tkym0Gp2n6cZlm2eUDmga53mBaF7gxYl7Tpd015zvPYy7DhaxCnyJw4xOUxihdON30ZUUKjOWpF1qnb6vXSAwDQnE9yYARhYIs6Eflq1ykRCw8g1VadjMeEFWcbRqVx8rVcHQ3k7AVP04hsIYbhkQT3zi6ewqGZzjYwp1hyV7nXJaoZmmOo7xOSonzEzM6r+1u+nbzODyPHvaIVxV1YpZw+0TGEpkHJ9n2bg0yG4WB0FXMGKGF7ghAAITYFgAGlJZ02X3gLiWU4DlTKImcDKQccYxxgOyg4aMJQ3AmHyNfO4t976P3BoIciVAEKiyGv1RK5Fkq729uNYywDSonDAecPYkDw7kncI+Sci94Q-Eyu5ROv1UGkDvg-J+UVv7cCIsLeKbBeDkQAFr-zGulLQuRKGaGoRA5Y9DYyWVEDjaYNlR52BKN4DMpBZB9HgPEZsklSGyIQAAWlUYgfYH57Cpicc4xwKCcxcjzBY-ehUtjlDMkcJYUJFHVAcG4qSZNwJeKtHUJi5laRWXgbZckxwmKVBrGsfI+wRJhNJj5Zq8l7aBRUsgKJJYEQQjYQcKYfspgKjcJYfGllqzOSsq9HJxt8lHRBmDUpE0fhmQ1Kcaos5KiijsucCwCxXqvWmtUdMP1PLAX2ibUgVMaYQDpgzZmrMfYyP3rkHiAcg7RiVDoKoLpCZFFKKYKEmToztOWRBU2qBzYbMttsm2pA7aKW5vzQWvTfZyhVK4Coz4mS2BdHCCcyxtB5VpAcJwDy26QABSKZyTF7xqmEh4H4cJbEIBcpMpUop3Bwq8JwxZHJ0DvJZiivuPs0UuAnDUDUr1ygShKIfUwqxZh2HODxIu30V5JwNDzMg+AmaoAAF50rlv3eidILD4wXNKFiiwzDQJ5YsesiwGT0iODktBfDIKouMHeSZlRiV2HxrUQo0CmHaoWMJcB2SKUkzIIIVAsBpB8xpqaxUSsJTwhYnixYs5yyLyrK9L6DJR6uoWSTFCXrQIQG6Sa+lZCMrTlrvSeyHhFHLFhOWao4olT5EshUI4719GeCAA */
  return createMachine(
    {
      context: {
        ticketDocument,
        ticketMachineOptions,
        ticketState: JSON.parse(
          JSON.stringify(ticketDocument.ticketState)
        ) as TicketStateType,
        errorMessage: undefined as string | undefined,
        id: nanoid()
      },
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      tsTypes: {} as import('./ticketMachine.typegen.d.ts').Typegen0,
      schema: {
        events: {} as TicketMachineEventType
      },
      predictableActionArguments: true,
      id: 'ticketMachine',
      initial: 'ticketLoaded',
      states: {
        ticketLoaded: {
          always: [
            {
              target: 'reserved',
              cond: 'ticketReserved'
            },
            {
              target: '#ticketMachine.reserved.initiatedPayment',
              cond: 'ticketHasPaymentInitiated'
            },
            {
              target: '#ticketMachine.reserved.receivedPayment',
              cond: 'ticketHasPayment'
            },
            {
              target: '#ticketMachine.reserved.waiting4Show',
              cond: 'ticketFullyPaid'
            },
            {
              target: '#ticketMachine.reserved.refundRequested',
              cond: 'ticketHasRefundRequested'
            },
            {
              target: '#ticketMachine.reserved.waiting4Refund',
              cond: 'ticketIsWaitingForRefund'
            },
            {
              target: 'cancelled',
              cond: 'ticketCancelled'
            },
            {
              target: 'finalized',
              cond: 'ticketFinalized'
            },
            {
              target: 'redeemed',
              cond: 'ticketRedeemed'
            },
            {
              target: '#ticketMachine.ended.inEscrow',
              cond: 'ticketInEscrow'
            },
            {
              target: '#ticketMachine.ended.inDispute',
              cond: 'ticketInDispute'
            },
            {
              target: '#ticketMachine.ended.missedShow',
              cond: 'ticketMissedShow'
            }
          ]
        },
        reserved: {
          initial: 'waiting4Payment',
          on: {
            'SHOW CANCELLED': {
              target: '#ticketMachine.reserved.refundRequested',
              actions: ['requestRefundCancelledShow']
            }
          },
          states: {
            waiting4Payment: {
              on: {
                'SHOW CANCELLED': {
                  target: '#ticketMachine.cancelled',
                  actions: ['cancelTicket', 'sendTicketCancelled']
                },
                'CANCELLATION REQUESTED': {
                  target: '#ticketMachine.cancelled',
                  actions: ['cancelTicket', 'sendTicketCancelled']
                },
                'PAYMENT INITIATED': {
                  target: 'initiatedPayment',
                  actions: ['initiatePayment']
                }
              }
            },
            initiatedPayment: {
              on: {
                'PAYMENT RECEIVED': [
                  {
                    target: '#ticketMachine.reserved.waiting4Show',
                    cond: 'fullyPaid',
                    actions: [
                      'receivePayment',
                      'setFullyPaid',
                      'sendTicketSold'
                    ]
                  },
                  {
                    target: '#ticketMachine.reserved.receivedPayment',
                    actions: ['receivePayment']
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
                    cond: 'fullyPaid',
                    actions: [
                      'receivePayment',
                      'setFullyPaid',
                      'sendTicketSold'
                    ]
                  },
                  {
                    actions: ['receivePayment']
                  }
                ],
                'REFUND REQUESTED': {
                  target: 'refundRequested',
                  actions: ['requestRefund']
                }
              }
            },
            waiting4Show: {
              on: {
                'TICKET REDEEMED': {
                  target: '#ticketMachine.redeemed',
                  cond: 'canWatchShow',
                  actions: ['redeemTicket', 'sendTicketRedeemed']
                },
                'REFUND REQUESTED': {
                  target: 'refundRequested',
                  actions: ['requestRefund']
                }
              }
            },
            refundRequested: {
              on: {
                'REFUND INITIATED': {
                  target: 'waiting4Refund',
                  actions: ['initiateRefund']
                }
              }
            },
            waiting4Refund: {
              on: {
                'REFUND RECEIVED': [
                  {
                    target: '#ticketMachine.cancelled',
                    cond: 'fullyRefunded',
                    actions: [
                      'receiveRefund',
                      'cancelTicket',
                      'sendTicketRefunded'
                    ]
                  },
                  {
                    actions: ['receiveRefund']
                  }
                ]
              }
            }
          }
        },
        redeemed: {
          on: {
            'SHOW LEFT': { actions: ['sendLeftShow'] },
            'SHOW JOINED': {
              cond: 'canWatchShow',
              actions: ['sendJoinedShow']
            }
          }
        },
        cancelled: {
          type: 'final',
          entry: ['deactivateTicket']
        },
        finalized: {
          type: 'final',
          entry: ['deactivateTicket']
        },
        ended: {
          initial: 'inEscrow',
          on: {
            'TICKET FINALIZED': {
              target: '#ticketMachine.finalized',
              actions: ['finalizeTicket', 'sendTicketFinalized']
            }
          },
          states: {
            inEscrow: {
              always: [
                {
                  target: 'missedShow',
                  cond: 'showMissed',
                  actions: ['missShow']
                }
              ],
              on: {
                'FEEDBACK RECEIVED': {
                  actions: [
                    'receiveFeedback',
                    raise({
                      type: 'TICKET FINALIZED',
                      finalize: {
                        finalizedAt: new Date(),
                        finalizedBy: ActorType.CUSTOMER
                      }
                    })
                  ]
                },
                'DISPUTE INITIATED': {
                  target: 'inDispute',
                  actions: ['initiateDispute', 'sendDisputeInitiated']
                }
              }
            },
            inDispute: {
              on: {
                'DISPUTE RESOLVED': {
                  actions: [
                    'resolveDispute',
                    raise({
                      type: 'TICKET FINALIZED',
                      finalize: {
                        finalizedAt: new Date(),
                        finalizedBy: ActorType.ARBITRATOR
                      }
                    }),
                    'sendDisputeResolved'
                  ]
                }
              }
            },
            missedShow: {
              on: {
                'DISPUTE INITIATED': {
                  target: 'inDispute',
                  actions: ['initiateDispute', 'sendDisputeInitiated']
                }
              }
            }
          }
        }
      },
      on: {
        'SHOW ENDED': {
          target: '#ticketMachine.ended',
          actions: ['endShow']
        }
      }
    },
    {
      actions: {
        sendJoinedShow: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.CUSTOMER_JOINED,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString(),
              customerName: context.ticketDocument.customerName
            }
          );
        },

        sendLeftShow: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.CUSTOMER_LEFT,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString(),
              customerName: context.ticketDocument.customerName
            }
          );
        },

        sendTicketSold: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.TICKET_SOLD,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString(),
              sale: context.ticketState.sale,
              customerName: context.ticketDocument.customerName
            }
          );
        },

        sendTicketRedeemed: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.TICKET_REDEEMED,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString()
            }
          );
        },

        sendTicketRefunded: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.TICKET_REFUNDED,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString(),
              refund: context.ticketState.refund
            }
          );
        },

        sendTicketCancelled: (context, event) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.TICKET_CANCELLED,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString(),
              customerName: context.ticketDocument.customerName,
              cancel: event.cancel
            }
          );
        },

        sendTicketFinalized: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.TICKET_FINALIZED,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString()
            }
          );
        },

        sendDisputeInitiated: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.TICKET_DISPUTED,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString(),
              dispute: context.ticketState.dispute
            }
          );
        },

        sendDisputeResolved: (context) => {
          ticketMachineOptions?.showQueue?.add(
            ShowMachineEventString.DISPUTE_RESOLVED,
            {
              showId: context.ticketDocument.show.toString(),
              ticketId: context.ticketDocument._id.toString(),
              decision: context.ticketState.dispute!.decision
            }
          );
        },

        requestRefundCancelledShow: assign((context, event) => {
          const state = context.ticketState;
          const refund = {
            _id: new Types.ObjectId(),
            requestedAt: new Date(),
            transactions: [] as Types.ObjectId[],
            actualAmounts: {} as Map<string, number>,
            requestedAmounts: state.sale?.totals || ({} as Map<string, number>),
            approvedAmounts: state.sale?.totals || ({} as Map<string, number>),
            reason: RefundReason.SHOW_CANCELLED,
            totals: {} as Map<string, number>,
            payouts: {} as any
          } as RefundType;
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.REFUND_REQUESTED,
              cancel: event.cancel,
              refund
            }
          };
        }),

        initiatePayment: assign((context) => {
          const sale = {
            _id: new Types.ObjectId(),
            soldAt: new Date(),
            transactions: [] as Types.ObjectId[],
            totals: new Map<string, number>()
          } as SaleType;

          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.PAYMENT_INITIATED,
              sale
            }
          };
        }),

        setFullyPaid: assign((context) => {
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.FULLY_PAID
            }
          };
        }),

        redeemTicket: assign((context) => {
          if (context.ticketState.status === TicketStatus.REDEEMED) return {};
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.REDEEMED,
              redemption: {
                redeemedAt: new Date()
              }
            }
          };
        }),

        cancelTicket: assign((context) => {
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.CANCELLED
            }
          };
        }),

        receivePayment: assign((context, event) => {
          const sale = context.ticketState.sale;
          if (!sale) return {};
          const payment = {
            amount: +event.transaction.amount,
            currency: event.transaction.currency.toUpperCase() as CurrencyType,
            rate: +(event.transaction.rate || 0)
          };

          sale.transactions.push(event.transaction._id);
          const totals = sale.totals;

          const total = (totals[payment.currency] || 0) + payment.amount;
          sale.totals[payment.currency] = total;

          const payments = sale.payments[payment.currency] || [];

          payments.push({
            amount: +event.transaction.amount,
            currency: event.transaction.currency.toUpperCase() as CurrencyType,
            rate: +(event.transaction.rate || 0)
          });

          sale.payments[payment.currency] = payments;

          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.PAYMENT_RECEIVED
            }
          };
        }),

        requestRefund: assign((context, event) => {
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.REFUND_REQUESTED,
              refund: event.refund
            }
          };
        }),

        initiateRefund: assign((context, event) => {
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.WAITING_FOR_REFUND,
              refund: event.refund
            }
          };
        }),

        receiveRefund: assign((context, event) => {
          const state = context.ticketState;
          const currency = event.transaction.currency.toUpperCase();
          const payment = {
            amount: +event.transaction.amount,
            currency,
            rate: +(event.transaction.rate || 0)
          } as MoneyType;
          const refund = state.refund;
          if (!refund) return {};

          const total = refund.totals[payment.currency] || 0 + payment.amount;
          refund.totals[payment.currency] = total;
          refund.transactions.push(event.transaction._id);

          const payouts = refund.payouts[payment.currency] || [];

          payouts.push({
            amount: +event.transaction.amount,
            currency: event.transaction.currency.toUpperCase() as CurrencyType,
            rate: +(event.transaction.rate || 0)
          });

          refund.payouts[payment.currency] = payouts;

          return {
            ticketState: {
              ...context.ticketState,
              refund
            }
          };
        }),

        receiveFeedback: assign((context, event) => {
          return {
            ticketState: {
              ...context.ticketState,
              feedback: event.feedback
            }
          };
        }),

        initiateDispute: assign((context, event) => {
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.IN_DISPUTE,
              dispute: event.dispute
            }
          };
        }),

        endShow: assign((context) => {
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.IN_ESCROW,
              escrow: {
                startedAt: new Date()
              }
            }
          };
        }),

        finalizeTicket: assign((context, event) => {
          const finalize = event.finalize;
          if (context.ticketState.status !== TicketStatus.FINALIZED) {
            return {
              ticketState: {
                ...context.ticketState,
                finalize,
                status: TicketStatus.FINALIZED
              }
            };
          }
          return {};
        }),

        resolveDispute: assign((context, event) => {
          if (!context.ticketState.dispute) return {};
          const dispute = {
            ...context.ticketState.dispute,
            decision: event.decision,
            endedAt: new Date(),
            resolved: true
          };
          return {
            ticketState: {
              ...context.ticketState,
              dispute
            }
          };
        }),

        deactivateTicket: assign((context) => {
          return {
            ticketState: {
              ...context.ticketState,
              activeState: false
            }
          };
        }),

        missShow: assign((context) => {
          return {
            ticketState: {
              ...context.ticketState,
              status: TicketStatus.MISSED_SHOW
            }
          };
        })
      },
      guards: {
        ticketCancelled: (context) =>
          context.ticketState.status === TicketStatus.CANCELLED,
        ticketFinalized: (context) =>
          context.ticketState.status === TicketStatus.FINALIZED,
        ticketInDispute: (context) =>
          context.ticketState.status === TicketStatus.IN_DISPUTE,
        ticketInEscrow: (context) =>
          context.ticketState.status === TicketStatus.IN_ESCROW,
        ticketReserved: (context) =>
          context.ticketState.status === TicketStatus.RESERVED,
        ticketRedeemed: (context) =>
          context.ticketState.status === TicketStatus.REDEEMED,
        ticketHasPaymentInitiated: (context) =>
          context.ticketState.status === TicketStatus.PAYMENT_INITIATED,
        ticketHasPayment: (context) =>
          context.ticketState.status === TicketStatus.PAYMENT_RECEIVED,
        ticketFullyPaid: (context) =>
          context.ticketState.status === TicketStatus.FULLY_PAID,
        ticketHasRefundRequested: (context) =>
          context.ticketState.status === TicketStatus.REFUND_REQUESTED,
        ticketIsWaitingForRefund: (context) =>
          context.ticketState.status === TicketStatus.WAITING_FOR_REFUND,
        ticketMissedShow: (context) =>
          context.ticketState.status === TicketStatus.MISSED_SHOW,
        fullyPaid: (context, event) => {
          const amount =
            event.type === 'PAYMENT RECEIVED' ? +event.transaction?.amount : 0;
          let total = +(amount * +(event.transaction?.rate || 0)).toFixed(0);

          // Check total payments with rates at time of transaction.
          const payouts = (context.ticketState.sale?.payments ||
            new Map<string, MoneyType[]>()) as Map<string, MoneyType[]>;
          total += calcTotal(payouts);

          return total >= context.ticketDocument.price.amount;
        },
        showMissed: (context) => {
          return (
            context.ticketState.redemption === undefined ||
            context.ticketState.redemption?.redeemedAt === undefined
          );
        },
        fullyRefunded: (context, event) => {
          const refund = context.ticketState.refund;
          if (refund === undefined) return false;
          const currency = event.transaction.currency.toUpperCase();
          const refundApproved = refund.approvedAmounts[currency] || 0;
          if (refundApproved === 0) return false;
          const amount =
            event.type === 'REFUND RECEIVED' ? +event.transaction?.amount : 0;
          const totalRefundedAmount = refund.totals[currency] || 0 + amount;

          // Check to see if all other currencies have been refunded
          for (const [key, value] of Object.entries(refund.approvedAmounts)) {
            if (key === currency) continue;
            if (
              !refund.approvedAmounts[key] ||
              refund.approvedAmounts[key] === 0
            )
              return false;

            if ((refund.totals[key] || 0) < value) return false;
          }

          const refundedInTransactionCurrency =
            totalRefundedAmount >= refundApproved;

          return refundedInTransactionCurrency;
        },
        canWatchShow: (context) => {
          return (
            context.ticketState.status === TicketStatus.REDEEMED ||
            context.ticketState.status === TicketStatus.FULLY_PAID
          );
        }
      }
    }
  );
};

export { TicketMachineEventType };

export { createTicketMachine };

export const createTicketMachineService = ({
  ticketDocument,
  ticketMachineOptions
}: {
  ticketDocument: TicketDocumentType;
  ticketMachineOptions?: TicketMachineOptions;
}) => {
  const ticketMachine = createTicketMachine({
    ticketDocument,
    ticketMachineOptions
  });
  const ticketService = interpret(ticketMachine).start();

  if (ticketMachineOptions?.saveStateCallback) {
    ticketService.onChange((context) => {
      ticketMachineOptions.saveStateCallback &&
        ticketMachineOptions.saveStateCallback(context.ticketState);
    });
  }

  return ticketService;
};

export type TicketMachineOptions = {
  saveStateCallback?: (state: TicketStateType) => void;
  gracePeriod?: number;
  escrowPeriod?: number;
  showQueue?: Queue<ShowJobDataType, any, string>;
};

export type TicketMachineServiceType = ReturnType<
  typeof createTicketMachineService
>;

export type TicketMachineStateType = StateFrom<
  ReturnType<typeof createTicketMachine>
>;

export type TicketMachineType = ReturnType<typeof createTicketMachine>;
