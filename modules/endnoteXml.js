import Emitter from '../shared/emitter.js';
import XMLParser from '@iebh/cacx';

/**
* Read an EndnoteXML file, returning an Emitter analogue
*
* @see modules/inhterface.js
* @param {Stream} stream Stream primative to encapsulate
* @returns {Object} An Emitter analogue defined in `../shared/Emitter.js`
*/
export function readStream(stream) {
	let emitter = Emitter();

	/**
	* The current reference being appended to
	* @type {Object}
	*/
	let ref = {};


	// Setup the XML parser
	let parserOptions = {
		flattenText: false,
		flattenChildren: false,
		flattenAttrs: false,
		onTagClose(node, stack) {
			if (node.tag == 'title' && node.text) {
				ref.title = node.text;
			} else if (node.tag == 'author' && node.text) {
				if (!ref.authors) ref.authors = [];
				ref.authors.push(node.text);
			} else if (node.tag == 'keyword' && node.text) {
				if (!ref.keywords) ref.keywords = [];
				ref.keywords.push(node.text);
			} else if (node.tag == 'url' && node.text) {
				if (!ref.urls) ref.urls = [];
				ref.urls.push(node.text);
			} else if (
				!['authors', 'keywords', 'urls'].includes(node.tag) // Not one of the above collectors
				&& translations.fields.rawMap.has(node.tag) // AND other supported field mapping
				&& node.text // AND there is some content to populate
			) {
				ref[translations.fields.rawMap.get(node.tag).rl] = node.text;
			} else if (node.tag == 'ref-type') { // Special EndnoteXML reference lookup
				let rlType = translations.types.rawMap.get(node.attrs.name);
				ref.type = rlType?.rl || 'journalArticle'; // It should never happen that we have an unknown type but default to something sane if we ever see one
			} else if (node.tag == 'secondary-title' && node.text) { // Zotero "Journal" field translation
				let rlType = translations.types.rawMap.get(node.text);
				ref.type = rlType?.rl || 'journalArticle'; // It should never happen that we have an unknown type but default to something sane if we ever see one
			} else if (node.tag == 'style' && node.text) { // Embedded <style> tag Endnote seems to wrap all inner values with these even though they dont serve any purpose
				// Re-call onTagClose() using the parent node instead
				let outerNode = { // Create shallow copy of 'real' parent node
					...stack.at(-2),
					text: node.text, // ... but copy in this nodes text as if this inner `<style>` wrapper didn't exist
				};
				if (!outerNode) throw new Error('<style> tag with orphaned children!');
				parserOptions.onTagClose(outerNode, stack.slice(0, -1));
			} else if (node.tag == 'record') { // End of record - emit the ref and clear tracking state
				emitter.emit('ref', ref);
				ref = {};
			}
		},
	};
	let parser = new XMLParser(parserOptions);


	// Queue up the parser in the next tick (so we can return the emitter first)
	setTimeout(() => {
		if (typeof stream.pipe === 'function') {
			stream.on('data', data => {
				parser.append(data.toString()) // Push new data onto XML decode stack (converting from Buffer -> String)
				emitter.emit('progress', stream.bytesRead);
			})
			stream.on('end', ()=> {
				parser.exec();
				emitter.emit('end');
			});
			stream.on('error', e => emitter.emit('error', e))
			return;
		} else {
			console.error('Error with stream, check "streamEmitter.js" if on browser')
		}
	});

	return emitter;
}


