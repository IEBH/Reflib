import Emitter from '../shared/emitter.js';

/**
* Read a Medline file as a stream
*
* @see modules/interface.js
* @param {Stream} stream A readable stream analogue
* @param {Object} [options] Additional options to use when parsing
* @param {string} [options.defaultType='journalArticle'] Default citation type to assume when no other type is specified
* @param {string} [options.delimeter='\r'] How to split multi-line items
* @param {string} [options.reformatAuthors=true] Reformat Medline author format to more closely match the Reflib standard
* @param {string} [options.journal='long'] Whether to use the 'long' journal name or the 'short' varient when parsing references
* @param {boolean} [options.parseAddress=true] Try to recompose the `address` property from all author address information
* @param {boolean} [options.parseDoi=true] Try to parse the DOI from the article identifiers
* @param {boolean} [options.parseYear=true] If truthy try to parse the year field from the date
*
* @param {array<Object>} [options.fieldsReplace] If truthy adopt apply the field replacements, usually from medlineComplex fields to other values
* @param {string} [options.fieldsReplace.from] Field to copy/move the value from, if undefined `reformat` must be specified
* @param {string} options.fieldsReplace.to Field to copy/move the value to
* @param {string} [options.fieldsReplace.delete=true] Whether to remove the orignal 'from' field if successful (i.e. reformat doesn't return false)
* @param {function} [options.fieldsReplace.reformat] Optional function called as `(value, ref)` to provide the new field value. If return value is boolean `false` no action is taken
*
* @returns {Object} A readable stream analogue defined in `modules/interface.js`
*/
export function readStream(stream, options) {
	let settings = {
		defaultType: 'journalArticle',
		delimeter: '\r',
		reformatAuthors: true,
		journal: 'long',
		parseAddress: true,
		parseDoi: true,
		parseYear: true,
		fieldsReplace: [],
		...options,
	};
	settings.fieldsReplace = [...settings.fieldsReplace]; // Shallow copy so we never mutate a caller supplied array

	// Settings parsing {{{

	/*
	settings.fieldsReplace.push({
		to: 'debugPre',
		reformat: (v, ref) => {
			console.log('DEBUG:PRE', ref);
			return false;
		},
	});
	*/

	// Translate type - the first PT entry with a known translation becomes the Reflib type, all others are kept in `medlineTypeSecondary`
	settings.fieldsReplace.push({
		from: 'type',
		to: 'type',
		delete: false,
		reformat: (v, ref) => {
			let rawTypes = [].concat(v ?? []);
			let primary = rawTypes.find(raw => translations.types.rawMap.get(raw)?.rl);
			let secondary = rawTypes.filter(raw => raw !== primary);
			if (secondary.length > 0) ref.medlineTypeSecondary = secondary;

			return primary
				? translations.types.rawMap.get(primary).rl
				: settings.defaultType;
		},
	});

	// Populate authors (optionally reformatted into the Reflib "Last, I. N." style)
	settings.fieldsReplace.push({
		to: 'authors',
		reformat: (authors, ref) => {
			let rawAuthors = ref.medlineAuthorsShort || ref.medlineAuthorsFull;
			if (!rawAuthors) return false; // No author data - leave the field unset

			return settings.reformatAuthors
				? rawAuthors.map(author =>
					author.replace(/^(?<last>[\w-]+?) (?<initials>\w+)$/, (match, last, initials) => {
						return (
							last && initials ? last + ', ' + initials.split('').map(i => `${i}.`).join(' ')
							: last ? last
							: match
						)
					})
				)
				: [...rawAuthors];
		},
	});

	// Add rule for where the journal field comes from
	settings.fieldsReplace.push({
		to: 'journal',
		reformat: settings.journal == 'long'
			? (v, ref) => ref.medlineJournalFull || ref.medlineJournalShort || false
			: (v, ref) => ref.medlineJournalShort || ref.medlineJournalFull || false,
	});

	// Allow parsing of Address
	if (settings.parseAddress)
		settings.fieldsReplace.push({
			from: 'medlineAuthorsAffiliation',
			to: 'address',
			delete: false,
			reformat: v => {
				if (!v) return false;
				return v.join(settings.delimeter);
			},
		});

	// Allow parsing of DOIs
	if (settings.parseDoi)
		settings.fieldsReplace.push({
			from: 'medlineArticleID',
			to: 'doi',
			delete: false,
			reformat: v => /(?<doi>[\w\.\/_]+) \[doi\]/.exec(v)?.groups.doi || false,
		});

	// Allow parsing of years
	if (settings.parseYear)
		settings.fieldsReplace.push({
			from: 'date',
			to: 'year',
			delete: false,
			reformat: v => /(?<year>\d{4}\b)/.exec(v)?.groups.year || false,
		});

	/*
	settings.fieldsReplace.push({
		to: 'debugPost',
		reformat: (v, ref) => {
			console.log('DEBUG:POST', ref);
			return false;
		},
	});
	*/

	// }}}

	let emitter = Emitter();

	let buffer = ''; // Incomming text buffer lines if the chunk we're given isn't enough to parse a reference yet

	// Queue up the parser in the next tick (so we can return the emitter first)
	setTimeout(()=> {
		stream
			.on('data', chunkBuffer => {
				emitter.emit('progress', stream.bytesRead);
				buffer += chunkBuffer.toString(); // Append incomming data to the partial-buffer we're holding in memory

				let bufferCrop = 0; // How many bytes to shift off the front of the buffer based on the last full reference we saw, should end up at the last byte offset of buffer that is valid to shift-truncate to
				let bufferSplitter = /(\r\n|\n){2,}/g; // RegExp to use per segment (multiple calls to .exec() stores state because JS is a hellscape)

				let bufferSegment;

				while (bufferSegment = bufferSplitter.exec(buffer)) {
					let parsedRef = parseRef(buffer.substring(bufferCrop, bufferSegment.index), settings); // Parse the ref from the start+end points
					emitter.emit('ref', parsedRef);

					bufferCrop = bufferSegment.index + bufferSegment[0].length; // Set start of next ref + cropping index to last seen offset + match
				}

				buffer = buffer.substring(bufferCrop); // Shift-truncate the buffer so we're ready to input more data on the next call
			})
			.on('error', e => emitter.emit('error', e))
			.on('end', ()=> {
				if (buffer.replace(/\s+/, '')) { // Anything left in the to-drain buffer?
					// Drain remaining buffer into parser before exiting
					emitter.emit('ref', parseRef(buffer, settings));
				}

				// Signal that we're done
				emitter.emit('end');
			})
	})

	return emitter;
}


