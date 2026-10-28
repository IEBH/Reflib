import Emitter from '../shared/emitter.js';
import {default as SQLite} from 'sql.js';

/**
* EndNote/SDB column to RefLib column mappings
* This must match EXACTLY a known, working .sdb Sqlite database table pragma
* Column ID's not present within this list are generally scrapped
*
* @type {Array<Object>}
* @property {String} sl The Sqlite/SDB column within the `refs` table
* @property {String} rl The Reflib column (see README.md)
* @property {'TEXT'|'INTEGER'} [type='TEXT'] SQLite column type, used for encoding when writing
* @property {Function} [value] Optional column value mapper. Called as `(val:Any, ref:Object, col:Object, colIndex:Number, refIndex:Number)`
* @property {*} [slDefault=''] Overriding SQLite column value if the field is empty
*/
export const columnMappings = [
	// FIXME: This list is incomplete
	{sl: 'id', rl: 'recNumber', type: 'INTEGER', value: (val, ref, col, colIndex, refIndex) => ref.recNumber || refIndex + 1},
	// 'trash_state',
	// 'text_styles',
	// 'reference_type',
	{sl: 'author', rl: 'author'},
	// 'year',
	{sl: 'title', rl: 'title'},
	{sl: 'pages', rl: 'pages'},
	// 'secondary_title',
	{sl: 'volume', rl: 'volume'},
	{sl: 'number', rl: 'number'},
	// 'number_of_volumes',
	// 'secondary_author',
	// 'place_published',
	// 'publisher',
	// 'subsidiary_author',
	// 'edition',
	// 'keywords',
	// 'type_of_work',
	{sl: 'date', rl: 'date'},
	{sl: 'abstract', rl: 'abstract'},
	{sl: 'label', rl: 'label'},
	// 'url',
	// 'tertiary_title',
	// 'tertiary_author',
	{sl: 'notes', rl: 'notes'},
	{sl: 'isbn', rl: 'isbn'},
	{sl: 'custom_1', rl: 'custom1'},
	{sl: 'custom_2', rl: 'custom2'},
	{sl: 'custom_3', rl: 'custom3'},
	{sl: 'custom_4', rl: 'custom4'},
	// 'alternate_title',
	// 'accession_number',
	// 'call_number',
	// 'short_title',
	{sl: 'custom_5', rl: 'custom5'},
	{sl: 'custom_6', rl: 'custom6'},
	{sl: 'section', rl: 'section'},
	// 'original_publication',
	// 'reprint_edition',
	// 'reviewed_item',
	// 'author_address',
	{sl: 'caption', rl: 'caption'},
	{sl: 'custom_7', rl: 'custom7'},
	// 'electronic_resource_number',
	// 'translated_author',
	// 'translated_title',
	// 'name_of_database',
	// 'database_provider',
	{sl: 'research_notes', rl: 'researchNotes'},
	{sl: 'language', rl: 'language'},
	// 'access_date',
	// 'last_modified_date',
	// 'record_properties',
	// 'added_to_library',
	// 'record_last_updated',
	// 'reserved3',
	// 'fulltext_downloads',
	// 'read_status',
	// 'rating',
	// 'reserved7',
	// 'reserved8',
	// 'reserved9',
	// 'reserved10'
];

export const baseSql = [
	'CREATE TABLE refs(id INTEGER PRIMARY KEY AUTOINCREMENT,trash_state INTEGER NOT NULL DEFAULT 0,text_styles TEXT NOT NULL DEFAULT "",reference_type INTEGER NOT NULL DEFAULT 0,author TEXT NOT NULL DEFAULT "",year TEXT NOT NULL DEFAULT "",title TEXT NOT NULL DEFAULT "",pages TEXT NOT NULL DEFAULT "",secondary_title TEXT NOT NULL DEFAULT "",volume TEXT NOT NULL DEFAULT "",number TEXT NOT NULL DEFAULT "",number_of_volumes TEXT NOT NULL DEFAULT "",secondary_author TEXT NOT NULL DEFAULT "",place_published TEXT NOT NULL DEFAULT "",publisher TEXT NOT NULL DEFAULT "",subsidiary_author TEXT NOT NULL DEFAULT "",edition TEXT NOT NULL DEFAULT "",keywords TEXT NOT NULL DEFAULT "",type_of_work TEXT NOT NULL DEFAULT "",date TEXT NOT NULL DEFAULT "",abstract TEXT NOT NULL DEFAULT "",label TEXT NOT NULL DEFAULT "",url TEXT NOT NULL DEFAULT "",tertiary_title TEXT NOT NULL DEFAULT "",tertiary_author TEXT NOT NULL DEFAULT "",notes TEXT NOT NULL DEFAULT "",isbn TEXT NOT NULL DEFAULT "",custom_1 TEXT NOT NULL DEFAULT "",custom_2 TEXT NOT NULL DEFAULT "",custom_3 TEXT NOT NULL DEFAULT "",custom_4 TEXT NOT NULL DEFAULT "",alternate_title TEXT NOT NULL DEFAULT "",accession_number TEXT NOT NULL DEFAULT "",call_number TEXT NOT NULL DEFAULT "",short_title TEXT NOT NULL DEFAULT "",custom_5 TEXT NOT NULL DEFAULT "",custom_6 TEXT NOT NULL DEFAULT "",section TEXT NOT NULL DEFAULT "",original_publication TEXT NOT NULL DEFAULT "",reprint_edition TEXT NOT NULL DEFAULT "",reviewed_item TEXT NOT NULL DEFAULT "",author_address TEXT NOT NULL DEFAULT "",caption TEXT NOT NULL DEFAULT "",custom_7 TEXT NOT NULL DEFAULT "",electronic_resource_number TEXT NOT NULL DEFAULT "",translated_author TEXT NOT NULL DEFAULT "",translated_title TEXT NOT NULL DEFAULT "",name_of_database TEXT NOT NULL DEFAULT "",database_provider TEXT NOT NULL DEFAULT "",research_notes TEXT NOT NULL DEFAULT "",language TEXT NOT NULL DEFAULT "",access_date TEXT NOT NULL DEFAULT "",last_modified_date TEXT NOT NULL DEFAULT "",record_properties TEXT NOT NULL DEFAULT "",added_to_library INTEGER NOT NULL DEFAULT 0,record_last_updated INTEGER NOT NULL DEFAULT 0,reserved3 INTEGER NOT NULL DEFAULT 0,fulltext_downloads TEXT NOT NULL DEFAULT "",read_status TEXT NOT NULL DEFAULT "",rating TEXT NOT NULL DEFAULT "",reserved7 TEXT NOT NULL DEFAULT "",reserved8 TEXT NOT NULL DEFAULT "",reserved9 TEXT NOT NULL DEFAULT "",reserved10 TEXT NOT NULL DEFAULT "")',
].join(';');