/**
* Write references to a file
*
* @see modules/interface.js
*
* @param {Stream} stream Writable stream to output to
* @param {Object} [options] Additional options to use when parsing
* @param {string} [options.defaultType='journalArticle'] Default citation type to assume when no other type is specified
* @param {string} [options.filePath="c:\\"] "Fake" internal source file path the citation library was exported from, must end with backslashes
* @param {string} [options.fileName="Endnote.enl"] "Fake" internal source file name the citation library was exported from
* @param {function} [options.formatDate] Date formatter to translate between a JS Date object and the Endnote YYYY-MM-DD format
*
* @returns {Object} A writable stream analogue defined in `modules/interface.js`
*/
export function writeStream(stream, options) {
	let settings = {
		defaultType: 'journalArticle',
		filePath: 'c:\\',
		fileName: 'Endnote.enl',
		formatDate: value => value instanceof Date ? value.toISOString().slice(0, 10) : value,
		...options,
	};

	// Cached values so we don't need to keep recomputing
	let encodedName = xmlEscape(settings.fileName);
	let refsSeen = 0;

	return {
		start: ()=> {
			stream.write('<?xml version="1.0" encoding="UTF-8" ?><xml><records>');
			return Promise.resolve();
		},
		write: ref => {
			let refType = translations.types.rlMap.get(ref.type || settings.defaultType);
			if (!refType) {
				console.warn(`Invalid reference type: "${ref.type}", defaulting to journal article`);
				refType = translations.types.rlMap.get('journalArticle')
			}

			refsSeen++;
			let recNumber = ref.recNumber || refsSeen;

			stream.write(
				'<record>'
					// Preamble
					+ `<database name="${settings.fileName}" path="${settings.filePath}${settings.fileName}">${encodedName}</database>`
					+ `<source-app name="EndNote" version="16.0">EndNote</source-app>`
					+ `<rec-number>${recNumber}</rec-number>`
					+ `<foreign-keys><key app="EN" db-id="s55prpsswfsepue0xz25pxai2p909xtzszzv">${recNumber}</key></foreign-keys>`

					// Type
					+ `<ref-type name="${refType.rawText}">${refType.rawId}</ref-type>`

					// Authors
					+ '<contributors><authors>'
						+ (ref.authors || []).map(author => `<author><style face="normal" font="default" size="100%">${xmlEscape(author)}</style></author>`)
					+ '</authors></contributors>'

					// Titles
					+ '<titles>'
						+ (ref.title ? `<title><style face="normal" font="default" size="100%">${xmlEscape(ref.title)}</style></title>` : '')
						+ (ref.journal ? `<secondary-title><style face="normal" font="default" size="100%">${xmlEscape(ref.journal)}</style></secondary-title>` : '')
						+ (ref.titleShort ? `<short-title><style face="normal" font="default" size="100%">${xmlEscape(ref.titleShort)}</style></short-title>` : '')
						+ (ref.journalAlt ? `<alt-title><style face="normal" font="default" size="100%">${xmlEscape(ref.journalAlt)}</style></alt-title>` : '')
					+ '</titles>'

					// Periodical
					+ (ref.periodical ? `<periodical><full-title><style face="normal" font="default" size="100%">${xmlEscape(ref.periodical)}</style></full-title></periodical>` : '')

					// Simple field key/vals
					+ [
						['abstract', 'abstract'],
						['accessDate', 'access-date'],
						['accession', 'accession-num'],
						['address', 'auth-address'],
						['caption', 'caption'],
						['databaseProvider', 'remote-database-provider'],
						['database', 'remote-database-name'],
						['doi', 'electronic-resource-num'],
						['isbn', 'isbn'],
						['accessionNum', 'accession-num'],
						['label', 'label'],
						['language', 'language'],
						['notes', 'notes'],
						['number', 'number'],
						['pages', 'pages'],
						['researchNotes', 'research-notes'],
						['section', 'section'],
						['volume', 'volume'],
						['workType', 'work-type'],
						['custom1', 'custom1'],
						['custom2', 'custom2'],
						['custom3', 'custom3'],
						['custom4', 'custom4'],
						['custom5', 'custom5'],
						['custom6', 'custom6'],
						['custom7', 'custom7'],
					]
						.filter(([rlKey]) => ref[rlKey]) // Remove empty fields
						.map(([rlKey, rawKey]) =>
							`<${rawKey}><style face="normal" font="default" size="100%">${xmlEscape(ref[rlKey])}</style></${rawKey}>`
						)
						.join('')

					// Dates
					+ (
						ref.date && ref.year && ref.date instanceof Date ?
							`<dates><year><style face="normal" font="default" size="100%">${xmlEscape(ref.year)}</style></year>`
							+ `<pub-dates><date><style face="normal" font="default" size="100%">${settings.formatDate(ref.date)}</style></date></pub-dates></dates>`
						: ref.date && ref.year ?
							`<dates><year><style face="normal" font="default" size="100%">${xmlEscape(ref.year)}</style></year>`
							+ `<pub-dates><date><style face="normal" font="default" size="100%">${ref.date}</style></date></pub-dates></dates>`
						: ref.date ?
							`<dates><pub-dates><date><style face="normal" font="default" size="100%">${xmlEscape(ref.date)}</style></date></pub-dates></dates>`
						: ref.year ?
							`<dates><year><style face="normal" font="default" size="100%">${xmlEscape(ref.year)}</style></year></dates>`
						: ''
					)

					// Urls
					+ (ref.urls ?
						'<urls><related-urls>'
						+ [].concat(ref.urls || [])
							.map(url => `<url><style face="normal" font="default" size="100%">${xmlEscape(url)}</style></url>`)
							.join('')
						+ '</related-urls></urls>'
					: '')

					// Keywords
					+ (ref.keywords ?
						'<keywords>'
						+ [].concat(ref.keywords || [])
							.map(keyword => `<keyword><style face="normal" font="default" size="100%">${xmlEscape(keyword)}</style></keyword>`)
							.join('')
						+ '</keywords>'
					: '')

				+ '</record>'
			);
			return Promise.resolve();
		},
		end: ()=> {
			stream.write('</records></xml>');
			return new Promise((resolve, reject) =>
				stream.end(err => err ? reject(err) : resolve())
			);
		},
	};
}


