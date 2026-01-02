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
* @param {Boolean} [options.omitUnkown=false] If true, only keep known reconised fields
*
* @returns {Object} A readable stream analogue defined in `modules/interface.js`
*/
export function readStream(stream, options) {
	let settings = {
		recNumberNumeric: true,
		omitUnknown: false,
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
					if (mode == MODES.FIELDS) console.log('FIELD PEEK [[[', buffer.slice(0, 10) + ']]]');

					let match; // Regex storage for match groups
					if ((mode == MODES.REF) && (match = /^\s*@(?<type>[\w]+?)\s*{(?<id>.*?),/s.exec(buffer))) {
						if (settings.recNumberNumeric && isFinite(match.groups.id)) { // Accept numeric recNumber
							ref.recNumber = +match.groups.id;
						} else if (!settings.recNumberNumeric && match.groups.id) { // Non numeric / finite ID - but we're allowed to accept it anyway
							ref.recNumber = +match.groups.id;
						} // Implied else - No ID, ignore

						console.log('START REF', match.groups);
						ref.type = match.groups.type;
						mode = MODES.FIELDS;
						state = null;
					} else if (mode == MODES.FIELDS && (match = /^\s*(?<field>\w+?)\s*=\s*/s.exec(buffer))) {
						mode = MODES.FIELD_START;
						state = {field: match.groups.field};
					} else if (mode == MODES.FIELDS && (match = /^\s*\}\s*/s.exec(buffer))) { // End of ref
						console.log('Pre-tidy ref', ref);
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
								&& (match = /^(?<value>.+?)(?<!\\%)\}\s*,?\s*\r?\n/s.exec(buffer))
							)
							|| (
								state.fieldWrapper == '"'
								&& (match = /^(?<value>.+?)"\s*,?\s*\r?\n/s.exec(buffer))
							)
						)
					) {
						mode = MODES.FIELDS;
						if (ref[state.field] !== undefined) { // Already have content - append
							ref[state.field] += '\n' + unescape(match.groups.value);
						} else { // Populate initial value
							ref[state.field] = unescape(match.groups.value);
						}
						if (state.field == 'language') debugger;
						console.log('... field', state.field, '=', ref[state.field]);
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
	let tidyRef = {};

	Object.entries(ref).forEach(([key, val]) => {
		let rlField = translations.fields.btMap.get(key);

		if (key == 'type') { // Special conversion for type
			console.log('FIXME: Accepting type', key);
			ref[key] = val;
		} else if (settings.omitUnkown && !rlField) { // Omit unknown fields
			return;
		} else if (rlField && rlField.array) { // Field needs array casting
			ref[rlField.rl] = val.split(/\n*\s+and\s+/);
		} else if (rlField && rlField.rl) { // Known BT field but different RL field
			ref[rlField.rl] = val;
		} else if (!settings.omitUnkown) { // Everything else - add field
			ref[key] = val;
		}
	});

	return tidyRef;
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
	return str
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
* @param {Boolean} [options.omitUnkown=false] If true, only keep known reconised fields
*
* @returns {Object} A writable stream analogue defined in `modules/interface.js`
*/
export function writeStream(stream, options) {
	let settings = {
		defaultType: 'Misc',
		delimeter: '\n',
		omitUnkown: false,
		...options,
	};


	return {
		start() {
			return Promise.resolve();
		},
		write: ref => {
			stream.write(
				Object.entries(ref)
					.filter(([key, val]) => !settings.omitUnkown || translations.fields.rlMap.has(key))
					.reduce(([key, val], buf) => {
						let rlField = translations.fields.rlMap.get(key)
						if (!rlField && settings.omitUnkown) return buf; // Unknown field mapping - skip

						// Escape closing braces
						val = val.replace(/}/g, '\%}');

						// Append ref key=val pair to buffer
						if (rlField && rlField.bt && rlField.array) { // Has BT field mapping (and its an array)
							return buf + `\n${rlField.bt}={` + val.join('\nand ') + '}';
						} else if (rlField && rlField.bt) { // Has BT field mapping (scalar)

							return buf + `\n${rlField.bt}={${val}}`;
						} else { // Unknown field but output anyway
							return buf + `\n${key}={${val}}`;
						}
					}, '')
			);

			return Promise.resolve();
		},
		end() {
			return new Promise((resolve, reject) =>
				stream.end(err => err ? reject(err) : resolve())
			);
		},
	};
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
			{rl: 'author', bt: 'author', array: true},
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
			{rl: 'article', bt: 'Article'},
			{rl: 'book', bt: 'Book'},
			{rl: 'bookSection', bt: 'InBook'},
			{rl: 'conferencePaper', bt: 'Conference'},
			{rl: 'conferenceProceedings', bt: 'InProceedings'},
			{rl: 'report', bt: 'TechReport'},
			{rl: 'thesis', bt: 'PHDThesis'},
			{rl: 'unknown', bt: 'Misc'},
			{rl: 'unpublished', bt: 'Unpublished'},

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
		if (c.rl) translations.fields.rlMap.set(c.rl, c);
		if (c.bt) translations.fields.btMap.set(c.bt, c);
	});

	// Create lookup object of ref.types with key as .rl / val as the full object
	translations.types.collection.forEach(c => {
		if (c.rl) translations.types.rlMap.set(c.rl, c);
		if (c.bt) translations.types.btMap.set(c.bt, c);
	});
}
