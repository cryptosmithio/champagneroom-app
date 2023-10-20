import type { AxiosResponse } from 'axios';
import type { Job, Queue } from 'bullmq';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';

import type { PayoutType } from '$lib/models/common';
import { CurrencyType } from '$lib/models/common';
import { Creator } from '$lib/models/creator';
import { Ticket } from '$lib/models/ticket';
import {
  Transaction,
  TransactionReasonType,
  type TransactionType
} from '$lib/models/transaction';
import { Wallet } from '$lib/models/wallet';

import { TicketMachineEventString } from '$lib/machines/ticketMachine';
import { WalletMachineEventString } from '$lib/machines/walletMachine';

import { EntityType } from '$lib/constants';
import {
  batchActionsOnPayoutsPayoutsBatchPost,
  createPayoutPayoutsPost,
  getInvoiceByIdInvoicesModelIdGet,
  getPayoutByIdPayoutsModelIdGet,
  getStoreByIdStoresModelIdGet,
  getWalletByIdWalletsModelIdGet,
  modifyPayoutPayoutsModelIdPatch,
  refundInvoiceInvoicesModelIdRefundsPost,
  submitRefundInvoicesRefundsRefundIdSubmitPost
} from '$lib/ext/bitcart';
import type {
  DisplayInvoice,
  DisplayPayout,
  Store,
  Wallet as BTWallet
} from '$lib/ext/bitcart/models';
import type { PaymentType } from '$lib/util/payment';
import { PayoutJobType, PayoutReason, PayoutStatus } from '$lib/util/payment';
import {
  getTicketMachineService,
  getWalletMachineService
} from '$lib/util/util.server';

export type PayoutJobDataType = {
  [key: string]: any;
};

export type PayoutQueueType = Queue<PayoutJobDataType, any, PayoutJobType>;