/**
* Utility function to take the raw XML output object and translate it into a Reflib object
* @param {Object} xRef Raw XML object to process
* @returns {Object} The translated Reflib object output
*/
export function translateRawToRef(xRef) {
	let recOut = {
		...Object.fromEntries(
			translations.fields.collection
				.filter(field => xRef[field.raw]) // Only include fields we have a value for
				.map(field => [ // Translate Raw -> Reflib spec
					field.rl,
					Array.isArray(xRef[field.raw]) ? xRef[field.raw].map(xmlUnescape)
					: xmlUnescape(xRef[field.raw])
				])
		),
		type: translations.types.rawMap.get(+xRef.refType || 17)?.rl,
	};

	return recOut;
}


/**
* Default string -> XML encoder
* @param {string} str The input string to encode
* @returns {string} The XML "safe" string
*/
export function xmlEscape(str) {
	return ('' + str)
		.replace(/&/g, '&amp;')
		.replace(/\r/g, '&#13;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}


/**
* Default XML -> string decodeer
* @param {string} str The input string to decode
* @returns {string} The actual string
*/
export function xmlUnescape(str) {
	return ('' + str)
		.replace(/&amp;/g, '&')
		.replace(/&#(xD|13);/g, '\r')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/\s+$/gm, '') // Trim line-end whitespace
}


/**
* Lookup tables for this module
* @type {Object}
* @property {array<Object>} fields Field translations between Reflib (`rl`) and the raw format (`raw`)
* @property {array<Object>} types Field translations between Reflib (`rl`) and the raw format types as raw text (`rawText`) and numeric ID (`rawId`)
*/
export let translations = {
	// Field translations {{{
	fields: {
		collection: [
			// Field translations in priority order (Endnote first then Zotero)
			{rl: 'recNumber', raw: 'rec-number'},
			{rl: 'title', raw: 'title'},
			{rl: 'journal', raw: 'secondary-title'},
			{rl: 'address', raw: 'auth-address'},
			{rl: 'researchNotes', raw: 'research-notes'},
			{rl: 'authors', raw: 'authors'},
			{rl: 'pages', raw: 'pages'},
			{rl: 'volume', raw: 'volume'},
			{rl: 'number', raw: 'number'},
			{rl: 'isbn', raw: 'isbn'},
			{rl: 'accessionNum', raw: 'accession-num'},
			{rl: 'abstract', raw: 'abstract'},
			{rl: 'label', raw: 'label'},
			{rl: 'caption', raw: 'caption'},
			{rl: 'notes', raw: 'notes'},
			{rl: 'custom1', raw: 'custom1'},
			{rl: 'custom2', raw: 'custom2'},
			{rl: 'custom3', raw: 'custom3'},
			{rl: 'custom4', raw: 'custom4'},
			{rl: 'custom5', raw: 'custom5'},
			{rl: 'custom6', raw: 'custom6'},
			{rl: 'custom7', raw: 'custom7'},
			{rl: 'doi', raw: 'electronic-resource-num'},
			{rl: 'year', raw: 'year'},
			{rl: 'date', raw: 'date'},
			{rl: 'language', raw: 'language'},
		],
		rawMap: new Map(), // Calculated later for quicker lookup
	},
	// }}}
	// Ref type translations {{{
	types: {
		collection: [
			{rl: 'aggregatedDatabase', rawText: 'Aggregated Database', rawId: 55},
			{rl: 'ancientText', rawText: 'Ancient Text', rawId: 51},
			{rl: 'artwork', rawText: 'Artwork', rawId: 2},
			{rl: 'audioVisualMaterial', rawText: 'Audiovisual Material', rawId: 3},
			{rl: 'bill', rawText: 'Bill', rawId: 4},
			{rl: 'blog', rawText: 'Blog', rawId: 56},
			{rl: 'book', rawText: 'Book', rawId: 6},
			{rl: 'bookSection', rawText: 'Book Section', rawId: 5},
			{rl: 'case', rawText: 'Case', rawId: 7},
			{rl: 'catalog', rawText: 'Catalog', rawId: 8},
			{rl: 'chartOrTable', rawText: 'Chart or Table', rawId: 38},
			{rl: 'classicalWork', rawText: 'Classical Work', rawId: 49},
			{rl: 'computerProgram', rawText: 'Computer Program', rawId: 9},
			{rl: 'conferencePaper', rawText: 'Conference Paper', rawId: 47},
			{rl: 'conferenceProceedings', rawText: 'Conference Proceedings', rawId: 10},
			{rl: 'dataset', rawText: 'Dataset', rawId: 59},
			{rl: 'dictionary', rawText: 'Dictionary', rawId: 52},
			{rl: 'editedBook', rawText: 'Edited Book', rawId: 28},
			{rl: 'electronicArticle', rawText: 'Electronic Article', rawId: 43},
			{rl: 'electronicBook', rawText: 'Electronic Book', rawId: 44},
			{rl: 'electronicBookSection', rawText: 'Electronic Book Section', rawId: 60},
			{rl: 'encyclopedia', rawText: 'Encyclopedia', rawId: 53},
			{rl: 'equation', rawText: 'Equation', rawId: 39},
			{rl: 'figure', rawText: 'Figure', rawId: 37},
			{rl: 'filmOrBroadcast', rawText: 'Film or Broadcast', rawId: 21},
			{rl: 'generic', rawText: 'Generic', rawId: 13},
			{rl: 'governmentDocument', rawText: 'Government Document', rawId: 46},
			{rl: 'grant', rawText: 'Grant', rawId: 54},
			{rl: 'hearing', rawText: 'Hearing', rawId: 14},
			{rl: 'journalArticle', rawText: 'Journal Article', rawId: 17},
			{rl: 'legalRuleOrRegulation', rawText: 'Legal Rule or Regulation', rawId: 50},
			{rl: 'magazineArticle', rawText: 'Magazine Article', rawId: 19},
			{rl: 'manuscript', rawText: 'Manuscript', rawId: 36},
			{rl: 'map', rawText: 'Map', rawId: 20},
			{rl: 'music', rawText: 'Music', rawId: 61},
			{rl: 'newspaperArticle', rawText: 'Newspaper Article', rawId: 23},
			{rl: 'onlineDatabase', rawText: 'Online Database', rawId: 45},
			{rl: 'onlineMultimedia', rawText: 'Online Multimedia', rawId: 48},
			{rl: 'pamphlet', rawText: 'Pamphlet', rawId: 24},
			{rl: 'patent', rawText: 'Patent', rawId: 25},
			{rl: 'personalCommunication', rawText: 'Personal Communication', rawId: 26},
			{rl: 'report', rawText: 'Report', rawId: 27},
			{rl: 'serial', rawText: 'Serial', rawId: 57},
			{rl: 'standard', rawText: 'Standard', rawId: 58},
			{rl: 'statute', rawText: 'Statute', rawId: 31},
			{rl: 'thesis', rawText: 'Thesis', rawId: 32},
			{rl: 'unpublished', rawText: 'Unpublished Work', rawId: 34},
			{rl: 'web', rawText: 'Web Page', rawId: 12},
		],
		rlMap: new Map(), // Calculated later for quicker lookup
		rawMap: new Map(), // Calculated later for quicker lookup
	},
	// }}}
};


/**
* @see modules/interface.js
*/
export function setup() {
	// Create lookup object of translations.field translations
	translations.fields.collection.forEach(c => {
		translations.fields.rawMap.set(c.raw, c);
	});

	// Create lookup object of translations.types with key as .rl / val as the full object
	translations.types.collection.forEach(c => {
		translations.types.rlMap.set(c.rl, c);
		translations.types.rawMap.set(c.rawId, c);
	});
}