/**
* Write a Medline citation file to a stream
* @see modules/interface.js
*
* @param {Stream} stream The stream to write to
* @param {Object} [options] Additional options to use when parsing
* @param {string} [options.defaultType='journalArticle'] Default citation type to assume when no other type is specified
* @param {string} [options.delimeter='\r'] How to split multi-line items
*
* @returns {Object} A writable stream analogue defined in `modules/interface.js`
*/
export function writeStream(stream, options) {
	let settings = {
		defaultType: 'journalArticle',
		delimeter: '\r',
		...options,
	};

	return {
		start() {
			return Promise.resolve();
		},
		write: xRef => {
			let ref = { // Assign defaults if not already present
				type: settings.defaultType,
				title: '<NO TITLE>',
				...xRef,
			};

			// Populate the Medline journal fields from the generic `journal` field if we don't have the raw values (e.g. the ref came from another format)
			if (ref.journal && !ref.medlineJournalFull && !ref.medlineJournalShort) {
				ref.medlineJournalFull = ref.journal;
				ref.medlineJournalShort = ref.journal;
			}

			stream.write(
				translations.fields.collectionOutput
					.filter(f => ref[f.rl]) // Has field?
					.flatMap(f =>
						f.rl == 'type' // Translate type field + append any secondary types
							? [
								'PT  - ' + (translations.types.rlMap.get(ref.type) || translations.types.rlMap.get(settings.defaultType)).raw,
								...(ref.medlineTypeSecondary || []).map(item => 'PT  - ' + item),
							]
						: f.rl == 'title' // Special formatting for authors which should follow the title
							? [
								'TI  - ' + ref.title,
								...(ref.authors || []).flatMap((a, i) => [
									ref.medlineAuthorsFull?.[i] ? `FAU - ${ref.medlineAuthorsFull[i]}` : `FAU - ${ref.authors[i]}`,
									ref.medlineAuthorsShort?.[i] && `AU  - ${ref.medlineAuthorsShort[i]}`,
									ref.medlineAuthorsAffiliation?.[i] && `AD  - ${ref.medlineAuthorsAffiliation[i]}`,
									ref.medlineAuthorsId?.[i] && `AUID- ${ref.medlineAuthorsId[i]}`,
								].filter(Boolean)),
							]
						: f.outputSkip ? []
						: f.outputRepeat && Array.isArray(ref[f.rl]) // Repeat array types
							? ref[f.rl].map(item => f.raw.padEnd(4, ' ') + '- ' + item)
						: Array.isArray(ref[f.rl]) // Flatten arrays into text
							? f.raw.padEnd(4, ' ') + '- ' + ref[f.rl].join(settings.delimeter)
						: f.raw.padEnd(4, ' ') + '- ' + ref[f.rl] // Regular field output
					)
					.concat(['\n'])
					.join('\n')
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
* Parse a single RIS format reference from a block of text
* This function is used internally by parseStream() for each individual reference
*
* @param {string} refString Raw RIS string composing the start -> end of the ref
* @param {Object} settings Additional settings to pass, this should be initialized + parsed by the calling function for efficiency, see readStream() for full spec
*
* @returns {ReflibRef} A single reference, parsed form the incoming string
*/
export function parseRef(refString, settings) {
	let ref = {}; // Reference under construction
	let lastField; // Last field object we saw, used to append values if they don't match the default RIS key=val one-liner

	refString
		.split(/\r\n|\r|\n/) // Split into lines
		.forEach(line => {
			let parsedLine = /^\s*(?<key>[A-Z]+?)\s*-\s*(?<value>.*)$/s.exec(line)?.groups; // NOTE: Blank fields may have no whitespace after the dash

			if (!parsedLine) { // Doesn't match key=val spec
				line = line.trimStart();
				if (line.replace(/\s+/, '') && lastField) { // Line isn't just whitespace + We have a field to append to - append with \r delimiters
					if (lastField.inputArray) { // Treat each line feed like an array entry
						ref[lastField.rl].push(line);
					} else { // Assume we append each line entry as a single-line string
						ref[lastField.rl] += ' ' + line;
					}
				}
				return; // Stop processing this line
			}

			let fieldLookup = translations.fields.rawMap.get(parsedLine.key);

			if (!fieldLookup) { // Skip unknown field translations
				lastField = null;
				return;
			} else if (fieldLookup.inputArray) { // Should this `rl` key be treated like an appendable array?
				if (!ref[fieldLookup.rl]) { // Array doesn't exist yet
					ref[fieldLookup.rl] = [parsedLine.value];
				} else {
					ref[fieldLookup.rl].push(parsedLine.value);
				}
				lastField = fieldLookup;
			} else { // Simple key=val
				ref[fieldLookup.rl] = parsedLine.value;
				lastField = fieldLookup;
			}
		})

	// Post processing {{{
	// Remove trailing dots from fields that request it (e.g. titles) - done here so the last field in a record is also handled
	translations.fields.collection
		.filter(f => f.trimDotSuffix && typeof ref[f.rl] == 'string')
		.forEach(f => ref[f.rl] = ref[f.rl].replace(/\.$/, ''));

	// Apply field replacement / reformat rules
	if (settings.fieldsReplace?.length > 0)
		settings.fieldsReplace.forEach(replacement => {
			let newVal = replacement.from ? ref[replacement.from] : null;

			// Apply reformat if we have one
			if (replacement.reformat) {
				newVal = replacement.reformat(newVal, ref);
				if (newVal === false) return; // Skip boolean false
			}

			// Copy field 'from' -> 'to'
			ref[replacement.to] = newVal;

			// Delete 'from' field
			if (replacement.from && (replacement.delete ?? true))
				delete ref[replacement.from];
		})
	// }}}

	return ref;
}


/**
* Lookup tables for this module
* @type {Object}
* @property {array<Object>} fields Field translations between Reflib (`rl`) and the raw format (`raw`)
* @property {array<Object>} types Field translations between Reflib (`rl`) and the raw format types as raw text (`rawText`) and numeric ID (`rawId`)
* @property {boolean} isArray Whether the field should append to any existing `rl` field and be treated like an array of data
* @property {number|boolean} [sort] Sort order when outputting, use boolean `false` to disable the field on output
* @property {boolean} [outputSkip=false] Dont output this field at all
* @property {boolean} [outputRepeat=false] Whether to repeat the output field if multiple values are present, if disabled arrays are flattened into a string with newlines instead
* @property {boolean} [inputArray=false] Forcably cast the field as an array when reading, even if there is only one value
* @property {boolean} [trimDotSuffix=false] Remove any trailing dot character IF the input string spans multiple lines
*/
export let translations = {
	// Field translations {{{
	fields: {
		collection: [
			// Based on the spec at https://www.nlm.nih.gov/bsd/mms/medlineelements.html
			// Any field beginning with `medline*` is non-standard but included to prevent data loss when converted back to Medline format
			{rl: 'medlinePMID', raw: 'PMID', sort: 0},
			{rl: 'medlineOwner', raw: 'OWN', sort: 1},
			{rl: 'medlineStatus', raw: 'STAT', sort: 2},
			{rl: 'medlineDateRevised', raw: 'DR', sort: 3},
			{rl: 'medlineISSN', raw: 'IS', outputRepeat: true, inputArray: true, sort: 4},
			{rl: 'date', raw: 'DP', sort: 5},
			{rl: 'title', raw: 'TI', sort: 6, trimDotSuffix: true},
			{rl: 'doi', raw: 'LID', sort: 7},
			{rl: 'abstract', raw: 'AB', sort: 8},
			{rl: 'medlineCopyright', raw: 'CI', sort: 7},

			// NOTE: Authors get special treatment when formatting so all these fields are skipped
			{rl: 'medlineAuthorsFull', raw: 'FAU', sort: 10, outputSkip: true, inputArray: true},
			{rl: 'medlineAuthorsShort', raw: 'AU', sort: 10, outputSkip: true, inputArray: true},
			{rl: 'medlineAuthorsAffiliation', raw: 'AD', sort: 10, outputSkip: true, inputArray: true},
			{rl: 'medlineAuthorsId', raw: 'AUID', sort: 10, outputSkip: true, inputArray: true},

			{rl: 'language', raw: 'LA', sort: 11},
			{rl: 'medlineGrantNumber', raw: 'GR', sort: 12},
			{rl: 'type', raw: 'PT', sort: 14, inputArray: true},
			{rl: 'medlineTypeSecondary', raw: 'PTX', outputSkip: true}, // Populated with any other PT entries as an array, written out alongside the `type` field
			{rl: 'medlineDateElectronicPublication', raw: 'DEP', sort: 15},
			{rl: 'address', raw: 'PL', sort: 16},
			{rl: 'medlineJournalShort', raw: 'TA', sort: 17},
			{rl: 'medlineJournalFull', raw: 'JT', sort: 18},
			{rl: 'medlineNLMID', raw: 'JID', sort: 19},
			{rl: 'medlineSubset', raw: 'SB', sort: 20},
			{rl: 'medlineOwnerOtherTerm', raw: 'OTO', sort: 21},
			{rl: 'keywords', raw: 'OT', outputRepeat: true, inputArray: true, sort: 22},
			{rl: 'medlineEntrezDate', raw: 'EDAT', sort: 23},
			{rl: 'medlineDateMesh', raw: 'MHDA', sort: 24},
			{rl: 'medlinePublicationHistoryStatus', raw: 'PHST', outputRepeat: true, inputArray: true, sort: 25},
			{rl: 'medlineArticleID', raw: 'AID', sort: 26},
			{rl: 'medlineStatusPublication', raw: 'PST', sort: 27},
			{rl: 'medlineSource', raw: 'SO', sort: 27},
			{rl: 'notes', raw: 'GN', inputArray: true, outputRepeat: true, sort: 28},

			{rl: 'isbn', raw: 'ISBN'},
			{rl: 'volume', raw: 'VI'},
			{rl: 'medlineVolumeTitle', raw: 'VTI'},
			{rl: 'pages', raw: 'PG'},
			{rl: 'medlineInvestigatorAffiliation', raw: 'IRAD'},
			{rl: 'medlineInvestigatorName', raw: 'IR'},
			{rl: 'medlineInvestigatorNameFull', raw: 'FIR'},
			{rl: 'medlineTitleBook', raw: 'BTI'},
			{rl: 'medlineTitleCollection', raw: 'CTI'},
			{rl: 'medlineConflictOfInterestStatement', raw: 'COIS'},
			{rl: 'medlineCorporateAuthor', raw: 'CN'},
			{rl: 'medlineDateCreate', raw: 'CRDT'},
			{rl: 'medlineDateCreated', raw: 'DA'},
			{rl: 'medlineDateCompleted', raw: 'DCOM'},
			{rl: 'medlineEdition', raw: 'EN'},
			{rl: 'medlineEditor', raw: 'ED'},
			{rl: 'medlineEditorFull', raw: 'FED'},
			{rl: 'medlineGeneSymbol', raw: 'GS'},
			{rl: 'number', raw: 'IP'},
			{rl: 'medlineManuscriptID', raw: 'MID'},
			{rl: 'medlineMeshTerms', raw: 'MH', outputRepeat: true, inputArray: true},
			{rl: 'medlineReferenceCount', raw: 'RF'},
			{rl: 'medlineAbstractOther', raw: 'OAB'},
			{rl: 'medlineCopyrightOther', raw: 'OCI'},
			{rl: 'medlineIDOther', raw: 'OID'},
			{rl: 'medlinePersonalName', raw: 'PS'},
			{rl: 'medlinePersonalNameFull', raw: 'FPS'},
			{rl: 'medlinePublishingModel', raw: 'PUBM'},
			{rl: 'medlinePubMedCentralID', raw: 'PMC'},
			{rl: 'medlinePubMedCentralRelease', raw: 'PMCR'},
			{rl: 'medlineRegistryNumber', raw: 'RN'},
			{rl: 'medlineSubstanceName', raw: 'NM'},
			{rl: 'medlineSecondarySource', raw: 'SI'},
			{rl: 'medlineSpaceFlightMission', raw: 'SFM'},
			{rl: 'medlineTitleTransliterated', raw: 'TT', sort: 6},
		],
		collectionOutput: [], // Sorted + filtered version of the above to use when outputting
		rawMap: new Map(), // Calculated later for quicker lookup
		rlMap: new Map(), // Calculated later for quicker lookup
	},
	// }}}
	// Ref type translations {{{
	types: {
		collection: [
			// Formats we support as a translation (or near-enough translation)
			// Note that the preferred translation should be first

			// High priority translations
			{raw: 'Blog', rl: 'blog'},
			{raw: 'Case Reports', rl: 'case'},
			{raw: 'Catalog', rl: 'catalog'},
			{raw: 'Chart', rl: 'chartOrTable'},
			{raw: 'Database', rl: 'aggregatedDatabase'},
			{raw: 'Dataset', rl: 'dataset'},
			{raw: 'Dictionary', rl: 'dictionary'},
			{raw: 'Encyclopedia', rl: 'encyclopedia'},
			{raw: 'Journal Article', rl: 'journalArticle'},
			{raw: 'Legal Case', rl: 'legalRuleOrRegulation'},
			{raw: 'Letter', rl: 'personalCommunication'},
			{raw: 'Manuscript', rl: 'manuscript'},
			{raw: 'Map', rl: 'map'},
			{raw: 'Newspaper Article', rl: 'newspaperArticle'},
			{raw: 'Patent', rl: 'patent'},
			{raw: 'Preprint', rl: 'unpublished'},
			{raw: 'Tables', rl: 'chartOrTable'},
			{raw: 'Technical Report', rl: 'report'},
			{raw: 'unknown', rl: 'unknown'},
			{raw: 'Unpublished Work', rl: 'unpublished'},
			{raw: 'Video-Audio Media', rl: 'audioVisualMaterial'},
			{raw: 'Web Archive', rl: 'web'},

			// Lower priority translations
			{raw: 'Address', rl: 'personalCommunication'},
			{raw: 'Advertisement', rl: 'audioVisualMaterial'},
			{raw: 'Almanac', rl: 'book'},
			{raw: 'Anecdotes', rl: 'blog'},
			{raw: 'Animation', rl: 'filmOrBroadcast'},
			{raw: 'Annual Report', rl: 'report'},
			{raw: 'Aphorisms and Proverbs', rl: 'pamphlet'},
			{raw: 'Architectural Drawing', rl: 'figure'},
			{raw: 'Autobiography', rl: 'book'},
			{raw: 'Bibliography', rl: 'catalog'},
			{raw: 'Biobibliography', rl: 'book'},
			{raw: 'Biography', rl: 'book'},
			{raw: 'Book Illustrations', rl: 'audioVisualMaterial'},
			{raw: 'Book Review', rl: 'magazineArticle'},
			{raw: 'Caricature', rl: 'artwork'},
			{raw: 'Cartoon', rl: 'audioVisualMaterial'},
			{raw: 'Catalog, Bookseller', rl: 'catalog'},
			{raw: 'Catalog, Commercial', rl: 'catalog'},
			{raw: 'Catalog, Drug', rl: 'catalog'},
			{raw: 'Catalog, Publisher', rl: 'catalog'},
			{raw: 'Catalog, Union', rl: 'catalog'},
			{raw: 'Chronology', rl: 'book'},
			{raw: 'Classical Article', rl: 'classicalWork'},
			{raw: 'Clinical Conference', rl: 'conferenceProceedings'},
			{raw: 'Clinical Study', rl: 'dataset'},
			{raw: 'Clinical Trial, Phase III', rl: 'dataset'},
			{raw: 'Clinical Trial, Phase II', rl: 'dataset'},
			{raw: 'Clinical Trial, Phase I', rl: 'dataset'},
			{raw: 'Clinical Trial, Phase IV', rl: 'dataset'},
			{raw: 'Clinical Trial Protocol', rl: 'dataset'},
			{raw: 'Clinical Trial', rl: 'dataset'},
			{raw: 'Clinical Trial, Veterinary', rl: 'dataset'},
			{raw: 'Consensus Development Conference, NIH', rl: 'conferenceProceedings'},
			{raw: 'Consensus Development Conference', rl: 'conferenceProceedings'},
			{raw: 'Corrected and Republished Article', rl: 'journalArticle'},
			{raw: 'Dictionary, Chemical', rl: 'dictionary'},
			{raw: 'Dictionary, Classical', rl: 'dictionary'},
			{raw: 'Dictionary, Dental', rl: 'dictionary'},
			{raw: 'Dictionary, Medical', rl: 'dictionary'},
			{raw: 'Dictionary, Pharmaceutic', rl: 'dictionary'},
			{raw: 'Dictionary, Polyglot', rl: 'dictionary'},
			{raw: 'Documentaries and Factual Films', rl: 'filmOrBroadcast'},
			{raw: 'Drawing', rl: 'audioVisualMaterial'},
			{raw: 'Ephemera', rl: 'artwork'},
			{raw: 'Eulogy', rl: 'personalCommunication'},
			{raw: 'Formulary, Dental', rl: 'dataset'},
			{raw: 'Formulary, Homeopathic', rl: 'dataset'},
			{raw: 'Formulary, Hospital', rl: 'dataset'},
			{raw: 'Formulary', rl: 'dataset'},
			{raw: 'Funeral Sermon', rl: 'personalCommunication'},
			{raw: 'Government Publication', rl: 'governmentDocument'},
			{raw: 'Graphic Novel', rl: 'artwork'},
			{raw: 'Historical Article', rl: 'ancientText'},
			{raw: 'Incunabula', rl: 'ancientText'},
			{raw: 'Instructional Film and Video', rl: 'filmOrBroadcast'},
			{raw: 'Introductory Journal Article', rl: 'journalArticle'},
			{raw: 'Legislation', rl: 'statute'},
			{raw: 'Manuscript, Medical', rl: 'manuscript'},
			{raw: 'Movable Books', rl: 'book'},
			{raw: 'News', rl: 'newspaperArticle'},
			{raw: 'Pharmacopoeia, Homeopathic', rl: 'book'},
			{raw: 'Pharmacopoeia', rl: 'book'},
			{raw: 'Photograph', rl: 'audioVisualMaterial'},
			{raw: 'Pictorial Work', rl: 'audioVisualMaterial'},
			{raw: 'Poetry', rl: 'artwork'},
			{raw: 'Portrait', rl: 'artwork'},
			{raw: 'Postcard', rl: 'audioVisualMaterial'},
			{raw: 'Poster', rl: 'audioVisualMaterial'},
			{raw: 'Public Service Announcement', rl: 'governmentDocument'},
			{raw: 'Research Support, N.I.H., Extramural', rl: 'grant'},
			{raw: 'Research Support, N.I.H., Intramural', rl: 'grant'},
			{raw: 'Research Support, Non-U.S. Gov\'t', rl: 'grant'},
			{raw: 'Research Support, U.S. Government', rl: 'grant'},
			{raw: 'Research Support, U.S. Gov\'t, Non-P.H.S.', rl: 'grant'},
			{raw: 'Research Support, U.S. Gov\'t, P.H.S.', rl: 'grant'},
			{raw: 'Resource Guide', rl: 'standard'},
			{raw: 'Retracted Publication', rl: 'journalArticle'},
			{raw: 'Retraction of Publication', rl: 'journalArticle'},
			{raw: 'Sermon', rl: 'journalArticle'},
			{raw: 'Statistics', rl: 'chartOrTable'},
			{raw: 'Study Guide', rl: 'standard'},
			{raw: 'Terminology', rl: 'catalog'},
			{raw: 'Textbook', rl: 'book'},
			{raw: 'Unedited Footage', rl: 'audioVisualMaterial'},
			{raw: 'Webcast', rl: 'web'},
			{raw: 'Wit and Humor', rl: 'artwork'},


			// Unsupported - Please map these and submit a PR if you think something obvious is mising
			{rl: '', raw: 'Abbreviations'},
			{rl: '', raw: 'Abstracts'},
			{rl: '', raw: 'Academic Dissertation'},
			{rl: '', raw: 'Account Book'},
			{rl: '', raw: 'Adaptive Clinical Trial'},
			{rl: '', raw: 'Atlas'},
			{rl: '', raw: 'Bookplate'},
			{rl: '', raw: 'Broadside'},
			{rl: '', raw: 'Calendar'},
			{rl: '', raw: 'Collected Correspondence'},
			{rl: '', raw: 'Collected Work'},
			{rl: '', raw: 'Collection'},
			{rl: '', raw: 'Comment'},
			{rl: '', raw: 'Comparative Study'},
			{rl: '', raw: 'Congress'},
			{rl: '', raw: 'Controlled Clinical Trial'},
			{rl: '', raw: 'Cookbook'},
			{rl: '', raw: 'Diary'},
			{rl: '', raw: 'Directory'},
			{rl: '', raw: 'Dispensatory'},
			{rl: '', raw: 'Duplicate Publication'},
			{rl: '', raw: 'Editorial'},
			{rl: '', raw: 'Electronic Supplementary Materials'},
			{rl: '', raw: 'English Abstract'},
			{rl: '', raw: 'Equivalence Trial'},
			{rl: '', raw: 'Essay'},
			{rl: '', raw: 'Evaluation Study'},
			{rl: '', raw: 'Examination Questions'},
			{rl: '', raw: 'Exhibition'},
			{rl: '', raw: 'Expression of Concern'},
			{rl: '', raw: 'Festschrift'},
			{rl: '', raw: 'Fictional Work'},
			{rl: '', raw: 'Form'},
			{rl: '', raw: 'Guidebook'},
			{rl: '', raw: 'Guideline'},
			{rl: '', raw: 'Handbook'},
			{rl: '', raw: 'Herbal'},
			{rl: '', raw: 'Index'},
			{rl: '', raw: 'Interactive Tutorial'},
			{rl: '', raw: 'Interview'},
			{rl: '', raw: 'Juvenile Literature'},
			{rl: '', raw: 'Laboratory Manual'},
			{rl: '', raw: 'Lecture Note'},
			{rl: '', raw: 'Meeting Abstract'},
			{rl: '', raw: 'Meta-Analysis'},
			{rl: '', raw: 'Monograph'},
			{rl: '', raw: 'Multicenter Study'},
			{rl: '', raw: 'Nurses Instruction'},
			{rl: '', raw: 'Observational Study'},
			{rl: '', raw: 'Observational Study, Veterinary'},
			{rl: '', raw: 'Outline'},
			{rl: '', raw: 'Overall'},
			{rl: '', raw: 'Patient Education Handout'},
			{rl: '', raw: 'Periodical'},
			{rl: '', raw: 'Periodical Index'},
			{rl: '', raw: 'Personal Narrative'},
			{rl: '', raw: 'Phrases'},
			{rl: '', raw: 'Popular Work'},
			{rl: '', raw: 'Practice Guideline'},
			{rl: '', raw: 'Pragmatic Clinical Trial'},
			{rl: '', raw: 'Price List'},
			{rl: '', raw: 'Problems and Exercises'},
			{rl: '', raw: 'Program'},
			{rl: '', raw: 'Programmed Instruction'},
			{rl: '', raw: 'Prospectus'},
			{rl: '', raw: 'Publication Components'},
			{rl: '', raw: 'Publication Formats'},
			{rl: '', raw: 'Published Erratum'},
			{rl: '', raw: 'Randomized Controlled Trial'},
			{rl: '', raw: 'Randomized Controlled Trial, Veterinary'},
			{rl: '', raw: 'Research Support, American Recovery and Reinvestment Act'},
			{rl: '', raw: 'Review'},
			{rl: '', raw: 'Scientific Integrity Review'},
			{rl: '', raw: 'Study Characteristics'},
			{rl: '', raw: 'Support of Research'},
			{rl: '', raw: 'Systematic Review'},
			{rl: '', raw: 'Twin Study'},
			{rl: '', raw: 'Union List'},
			{rl: '', raw: 'Validation Study'},
		],
		rawMap: new Map(), // Calculated later for quicker lookup
		rlMap: new Map(), // Calculated later for quicker lookup
	},
	// }}}
};


/**
* @see modules/interface.js
*/
export function setup() {
	// Sort the field set by sort field
	translations.fields.collectionOutput = translations.fields.collection
		.filter(f => f.sort !== false)
		.sort((a, b) => (a.sort ?? 1000) == (b.sort ?? 1000) ? 0
			: (a.sort ?? 1000) < (b.sort ?? 1000) ? -1
			: 1
		)

	// Create lookup object of translations.fields with key as .rl / val as the full object
	translations.fields.collection.forEach(c => {
		translations.fields.rlMap.set(c.rl, c);
		translations.fields.rawMap.set(c.raw, c);
	});

	// Create lookup object of ref.types with key as .rl / val as the full object
	// The first entry for each `rl` wins so the preferred translations at the top of the collection are used when writing
	translations.types.collection.forEach(c => {
		if (!translations.types.rlMap.has(c.rl)) translations.types.rlMap.set(c.rl, c);
		translations.types.rawMap.set(c.raw, c);
	});

}
