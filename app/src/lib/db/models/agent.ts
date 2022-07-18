import {
	toTypedRxJsonSchema,
	type ExtractDocumentTypeFromTypedRxJsonSchema,
	type RxCollection,
	type RxDocument,
	type RxJsonSchema
} from 'rxdb';
import * as yup from 'yup';
import { createModelBase, type ModelBase } from './modelBase';

export const AgentSchema = yup.object({
	address: yup.string().required().min(40),
	walletAddress: yup.string().optional(),
	talents: yup.array().optional()
});

export type AgentBase = yup.InferType<typeof AgentSchema>;
export type Agent = AgentBase & ModelBase;
export const AgentType = 'agent';

export const AgentById = AgentType + 'ById';
export const AgentByAddress = AgentType + 'ByAddress';

export const createAgent = (_agent: AgentBase) => {
	const base = createModelBase(AgentType);
	const agent = {
		...base,
		..._agent,
		_id: AgentType + ':' + _agent.address
	};
	return agent;
};

const agentSchemaLiteral = {
	title: 'agent',
	description: 'manages talent',
	version: 0,
	type: 'object',
	primaryKey: {
		key: '_id',
		fields: ['entityType', 'address'],
		separator: ':'
	},
	properties: {
		_id: {
			type: 'string',
			maxLength: 100
		},
		entityType: {
			type: 'string',
			default: 'agent',
			maxLength: 50
		},
		address: {
			type: 'string',
			maxLength: 50,
			unique: true
		},
		createdAt: { type: 'string' },
		talents: {
			type: 'array',
			ref: 'talent',
			items: {
				type: 'string',
				maxLength: 100
			}
		}
	},
	required: ['_id', 'address', 'entityType'],
	indexes: [['address', 'entityType']],
	encrypted: ['talents']
} as const;

type agentRef = {
	talents_?: Promise<AgentDocument[]>;
};

const schemaTyped = toTypedRxJsonSchema(agentSchemaLiteral);
export type AgentDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
export const agentSchema: RxJsonSchema<AgentDocType> = agentSchemaLiteral;

export type AgentDocument = RxDocument<AgentDocType> & agentRef;

export type AgentCollection = RxCollection<AgentDocType>;
