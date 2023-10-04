import { Queue } from 'bullmq';
import type IORedis from 'ioredis';

import { EntityType } from '$lib/constants';
import { InvoiceJobType } from '$lib/util/payment';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const invoiceId = body['id'] as string;
  const status = body['status'] as string;
  const redisConnection = locals.redisConnection as IORedis;

  if (!invoiceId || !status) {
    return new Response(undefined, { status: 400 });
  }

  const invoiceQueue = new Queue(EntityType.INVOICE, {
    connection: redisConnection
  });

  invoiceQueue.add(InvoiceJobType.UPDATE, { invoiceId });

  return new Response(undefined, { status: 200 });
};