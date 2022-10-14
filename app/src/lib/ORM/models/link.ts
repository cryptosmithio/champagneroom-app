import type { AgentDocument } from '$lib/ORM/models/agent';
import type { FeedbackDocument } from '$lib/ORM/models/feedback';
import type { TalentDocument } from '$lib/ORM/models/talent';
import {
	toTypedRxJsonSchema,
	type ExtractDocumentTypeFromTypedRxJsonSchema,
	type RxCollection,
	type RxDocument,
	type RxJsonSchema
} from 'rxdb';
import type { TransactionDocument } from './transaction';

export enum LinkStatuses {
	UNCLAIMED,
	CLAIMED,
	CANCELED,
	FINALIZED,
	IN_ESCROW,
	IN_DISPUTE,
	IN_CALL
}

export enum ConnectionType {
	ATTEMPT,
	CONNECT,
	DISCONNECTED,
	NO_ANSWER,
	CALLER_HANGUP,
	CALLEE_HANGUP
}

export enum ActorType {
	AGENT,
	TALENT,
	CALLER
}

export enum DisputeDecision {
	TALENT_WON,
	CALLER_WON,
	SPLIT
}

export const LinkString = 'link';
const linkSchemaLiteral = {
	title: 'link',
	description: 'onetime link to call',
	version: 0,
	type: 'object',
	primaryKey: '_id',
	properties: {
		_id: {
			type: 'string',
			maxLength: 50
		},
		entityType: {
			type: 'string',
			default: 'link',
			maxLength: 20,
			final: true
		},
		fundingAddress: {
			type: 'string',
			maxLength: 50
		},
		requestedAmount: {
			type: 'integer',
			default: 0,
			minimum: 0,
			maximum: 99999
		},
		callId: { type: 'string' },
		state: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: Object.values(LinkStatuses),
					default: LinkStatuses.UNCLAIMED
				},
				totalFunding: {
					type: 'integer',
					default: 0,
					minimum: 0,
					maximum: 99999
				},
				minFunding: {
					type: 'integer',
					default: 0,
					minimum: 0,
					maximum: 99999
				},
				cancel: {
					type: 'object',
					properties: {
						createdAt: { type: 'integer' },
						canceler: {
							type: 'string',
							enum: Object.values(ActorType)
						},
						refundedAmount: { type: 'integer' },
						canceledInState: { type: 'string' },
						transactions: {
							type: 'array',
							ref: 'transactions',
							items: { type: 'string' }
						}
					},
					required: ['createdAt', 'canceler', 'canceledInState', 'transactions']
				},
				claim: {
					type: 'object',
					properties: {
						caller: { type: 'string' },
						pin: { type: 'string', maxLength: 8 },
						createdAt: { type: 'integer' },
						transactions: {
							type: 'array',
							ref: 'transactions',
							items: { type: 'string' }
						}
					},
					required: ['caller', 'pin', 'createdAt', 'transactions'],
					encrypted: ['pin']
				},
				escrow: {
					type: 'object',
					properties: {
						startedAt: { type: 'integer' },
						endedAt: { type: 'integer' }
					},
					required: ['startedAt']
				},
				dispute: {
					type: 'object',
					properties: {
						startedAt: { type: 'integer' },
						endedAt: { type: 'integer' },
						disputer: {
							type: 'string',
							enum: Object.values(ActorType)
						},
						outcome: {
							type: 'object',
							properties: {
								decision: {
									type: 'string',
									enum: Object.values(DisputeDecision)
								},
								transactions: {
									type: 'array',
									ref: 'transactions',
									items: { type: 'string' }
								}
							},
							required: ['decision', 'transactions']
						}
					},
					required: ['startedAt', 'disputer']
				},
				finalized: {
					type: 'object',
					properties: {
						endedAt: { type: 'integer' },
						transactions: {
							type: 'array',
							ref: 'transactions',
							items: { type: 'string' }
						}
					},
					required: ['endedAt']
				},
				connections: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								enum: Object.values(ConnectionType)
							},
							createdAt: { type: 'integer' },
							endedAt: { type: 'integer' },
							caller: { type: 'string' }
						},
						required: ['type', 'createdAt', 'caller']
					}
				}
			},
			required: ['status', 'connections', 'totalFunding', 'minFunding']
		},
		talentInfo: {
			type: 'object',
			properties: {
				profileImageUrl: {
					type: 'string'
				},
				name: {
					type: 'string',
					maxLength: 50
				},
				stats: {
					type: 'object',
					properties: {
						numCompletedCalls: {
							type: 'integer',
							minimum: 0
						},
						ratingAvg: {
							type: 'number',
							minimum: 0,
							maximum: 5
						}
					},
					required: ['numCompletedCalls', 'ratingAvg']
				}
			},
			required: ['profileImageUrl', 'name', 'stats']
		},
		talent: { type: 'string', ref: 'talents', maxLength: 50 },
		agent: { type: 'string', ref: 'agents', maxLength: 70 },
		feedback: { type: 'string', ref: 'feedbacks', maxLength: 50 },
		createdAt: {
			type: 'integer'
		},
		updatedAt: {
			type: 'integer'
		},
		_deleted: {
			type: 'boolean',
			default: false
		}
	},
	required: [
		'_id',
		'state',
		'entityType',
		'talent',
		'agent',
		'talentInfo',
		'callId',
		'requestedAmount',
		'fundingAddress',
		'feedback',
		'createdAt'
	],
	indexes: ['talent', 'feedback', 'agent', 'state.status', 'state.finalized.endedAt'],
	encrypted: ['callId']
} as const;

type linkRef = {
	talent_: Promise<TalentDocument>;
	agent_: Promise<AgentDocument>;
	feedback_: Promise<FeedbackDocument>;
	transactions_: Promise<TransactionDocument[]>;
};

const schemaTyped = toTypedRxJsonSchema(linkSchemaLiteral);
export type LinkDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const linkSchema: RxJsonSchema<LinkDocType> = linkSchemaLiteral;
export type LinkDocument = RxDocument<LinkDocType> & linkRef;
export type LinkCollection = RxCollection<LinkDocType>;
