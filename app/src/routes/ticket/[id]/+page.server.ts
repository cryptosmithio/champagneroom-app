import {
  JWT_EXPIRY,
  JWT_MASTER_DB_SECRET,
  JWT_MASTER_DB_USER,
  JWT_TICKET_DB_SECRET,
  JWT_TICKET_DB_USER,
  MASTER_DB_ENDPOINT,
} from '$env/static/private';
import { PUBLIC_PIN_PATH, PUBLIC_RXDB_PASSWORD } from '$env/static/public';
import { ticketDB } from '$lib/ORM/dbs/ticketDB';
import type {
  TicketDisputeReason,
  TicketDocType,
  TicketDocument,
} from '$lib/ORM/models/ticket';
import { TicketCancelReason } from '$lib/ORM/models/ticket';
import { StorageType } from '$lib/ORM/rxdb';
import { TransactionReasonType } from '$lib/models/transaction';

import { createTicketMachineService } from '$lib/machines/ticketMachine';
import { ActorType } from '$lib/util/constants';
import { verifyPin } from '$lib/util/pin';
import { error, fail, redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import urlJoin from 'url-join';

const getTicket = async (ticketId: string) => {
  const token = jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + Number.parseInt(JWT_EXPIRY),
      sub: JWT_TICKET_DB_USER,
      kid: JWT_TICKET_DB_USER,
    },
    JWT_TICKET_DB_SECRET,
    { keyid: JWT_TICKET_DB_USER }
  );

  const masterToken = jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + Number.parseInt(JWT_EXPIRY),
      sub: JWT_MASTER_DB_USER,
    },
    JWT_MASTER_DB_SECRET,
    { keyid: JWT_MASTER_DB_USER }
  );

  const db = await ticketDB(ticketId, masterToken, {
    endPoint: MASTER_DB_ENDPOINT,
    storageType: StorageType.NODE_WEBSQL,
    rxdbPassword: PUBLIC_RXDB_PASSWORD,
  });
  if (!db) {
    throw error(500, 'no db');
  }

  const ticket = (await db.tickets.findOne(ticketId).exec()) as TicketDocument;

  if (!ticket) {
    throw error(404, 'Ticket not found');
  }

  const show = await ticket.show_;
  if (!show) {
    throw error(404, 'Show not found');
  }

  return { token, ticket, show };
};

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export const load: import('./$types').PageServerLoad = async ({
  params,
  cookies,
  url,
}) => {
  const ticketId = params.id;
  const pinHash = cookies.get('pin');
  const redirectUrl = urlJoin(url.href, PUBLIC_PIN_PATH);

  if (!pinHash) {
    throw redirect(303, redirectUrl);
  }
  if (ticketId === null) {
    throw error(404, 'Bad ticket id');
  }

  const { token, ticket: _ticket, show: _show } = await getTicket(ticketId);

  if (!verifyPin(ticketId, _ticket.ticketState.reservation.pin, pinHash)) {
    throw redirect(303, redirectUrl);
  }

  const ticket = _ticket.toJSON() as TicketDocType;
  const show = _show.toJSON();

  return {
    token,
    ticket,
    show,
  };
};

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export const actions: import('./$types').Actions = {
  buy_ticket: async ({ params }) => {
    const ticketId = params.id;
    if (ticketId === null) {
      throw error(404, 'Key not found');
    }

    const { ticket, show } = await getTicket(ticketId);
    const ticketService = createTicketMachineService(ticket, show, {
      saveState: true,
      observeState: true,
    });
    ticket
      .createTransaction({
        //TODO: add transaction data
        hash: '0xeba2df809e7a612a0a0d444ccfa5c839624bdc00dd29e3340d46df3870f8a30e',
        from: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
        to: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
        value: ticket.ticketState.price.toString(),
        block: 123,
        reason: TransactionReasonType.TICKET_PAYMENT,
      })
      .then(transaction => {
        ticketService.send({ type: 'PAYMENT RECEIVED', transaction });
      });

    return { success: true, ticketBought: true };
  },
  cancel_ticket: async ({ params }) => {
    const ticketId = params.id;
    if (ticketId === null) {
      throw error(404, 'Key not found');
    }

    const { ticket, show } = await getTicket(ticketId);

    const ticketService = createTicketMachineService(ticket, show, {
      saveState: true,
      observeState: true,
    });

    const state = ticketService.getSnapshot();
    if (state.can({ type: 'REQUEST CANCELLATION', cancel: undefined })) {
      //TODO: make real transaction

      ticketService.send({
        type: 'REQUEST CANCELLATION',
        cancel: {
          createdAt: new Date().getTime(),
          canceller: ActorType.CUSTOMER,
          cancelledInState: JSON.stringify(state.value),
          reason: TicketCancelReason.CUSTOMER_CANCELLED,
        },
      });

      if (ticket.ticketState.totalPaid > ticket.ticketState.refundedAmount) {
        ticket
          .createTransaction({
            hash: '0xeba2df809e7a612a0a0d444ccfa5c839624bdc00dd29e3340d46df3870f8a30e',
            from: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
            to: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
            value: (
              ticket.ticketState.totalPaid - ticket.ticketState.refundedAmount
            ).toString(),
            block: 123,
            reason: TransactionReasonType.TICKET_REFUND,
          })
          .then(transaction => {
            ticketService.send({
              type: 'REFUND RECEIVED',
              transaction,
            });
          });
      }
    }
    return { success: true, ticketCancelled: true };
  },
  leave_feedback: async ({ params, request }) => {
    const ticketId = params.id;
    if (ticketId === null) {
      throw error(404, 'Key not found');
    }

    const data = await request.formData();
    const rating = data.get('rating') as string;
    const review = data.get('review') as string;

    if (!rating || rating === '0') {
      return fail(400, { rating, missingRating: true });
    }

    const { ticket, show } = await getTicket(ticketId);

    const ticketService = createTicketMachineService(ticket, show, {
      saveState: true,
      observeState: true,
    });

    const state = ticketService.getSnapshot();
    const feedback = {
      rating: +rating,
      review,
      createdAt: new Date().getTime(),
    } as TicketDocument['ticketState']['feedback'];

    if (state.can({ type: 'FEEDBACK RECEIVED', feedback })) {
      ticketService.send({
        type: 'FEEDBACK RECEIVED',
        feedback,
      });
    }

    return { success: true, rating, review };
  },
  initiate_dispute: async ({ params, request }) => {
    const ticketId = params.id;
    if (ticketId === null) {
      throw error(404, 'Key not found');
    }

    const data = await request.formData();
    const reason = data.get('reason') as string;
    const explanation = data.get('explanation') as string;

    if (!explanation || explanation === '') {
      return fail(400, { explanation, missingExplanation: true });
    }

    if (!reason) {
      return fail(400, { reason, missingReason: true });
    }

    const { ticket, show } = await getTicket(ticketId);

    const ticketService = createTicketMachineService(ticket, show, {
      saveState: true,
      observeState: true,
    });

    const state = ticketService.getSnapshot();
    const dispute = {
      disputer: ActorType.CUSTOMER,
      reason: reason as TicketDisputeReason,
      explanation,
      startedAt: new Date().getTime(),
    } as TicketDocument['ticketState']['dispute'];

    if (state.can({ type: 'DISPUTE INITIATED', dispute })) {
      ticketService.send({
        type: 'DISPUTE INITIATED',
        dispute,
      });
    }

    return { success: true, reason, explanation };
  },
};