/**
* Lookup object for Sqlite columns to the column mapping object
*
* @type {Object<Object>} Each column mapping item with the Sqlite column name as the key
*/
export const columnMappingSL2RL = Object.fromEntries(
	columnMappings
		.map(cm => [cm.sl, cm])
)


/**
* Read an EndNote(@11+) / SQLite database, returning an Emitter analogue
*
* @see modules/inhterface.js
*
* @param {Stream} stream Stream primative to encapsulate
*
* @returns {Object} An Emitter analogue defined in `../shared/Emitter.js`
*/
export function readStream(stream) {
	let emitter = Emitter();

	// Queue up the parser in the next tick (so we can return the emitter first)
	setTimeout(()=> {
		let chunks = []; // Gathered buffer chunks, used to make an arrayBuffer later

		stream
			.on('data', chunk => chunks.push(chunk))
			.on('error', e => emitter.emit('error', e))
			.on('end', ()=> {
				Promise.resolve()
					.then(()=> { // Parse chunks into an arrayBuffer
						let buf = new Uint8Array(
							chunks.reduce((total, chunk) => total + chunk.length, 0)
						);

						let position = 0;
						chunks.forEach(chunk => {
							buf.set(chunk, position);
							position += chunk.length;
						});

						// Release chunks to free up memory
						chunks = [];

						return buf;
					})
					.then(buf => readBuffer(buf, { // Hand arrayBuffer off to readBuffer() for processing
						onRef(ref) {
							emitter.emit('ref', ref);
						},
					}))
					.then(()=> emitter.emit('end'))
					.catch(e => emitter.emit('error', e))
			})
	});

	return emitter;
}


/**
* Actual reader function
* Accepts a buffer and tiggers the emitter when references are extracted + when ending
*
* @param {Uint8Array} buf The buffer to process
*
* @param {Object} [options] Additional options to mutate behaviour
* @param {Function} [options.onRef] Function to trigger when we extract a reference from the buffer. Called as `(ref:RefLibRef)`
* @param {String} [options.refTable='enl_refs'] The name of the reference table to query
*
* @returns {Promise} A promise which will eventually resolve when the read operation on the buffer has completed
*/
export function readBuffer(buf, options) {
	let settings = {
		refTable: 'refs',
		onRef() {},
		...options,
	};
	return Promise.resolve()
		.then(()=> SQLite()) // Init database
		.then(sqli => new sqli.Database(buf)) // Create SQLite database
		.then(db => db.exec(`SELECT * from ${settings.refTable}`)) // Slurp all references
		.then(([{columns, values}]) => { // Digest references
			values.forEach(v => {
				let ref = columns.reduce((ref, col, colIndex) => {
					if (columnMappingSL2RL[col]) // Is a column we have a mapping for (implied else - ignore the data)
						ref[columnMappingSL2RL[col].rl] = v[colIndex];

					return ref;
				}, {});

				settings.onRef(ref);
			})
		})
}


/**
* Write references to an EndNote(@11+)) SQLite database file
*
* @see modules/interface.js
*
* @param {Stream} stream Writable stream to output to
*
* @returns {Object} A writable stream analogue defined in `modules/interface.js`
*/
export function writeStream(stream) {
	let db; // Database we are writing to
	let refIndex = 0;
	let insertOp; // Prepared query to insert a single ref

	return {
		start() {
			return SQLite()
				.then(sqli => new sqli.Database())
				.then(res => db = res)
				.then(()=> db.exec(baseSql))
				.then(()=> insertOp = db.prepare(
					'INSERT INTO refs'
					+ '('
						+ columnMappings.map(cm => cm.sl).join(', ')
					+ ') '
					+ 'VALUES ('
						+ columnMappings.map(cm => cm.sl).map(k => ':' + k).join(', ')
					+ ')'
				))
		},

		write(ref) {
			// Compose ref object we are going to throw at SQLite
			let slRef = columnMappings
				.reduce((r, col, colIndex) => {
					r[':' + col.sl] =
						col.value ? col.value(ref[col.rl], ref, col, colIndex, refIndex++)
						: ref[col.rl] || col.slDefault || '';

					return r;
				}, {});

			return insertOp.run(slRef);
		},

		end() {
			return Promise.resolve()
				.then(()=> stream.write(db.export()))
				.then(()=> stream.end());
		},
	};
}
