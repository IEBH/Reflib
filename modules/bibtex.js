import Emitter from '../shared/emitter.js';

/**
* Lookup enum for the current parser mode we are in
*
* @type {Object<Number>}
*/
const MODES = {
	REF: 0,
	FIELDS: 1,
	FIELD_START: 2,
	FIELD_VALUE: 3,
};


/**
* Parse a BibTeX file from a readable stream
*
* @see modules/interface.js
*
* @param {Stream} stream The readable stream to accept data from
* @param {Object} [options] Additional options to use when parsing
* @param {Boolean} [options.recNumberNumeric=true] Only process the BibTeX ID into a recNumber if its a finite numeric, otherwise disguard
* @param {Boolean} [options.recNumberRNPrefix=true] Accept `RN${NUMBER}` as recNumber if present
* @param {Boolean} [options.recNumberKey=true] If the reference key cannot be otherwise parsed store it in `key<String>` instead
* @param {String} [options.fallbackType='unkown'] Reflib fallback type if the incoming type is unrecognised or unsupported
* @param {Set<String>} [options.fieldsOverwrite] Set of field names where the value is clobbered rather than appended if discovered more than once
* @param {Boolean} [options.preserveUnknownKeys=true] Retain keys we do not have a direct lookup for in the output object
*
* @returns {Object} A readable stream analogue defined in `modules/interface.js`
*/
export function readStream(stream, options) {
	let settings = {
		recNumberNumeric: true,
		recNumberRNPrefix: true,
		recNumberKey: true,
		fallbackType: 'unknown',
		fieldsOverwrite: new Set(['type']),
		preserveUnkownKeys: true,
		...options,
	};

	let emitter = Emitter();
	let buffer = '';
	let mode = MODES.REF;
	let state; // Misc state storage when we're digesting ref data
	let ref = {}; // Reference item being constructed

	// Queue up the parser in the next tick (so we can return the emitter first)
	setTimeout(()=> {
		stream
			.on('error', e => emitter.emit('error', e))
			.on('end', ()=> emitter.emit('end'))
			.on('data', chunkBuffer => {
				emitter.emit('progress', stream.bytesRead);
				buffer += chunkBuffer.toString(); // Append incomming data to the partial-buffer we're holding in memory

				while (true) {
					let match; // Regex storage for match groups
					if ((mode == MODES.REF) && (match = /^\s*@(?<type>\w+?)\s*\{(?<id>.*?),/s.exec(buffer))) {
						if (settings.recNumberNumeric && isFinite(match.groups.id)) { // Accept numeric recNumber
							ref.recNumber = +match.groups.id;
						} else if (settings.recNumberRNPrefix && /^RN\d+$/.test(match.groups.id)) {
							ref.recNumber = +match.groups.id.slice(2);
						} else if (!settings.recNumberNumeric && match.groups.id) { // Non numeric / finite ID - but we're allowed to accept it anyway
							ref.recNumber = +match.groups.id;
						} else if (settings.recNumberKey) { // Non numeric, custom looking key, stash in 'key' instead
							ref.key = match.groups.id;
						} // Implied else - No ID, ignore

						ref.type = match.groups.type;
						mode = MODES.FIELDS;
						state = null;
					} else if (mode == MODES.FIELDS && (match = /^\s*(?<field>\w+?)\s*=\s*/s.exec(buffer))) {
						mode = MODES.FIELD_START;
						state = {field: match.groups.field};
					} else if (mode == MODES.FIELDS && (match = /^\s*\}\s*/s.exec(buffer))) { // End of ref
						emitter.emit('ref', tidyRef(ref, settings));
						mode = MODES.REF;
						ref = {};
						state = null;
					} else if (mode == MODES.FIELD_START && (match = /^\s*(?<fieldWrapper>"|{)\s*/.exec(buffer))) {
						mode = MODES.FIELD_VALUE;
						state.fieldWrapper = match.groups.fieldWrapper;
					} else if (
						// TODO: Note that we use `\r?\n` as delimiters for field values, this is a cheat to avoid having to implement a full AST parser
						//       This is a hack but since most BibTeX files use properly formatted BibTeX this should work in the majority of cases
						//       This WILL break if given one continuous line of BibTeX though
						//       - MC 2026-01-02
						mode == MODES.FIELD_VALUE
						&& (
							(
								state.fieldWrapper == '{'
								&& (match = /^(?<value>.*?)(?<!\\%)\}\s*,?\s*$/sm.exec(buffer))
							)
							|| (
								state.fieldWrapper == '"'
								&& (match = /^(?<value>.*?)"\s*,?\s*$/sm.exec(buffer))
							)
						)
					) {
						mode = MODES.FIELDS;
						if (// Already have content - and we should overwrite
							ref[state.field] !== undefined
							&& (
								settings.preserveUnkownKeys
								|| settings.fieldsOverwrite.has(state.field)
							)
						) {
							ref[state.field] = unescape(match.groups.value);
						} else if (ref[state.field] !== undefined) { // Already have content - append
							ref[state.field] += '\n' + unescape(match.groups.value);
						} else { // Populate initial value
							ref[state.field] = unescape(match.groups.value);
						}
						state = null;
					} else { // Implied else - No match to buffer, let it fill and process next data block
						break;
					}

					// Crop start of buffer to last match
					buffer = buffer.slice(match[0].length);
				}
			})
	})

	return emitter;
}


/**
* Tidy up a raw BibTeX reference before emitting
*
* @param {Object} ref The input raw ref to tidy
*
* @param {Object} settings Optimized settings object for fast access
*
* @returns {Object} The tidied ref
*/
export function tidyRef(ref, settings) {
	return Object.fromEntries(
		Object.entries(ref)
			.map(([key, val]) => {
				let rlField = translations.fields.btMap.get(key.toLowerCase());

				if (key == 'type') { // Special conversion for type
					let rlType = ref.type && translations.types.btMap.get(val.toLowerCase());
					return rlType
						? [key, rlType.rl] // Can translate incoming type to Reflib type
						: [key, settings.fallbackType] // Unknown Reflib type varient
				} else if (!settings.preserveUnkownKeys && !rlField) { // Omit unknown fields
					return;
				} else if (rlField && rlField.array) { // Field needs array casting
					return [rlField.rl, val.split(/\n*\s+and\s+/)];
				} else if (rlField && rlField.rl) { // Known BT field but different RL field
					return [rlField.rl, val];
				} else if (settings.preserveUnkownKeys) { // Everything else - add field
					return [key, val];
				}
			})
			.filter(Boolean) // Remove duds
	);
}


/**
* Translate a BibTeX encoded string into a regular JS String
*
* @param {String} str Input BibTeX encoded string
* @returns {String} Regular JS output string
*/
export function unescape(str) {
	return str
		.replace(/\/\*/g, '\n')
		.replace(/\{\\\&\}/g, '&')
		.replace(/\{\\\%\}/g, '%')
}


/**
* Translate a JS string into a BibTeX encoded string
*
* @param {String} str Input regular JS String
* @returns {String} BibTeX encoded string
*/
export function escape(str) {
	return (''+str)
		.replace(/\&/g, '{\\&}')
		.replace(/%/g, '{\\%}')
}


/**
* Write a RIS file to a writable stream
*
* @see modules/interface.js
*
* @param {Stream} stream The writable stream to write to
*
* @param {Object} [options] Additional options to use when parsing
* @param {string} [options.defaultType='Misc'] Default citation type to assume when no other type is specified
* @param {string} [options.delimeter='\r'] How to split multi-line items
* @param {Set} [options.omitFields] Set of special fields to always omit, either because we are ignoring or because we have special treatment for them
* @param {Boolean} [options.keyForce=true] Force a unique ID to exist if we don't already have one for each reference
* @param {Boolean} [options.recNumberRNPrefix=true] Rewrite recNumber fields as `RN${NUMBER}`
* @param {Boolean} [options.recNumberKey=true] If the reference `recNumber` is empty use `key<String>` instead
* @param {Boolean} [options.preserveUnknownKeys=true] Output keys we do not have a direct lookup for in the output object
*
* @returns {Object} A writable stream analogue defined in `modules/interface.js`
*/
export function writeStream(stream, options) {
	let settings = {
		defaultType: 'Misc',
		delimeter: '\n',
		omitFields: new Set(['key', 'recNumber', 'type']),
		keyForce: true,
		recNumberRNPrefix: true,
		recNumberKey: true,
		preserveUnkownKeys: true,
		...options,
	};

	return {
		start() {
			return Promise.resolve();
		},
		write: ref => {
			// Fetch Reflib type definition
			ref.type ||= settings.defaultType;
			let rlType = translations.types.rlMap.get(ref.type.toLowerCase());
			let btType = rlType?.bt || settings.defaultType;

			stream.write(
				'@' + btType + '{'
				+ (
					ref.recNumber && settings.recNumberRNPrefix ? `RN${ref.recNumber},`
					: ref.recNumber ? `${ref.recNumber},`
					: ref.key ? `${ref.key},`
					: settings.keyForce ? `${generateCitationKey(ref)},`
					: ''
				) + '\n'
				+ Object.entries(ref)
					.filter(([key, val]) =>
						val // We have a non-nullish val
						&& !settings.omitFields.has(key)
					)
					.reduce((buf, [rawKey, rawVal], keyIndex, keys) => {
						// Fetch Reflib field definition
						let rlField = translations.fields.rlMap.get(rawKey)
						if (!rlField && !settings.preserveUnkownKeys) return buf; // Unknown field mapping - skip if were omitting unknown fields

						let key = rlField ? rlField.bt : rawKey; // Use Reflib->BibTeX field mapping if we have one, otherwise use raw key
						let val = escape( // Escape input value, either as an Array via join or as a flat string
							rawKey == 'authors' && Array.isArray(rawVal) ? rawVal.join(' and ') // Special joining conditions for author field
							: Array.isArray(rawVal) ? rawVal.join(', ') // Treat other arrays as a CSV
							: rawVal // Splat everything else as a string
						);

						return buf + // Return string buffer of ref under construction
							`${key}={${val}}` // Append ref key=val pair to buffer
							+ (keyIndex < keys.length-1 ? ',' : '') // Append comma (if non-last)
							+ '\n' // Finish each field with a newline
					}, '')
				+ '}\n'
			);

			return Promise.resolve();
		},
		middle() {
			stream.write('\n');
		},
		end() {
			return new Promise((resolve, reject) =>
				stream.end(err => err ? reject(err) : resolve())
			);
		},
	};
}


/**
* Generate a citation key from first author + year
* Example: "Roomruangwong2020"
*/
function generateCitationKey(ref) {
	let author = 'Anon';
	if (ref.authors && ref.authors.length > 0) {
		author = ref.authors[0].split(',')[0];
	}

	let year = 'n.d.';
	if (ref.year) {
		year = ref.year;
	}

	return `${author}${year}`;
}


/**
* Lookup tables for this module
* @type {Object}
* @property {Array<Object>} fields Field translations between Reflib (`rl`) and BibTeX format (`bt`)
*/
export let translations = {
	// Field translations {{{
	fields: {
		collection: [
			// Order by priority (highest at top)
			{rl: 'address', bt: 'address'},
			{rl: 'authors', bt: 'author', array: true},
			{rl: 'doi', bt: 'doi'},
			{rl: 'edition', bt: 'edition'},
			{rl: 'editor', bt: 'editor'},
			{rl: 'journal', bt: 'journal'},
			{rl: 'notes', bt: 'note'},
			{rl: 'number', bt: 'number'},
			{rl: 'pages', bt: 'pages'},
			{rl: 'title', bt: 'booktitle'},
			{rl: 'title', bt: 'title'},
			{rl: 'volume', bt: 'volume'},
			{rl: 'isbn', bt: 'issn'},

			// Misc
			{bt: 'month'}, // Combined into {rl:'date'}
			{bt: 'type'}, // Ignored
			{bt: 'year'}, // Combined into {rl:'date'}

			// Nonestandard but used anyway
			{rl: 'abstract', bt: 'abstract'},
			{rl: 'language', bt: 'language'},
			{rl: 'keywords', bt: 'keywords', array: true},
			{rl: 'urls', bt: 'url', array: true},

			// Unknown how to translate these
			// {bt: 'annote'},
			// {bt: 'email'},
			// {bt: 'chapter'},
			// {bt: 'crossref'},
			// {bt: 'howpublished'},
			// {bt: 'institution'},
			// {bt: 'key'},
			// {bt: 'organization'},
			// {bt: 'publisher'},
			// {bt: 'school'},
			// {bt: 'series'},
		],
		rlMap: new Map(),
		btMap: new Map(),
	},
	// }}}
	// Ref type translations {{{
	types: {
		collection: [
			// Order by priority (highest at top)
			{rl: 'journalArticle', bt: 'Article'},
			{rl: 'book', bt: 'Book'},
			{rl: 'bookSection', bt: 'InBook'},
			{rl: 'conferencePaper', bt: 'Conference'},
			{rl: 'conferenceProceedings', bt: 'InProceedings'},
			{rl: 'report', bt: 'TechReport'},
			{rl: 'thesis', bt: 'PHDThesis'},
			{rl: 'unknown', bt: 'Misc'},
			{rl: 'unpublished', bt: 'Unpublished'},

			// Type aliases
			{rl: 'journalArticle', bt: 'Journal Article'},

			// Unknown how to translate these
			{rl: 'Misc', bt: 'Booklet'},
			{rl: 'Misc', bt: 'InCollection'},
			{rl: 'Misc', bt: 'Manual'},
			{rl: 'Misc', bt: 'MastersThesis'},
			{rl: 'Misc', bt: 'Proceedings'},
		],
		rlMap: new Map(),
		btMap: new Map(),
	},
	// }}}
};


/**
* @see modules/interface.js
*/
export function setup() {
	// Create lookup object of translations.fields with key as .rl / val as the full object
	translations.fields.collection.forEach(c => {
		if (c.rl) translations.fields.rlMap.set(c.rl.toLowerCase(), c);
		if (c.bt) translations.fields.btMap.set(c.bt, c);
	});

	// Create lookup object of ref.types with key as .rl / val as the full object
	translations.types.collection.forEach(c => {
		// Append each type to the set, accepting the first in each case as the priority
		let rlLc = c.rl.toLowerCase();
		let btLc = c.bt.toLowerCase();
		if (c.rl && !translations.types.rlMap.has(rlLc)) translations.types.rlMap.set(rlLc, c);
		if (c.bt && !translations.types.btMap.has(btLc)) translations.types.btMap.set(btLc, c);
	});
}