export const getPayoutWorker = ({
  payoutQueue,
  redisConnection,
  paymentAuthToken,
  paymentPeriod = 6_000_000 / 60 / 1000,
  payoutNotificationUrl = '',
  bitcartStoreId: bcStoreId
}: {
  payoutQueue: PayoutQueueType;
  redisConnection: IORedis;
  paymentAuthToken: string;
  paymentPeriod: number;
  payoutNotificationUrl: string;
  bitcartStoreId: string;
}) => {
  return new Worker(
    EntityType.PAYOUT,
    async (job: Job<PayoutJobDataType, any, string>) => {
      const payoutType = job.name as PayoutJobType;
      switch (payoutType) {
        case PayoutJobType.CREATE_REFUND: {
          const bcInvoiceId = job.data.bcInvoiceId;
          if (!bcInvoiceId) {
            return;
          }

          const ticketId = job.data.ticketId;
          if (!ticketId) {
            return;
          }

          const ticket = await Ticket.findById(ticketId);
          if (!ticket) {
            return;
          }

          const ticketService = getTicketMachineService(
            ticket,
            redisConnection
          );

          const ticketState = ticketService.getSnapshot();

          const response = (await getInvoiceByIdInvoicesModelIdGet(
            bcInvoiceId,
            {
              headers: {
                Authorization: `Bearer ${paymentAuthToken}`,
                'Content-Type': 'application/json'
              }
            }
          )) as AxiosResponse<DisplayInvoice>;
          const invoice = response.data as DisplayInvoice;

          // Possible there is unconfirmed payments.  If so, queue it up again and wait for timeout.
          if (ticketState.matches('reserved.initiatedPayment')) {
            payoutQueue.add(
              PayoutJobType.CREATE_REFUND,
              {
                bcInvoiceId
              },
              { delay: paymentPeriod }
            );
            return;
          }

          if (!ticketState.matches('reserved.refundRequested')) {
            return;
          }

          const issueRefund = async () => {
            try {
              const payment = invoice.payments?.[0] as PaymentType;
              const returnAddress = payment.user_address; // Just send the return as lump sum to first address

              // Tell the ticketMachine REFUND INITIATED
              const ticketRefund = ticket.ticketState.refund;
              if (!ticketRefund) {
                throw new Error('Ticket refund not found');
              }

              const currency = (invoice.paid_currency?.toUpperCase() ||
                CurrencyType.ETH) as CurrencyType;

              const approvedAmounts = new Map<CurrencyType, number>();
              approvedAmounts.set(currency, +invoice.sent_amount);

              ticketRefund.approvedAmounts = approvedAmounts;

              ticketService.send({
                type: TicketMachineEventString.REFUND_INITIATED,
                refund: ticketRefund
              });

              let response = await refundInvoiceInvoicesModelIdRefundsPost(
                bcInvoiceId,
                {
                  amount: +invoice.sent_amount || 0,
                  currency: invoice.paid_currency || '',
                  admin_host: '',
                  send_email: false
                },
                {
                  headers: {
                    Authorization: `Bearer ${paymentAuthToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              let bcRefund = response.data;

              // Set refund address from the original invoice
              response = await submitRefundInvoicesRefundsRefundIdSubmitPost(
                bcRefund.id,
                { destination: returnAddress },
                {
                  headers: {
                    Authorization: `Bearer ${paymentAuthToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              bcRefund = response.data;

              if (!bcRefund.payout_id) {
                throw new Error('No payout ID returned from Bitcart API');
              }

              // Set the notification URL for the payout
              response = await modifyPayoutPayoutsModelIdPatch(
                bcRefund.payout_id,
                {
                  notification_url: payoutNotificationUrl,
                  metadata: {
                    payoutReason: PayoutReason.REFUND
                  }
                },
                {
                  headers: {
                    Authorization: `Bearer ${paymentAuthToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              // Approve the payout
              response = await batchActionsOnPayoutsPayoutsBatchPost(
                {
                  ids: [bcRefund.payout_id],
                  command: 'approve'
                },
                {
                  headers: {
                    Authorization: `Bearer ${paymentAuthToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              // Send the payout
              response = await batchActionsOnPayoutsPayoutsBatchPost(
                {
                  ids: [bcRefund.payout_id],
                  command: 'send'
                },
                {
                  headers: {
                    Authorization: `Bearer ${paymentAuthToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
            } catch (error_) {
              console.error(error_);
            }
          };
          issueRefund();
          break;
        }

        case PayoutJobType.PAYOUT_UPDATE: {
          const bcPayoutId = job.data.bcPayoutId;
          if (!bcPayoutId) {
            console.error('No payout ID');
            return;
          }
          const status = job.data.status as string;
          if (!status) {
            console.error('No status');
            return;
          }

          // Get the payout

          const response = await getPayoutByIdPayoutsModelIdGet(bcPayoutId, {
            headers: {
              Authorization: `Bearer ${paymentAuthToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.data) {
            console.error('No payout found for ID:', bcPayoutId);
            return;
          }

          const bcPayout = response.data as DisplayPayout;
          if (!bcPayout) {
            console.error('No payout');
            return;
          }
          switch (status) {
            case PayoutStatus.SENT: {
              // Tell the walletMachine PAYOUT SENT
              const reason = bcPayout.metadata?.payoutReason as PayoutReason;
              if (reason === PayoutReason.CREATOR_PAYOUT) {
                const walletId = bcPayout.metadata?.walletId as string;
                if (!walletId) {
                  console.error('No wallet ID');
                  return;
                }
                const wallet = await Wallet.findById(walletId);
                if (!wallet) {
                  console.error('No wallet found for ID:', walletId);
                  return;
                }
                const walletService = getWalletMachineService(wallet);
                const walletState = walletService.getSnapshot();
                const creator = await Creator.findOne({
                  'user.wallet': walletId
                }).lean();
                if (!creator) {
                  console.error('No creator found for wallet ID:', walletId);
                  return;
                }

                const transaction = (await Transaction.create({
                  creator: creator._id,
                  agent: creator.agent,
                  hash: bcPayout.tx_hash,
                  to: bcPayout.destination,
                  reason: TransactionReasonType.CREATOR_PAYOUT,
                  amount: bcPayout.amount,
                  currency: wallet.currency,
                  bcPayoutId: bcPayout.id
                })) as TransactionType;

                if (
                  !walletState.can({
                    type: WalletMachineEventString.PAYOUT_SENT,
                    transaction
                  })
                ) {
                  console.error('Cannot send payout:', wallet.status);
                  return;
                }

                walletService.send({
                  type: WalletMachineEventString.PAYOUT_SENT,
                  transaction
                });
              }
              break;
            }

            case PayoutStatus.COMPLETE: {
              const reason = bcPayout.metadata?.payoutReason as PayoutReason;
              if (reason === PayoutReason.CREATOR_PAYOUT) {
                const walletId = bcPayout.metadata?.walletId as string;
                if (!walletId) {
                  console.error('No wallet ID');
                  return;
                }
                const wallet = await Wallet.findById(walletId);
                if (!wallet) {
                  console.error('No wallet found for ID:', walletId);
                  return;
                }
                const walletService = getWalletMachineService(wallet);

                walletService.send({
                  type: WalletMachineEventString.PAYOUT_COMPLETE,
                  bcPayoutId
                });
                break;
              }
            }

            default: {
              break;
            }
          }
          break;
        }

        case PayoutJobType.CREATE_PAYOUT: {
          const walletId = job.data.walletId;
          const payoutReason = job.data.payoutReason as PayoutReason;
          if (!walletId) {
            console.error('No wallet Id');
            return;
          }
          const destination = job.data.destination as string;
          if (!destination) {
            console.error('No destination');
            return;
          }
          const amount = job.data.amount as number;
          if (!amount) {
            console.error('No amount');
            return;
          }

          const wallet = await Wallet.findById(walletId);
          if (!wallet) {
            console.error('No wallet');
            return;
          }

          const walletService = getWalletMachineService(wallet);
          const walletState = walletService.getSnapshot();
          const payout = {
            amount,
            destination,
            currency: wallet.currency
          } as PayoutType;

          if (
            !walletState.can({
              type: WalletMachineEventString.PAYOUT_REQUESTED,
              payout
            })
          ) {
            console.error('Cannot request payout:', wallet.status);
            return;
          }

          // Ok, create the payout in bitcart
          // Get the store
          if (!bcStoreId || bcStoreId === '') {
            console.error('No bitcart store ID');
            return;
          }

          try {
            const response = await getStoreByIdStoresModelIdGet(bcStoreId, {
              headers: {
                Authorization: `Bearer ${paymentAuthToken}`,
                'Content-Type': 'application/json'
              }
            });
            if (!response.data) {
              console.error('No store found for ID:', bcStoreId);
              return;
            }
            const store = response.data as Store;

            // Get the wallet, just use the first one for now
            const bcWalletId = store.wallets[0];
            if (!bcWalletId) {
              console.error('No wallet found for store ID:', bcStoreId);
              return;
            }
            const bcWalletResponse = await getWalletByIdWalletsModelIdGet(
              bcWalletId,
              {
                headers: {
                  Authorization: `Bearer ${paymentAuthToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            if (!bcWalletResponse.data) {
              console.error('No wallet found for ID:', bcWalletId);
              return;
            }
            const bcWallet = bcWalletResponse.data as BTWallet;

            // Checks
            if (bcWallet.currency?.toUpperCase() !== wallet.currency) {
              console.error(
                'Wallet currency does not match expected currency:',
                bcWallet.currency,
                wallet.currency
              );
              return;
            }

            if (+bcWallet.balance < amount) {
              console.error('Insufficient funds in wallet:', walletId);
              return;
            }

            // Create the payout
            const bcPayoutResponse = await createPayoutPayoutsPost(
              {
                amount,
                destination,
                store_id: bcStoreId,
                wallet_id: bcWalletId,
                currency: wallet.currency,
                notification_url: payoutNotificationUrl,
                metadata: {
                  walletId,
                  payoutReason
                }
              },
              {
                headers: {
                  Authorization: `Bearer ${paymentAuthToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            if (!bcPayoutResponse.data) {
              console.error('No payout created');
              return;
            }

            const bcPayout = bcPayoutResponse.data;
            payout.bcPayoutId = bcPayout.id;
            payout.payoutStatus = bcPayout.status;

            walletService.send({
              type: WalletMachineEventString.PAYOUT_REQUESTED,
              payout
            });
          } catch (error_) {
            console.error(error_);
          }
          break;
        }

        default: {
          break;
        }
      }
    },
    { autorun: false, connection: redisConnection }
  );
};
