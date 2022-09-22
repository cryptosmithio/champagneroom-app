import { talentDB } from '$lib/ORM/dbs/talentDB';
import type { LinkDocument } from '$lib/ORM/models/link';
import { StorageTypes } from '$lib/ORM/rxdb';
import { JWT_CREATOR_USER, JWT_EXPIRY, JWT_SECRET } from '$lib/util/constants';
import { error } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
	const key = params.key;
	let token = '';
	let talent = {};
	let currentLink = {};
	let completedCalls = {};
	if (JWT_SECRET) {
		token = jwt.sign(
			{
				exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
				sub: JWT_CREATOR_USER
			},
			JWT_SECRET
		);
	}

	//Try to preload
	if (key === null) {
		throw error(404, 'Key not found');
	}
	const db = await talentDB(token, key, StorageTypes.NODE_WEBSQL);
	if (db) {
		const _talent = await db.talents.findOne().where('key').equals(key).exec();
		if (_talent) {
			const _currentLink = (await _talent.populate('currentLink')) as LinkDocument;
			const _completedCalls = (await _talent.populate('stats.completedCalls')) as LinkDocument[];
			talent = _talent.toJSON();
			currentLink = _currentLink ? _currentLink.toJSON() : {};
			completedCalls = _completedCalls.map((link) => link.toJSON());
		}
		else {
			throw error(404, 'Talent not found');
		}
	} else {
		throw error(500, 'no db');
	}
	return {
		token,
		talent,
		currentLink,
		completedCalls
	};
};
