import { CREATORS_ENDPOINT, RXDB_PASSWORD } from '$lib/constants';
import {
	agentDocMethods,
	agentSchema,
	agentStaticMethods,
	type AgentCollection,
	type AgentDocument
} from '$lib/db/models/agent';
import { talentSchema, type TalentCollection } from '$lib/db/models/talent';
import { initRXDB } from '$lib/db/rxdb';
import { createRxDatabase, removeRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStoragePouch, PouchDB } from 'rxdb/plugins/pouchdb';
import { writable } from 'svelte/store';

type CreatorsCollections = {
	agents: AgentCollection;
	talents: TalentCollection;
};

export type AgentDB = RxDatabase<CreatorsCollections>;
let _agentDB: AgentDB;

export const agentDB = async (token: string, agentId: string) =>
	_agentDB ? _agentDB : await _create(token, agentId);

let _currentAgent: AgentDocument | null;

const _create = async (token: string, agentId: string) => {
	initRXDB();
	await removeRxDatabase('agentdb', getRxStoragePouch('idb'));

	const _db: AgentDB = await createRxDatabase({
		name: 'agentdb',
		storage: getRxStoragePouch('idb'),
		ignoreDuplicate: true,
		password: RXDB_PASSWORD
	});

	await _db.addCollections({
		agents: {
			schema: agentSchema,
			methods: agentDocMethods,
			statics: agentStaticMethods
		},
		talents: {
			schema: talentSchema
		}
	});
	const remoteDB = new PouchDB(CREATORS_ENDPOINT, {
		fetch: function (
			url: string,
			opts: { headers: { set: (arg0: string, arg1: string) => void } }
		) {
			opts.headers.set('Authorization', 'Bearer ' + token);
			return PouchDB.fetch(url, opts);
		}
	});
	const query = _db.agents.findOne(agentId);

	let repState = _db.agents.syncCouchDB({
		remote: remoteDB,
		waitForLeadership: false,
		options: {
			retry: true
		},
		query
	});
	await repState.awaitInitialReplication();

	repState = _db.talents.syncCouchDB({
		remote: remoteDB,
		waitForLeadership: false,
		options: {
			retry: true
		},
		query: _db.talents.find().where('agent').eq(agentId)
	});
	await repState.awaitInitialReplication();

	_currentAgent = await query.exec();
	if (_currentAgent) currentAgent.set(_currentAgent);

	_db.agents.syncCouchDB({
		remote: remoteDB,
		waitForLeadership: true,
		options: {
			retry: true,
			live: true
		},
		query
	});
	_db.talents.syncCouchDB({
		remote: remoteDB,
		waitForLeadership: true,
		options: {
			retry: true,
			live: true
		},
		query: _db.talents.find().where('agent').eq(agentId)
	});

	_agentDB = _db;
	currentAgentDB.set(_db);
	return _agentDB;
};

export const currentAgent = writable<AgentDocument>();
export const currentAgentDB = writable<RxDatabase<CreatorsCollections>>();
