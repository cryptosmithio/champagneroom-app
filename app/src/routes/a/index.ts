import { getDb } from 'db';
import { TalentDocument, TalentSchema } from 'db/models/talent';

export const post = async ({ request }) => {
	try {
		const db = getDb();
		const form = await request.formData();
		const agentId = form.get('agentId');
		const name = form.get('name');
		const talentKey = form.get('talentKey');
		const agentCommission = form.get('agentCommission');
		if (typeof agentId !== 'string' || typeof name !== 'string' || typeof talentKey !== 'string') {
			return {
				status: 400,
				body: {
					success: false,
					error: 'Bad parameters.'
				}
			};
		} //TODO: Change these all to zod parse
		const talentDocument = new TalentDocument(agentId, name, talentKey);
		talentDocument.agentCommission = Number.parseInt(agentCommission);
		TalentSchema.parse(talentDocument);
		db.put(talentDocument);
		return {
			status: 200,
			body: {
				success: true,
				talentDocument
			}
		};
	} catch (error) {
		console.log(error);
		return {
			status: 400,
			body: {
				success: false,
				error: error
			}
		};
	}
};