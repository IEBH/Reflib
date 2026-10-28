/**
* Field definitions for Reflib citations
* @type {Object} An object lookup where each key represents a field within a citation
* @property {string} type A TypeScript compatible type for that field
* @property {array<string>} [value] Possible values if the type is restricted
*/
export let fields = {
	recNumber: {
		type: 'string',
	},
	type: {
		type: 'string',
		values: [
			'aggregatedDatabase',
			'ancientText',
			'artwork',
			'audioVisualMaterial',
			'bill',
			'blog',
			'book',
			'bookSection',
			'case',
			'catalog',
			'chartOrTable',
			'classicalWork',
			'computerProgram',
			'conferencePaper',
			'conferenceProceedings',
			'dataset',
			'dictionary',
			'editedBook',
			'electronicArticle',
			'electronicBook',
			'electronicBookSection',
			'encyclopedia',
			'equation',
			'figure',
			'filmOrBroadcast',
			'generic',
			'governmentDocument',
			'grant',
			'hearing',
			'journalArticle',
			'legalRuleOrRegulation',
			'magazineArticle',
			'manuscript',
			'map',
			'music',
			'newspaperArticle',
			'onlineDatabase',
			'onlineMultimedia',
			'pamphlet',
			'patent',
			'personalCommunication',
			'report',
			'serial',
			'standard',
			'statute',
			'thesis',
			'unknown',
			'unpublished',
			'web',
		],
	},
	title: {
		type: 'string',
	},
	journal: {
		type: 'string',
	},
	authors: {
		type: 'array<string>',
	},
	date: {
		type: 'string',
	},
	urls: {
		type: 'array<string>',
	},
	pages: {
		type: 'string',
	},
	volume: {
		type: 'string',
	},
	number: {
		type: 'string',
	},
	isbn: {
		type: 'string',
	},
	abstract: {
		type: 'string',
	},
	label: {
		type: 'string',
	},
	caption: {
		type: 'string',
	},
	notes: {
		type: 'string',
	},
	address: {
		type: 'string',
	},
	researchNotes: {
		type: 'string',
	},
	keywords: {
		type: 'array<string>',
	},
	accessDate: {
		type: 'string',
	},
	accession: {
		type: 'string',
	},
	doi: {
		type: 'string',
	},
	section: {
		type: 'string',
	},
	language: {
		type: 'string',
	},
	databaseProvider: {
		type: 'string',
	},
	database: {
		type: 'string',
	},
	workType: {
		type: 'string',
	},
	custom1: {
		type: 'string',
	},
	custom2: {
		type: 'string',
	},
	custom3: {
		type: 'string',
	},
	custom4: {
		type: 'string',
	},
	custom5: {
		type: 'string',
	},
	custom6: {
		type: 'string',
	},
	custom7: {
		type: 'string',
	},
};
