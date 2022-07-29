import { CREATORS_ENDPOINT, RXDB_PASSWORD } from '$lib/constants';
import { initRXDB } from '$lib/ORM/rxdb';
import { linkDocMethods, linkSchema, type LinkCollection } from '$lib/ORM/models/link';
import {
	talentDocMethods,
	talentSchema,
	type TalentCollection,
	type TalentDocument
} from '$lib/ORM/models/talent';
import { createRxDatabase, removeRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStoragePouch, PouchDB } from 'rxdb/plugins/pouchdb';
import { writable } from 'svelte/store';
import type { StorageTypes } from '$lib/ORM/rxdb';

type CreatorsCollections = {
	talents: TalentCollection;
	links: LinkCollection;
};

export type TalentDBType = RxDatabase<CreatorsCollections>;
let _talentDB: TalentDBType;

export const talentDB = async (token: string, key: string, storage: StorageTypes) =>
	_talentDB ? _talentDB : await create(token, key, storage);

let _currentTalent: TalentDocument | null;

const create = async (token: string, key: string, storage: StorageTypes) => {
	initRXDB(storage);
	await removeRxDatabase('talent_db', getRxStoragePouch(storage));

	const _db: TalentDBType = await createRxDatabase({
		name: 'talent_db',
		storage: getRxStoragePouch(storage),
		ignoreDuplicate: true,
		password: RXDB_PASSWORD
	});

	await _db.addCollections({
		talents: {
			schema: talentSchema,
			methods: talentDocMethods
		},
		links: {
			schema: linkSchema,
			methods: linkDocMethods
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
	const query = _db.talents.findOne().where('key').eq(key);

	let repState = _db.talents.syncCouchDB({
		remote: remoteDB,
		waitForLeadership: false,
		options: {
			retry: true
		},
		query
	});
	await repState.awaitInitialReplication();

	_currentTalent = await query.exec();

	if (_currentTalent) {
		repState = _db.links.syncCouchDB({
			remote: remoteDB,
			waitForLeadership: false,
			options: {
				retry: true
			},
			query: _db.links.find().where('talent').eq(_currentTalent._id)
		});
		await repState.awaitInitialReplication();

		_db.talents.syncCouchDB({
			remote: remoteDB,
			waitForLeadership: true,
			options: {
				retry: true,
				live: true
			},
			query
		});

		_db.links.syncCouchDB({
			remote: remoteDB,
			waitForLeadership: true,
			options: {
				retry: true,
				live: true
			},
			query: _db.links.find().where('talent').eq(_currentTalent._id)
		});
	}

	if (_currentTalent) thisTalent.set(_currentTalent);

	_talentDB = _db;
	thisTalentDB.set(_db);
	return _talentDB;
};

export const thisTalent = writable<TalentDocument>();
export const thisTalentDB = writable<RxDatabase<CreatorsCollections>>();
