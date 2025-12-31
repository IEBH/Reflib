import * as reflib from '../lib/default.js';
import {sortBy} from 'lodash-es';
import temp from 'temp';
import test, {expect} from '@momsfriendlydevco/testa';

import config from './config.js';


// OPTIONS
/**
* Options to tweak behaviour for the FORMAT-to-FORMAT conversion juggle tests
*
* @type {Object}
* @property {Set<String>} skipFields Named fields to ignore when comparing references
* @property {String} sortBy Field to sort reference sets by so they are (theoretically) identical arrays
* @property {Array<String>} files Files within `./test/data/` to compare
*/
let juggleOptions = {
	skipFields: new Set([
		// Add fields to ignore here
	]),
	sortBy: 'title',
	files: [
		// Commented out files are not yet supported
		'blue-light.enl',
		// 'blue-light.enlx',
		// 'blue-light.htm',
		// 'blue-light.js',
		'blue-light.json',
		// 'blue-light.nbib', // FIXME: File only has 80 refs?
		'blue-light.ris',
		// 'blue-light.rtf',
		// 'blue-light.txt',
		'blue-light.xml',
	],
};
// -------


juggleOptions.files
	.flatMap(item1 => juggleOptions.files.map(item2 => [item1, item2]))
	.forEach(([file1, file2]) => {
		let module1 = reflib.identifyFormat(file1);
		if (!module1) throw new Error(`Cannot identify input format for "${file1}"`);
		let module2 = reflib.identifyFormat(file2);
		if (!module2) throw new Error(`Cannot identify input format for "${file2}"`);

		let refs1, refs2; // Refs from file1 + file2

		test(`Juggle - Convert ${module1.id} -> ${module2.id}`).timeout('1m').do(t => Promise.resolve()
			.then(()=> t.stage(`Reading file "${file1}"`))
			.then(()=> Promise.all([
				reflib.readFile(`${config.testPath}/data/${file1}`),
				temp.path({prefix: `reflib-${module1.id}-to-${module2.id}-`, suffix: module2.ext[0]}),
			]))
			.then(([refs, outFile]) => {
				refs1 = refs;
				expect(refs).to.have.length(102);
				t.stage(`Writing ref file "${file2}"`);
				return reflib.writeFile(outFile, refs)
					.then(()=> outFile)
			})
			.then(outFile => {
				t.log(`Converted file available at ${outFile}`);
				t.stage(`Reading back "${file2}"`);
				return outFile;
			})
			.then(outFile => reflib.readFile(outFile))
			.then(refs => refs2 = refs)
			.then(()=> {
				t.stage('Sorting refs');
				refs1 = sortBy(refs1, juggleOptions.sortBy);
				refs2 = sortBy(refs1, juggleOptions.sortBy);
			})
			.then(()=> {
				t.stage('Comparing', refs1.length, 'references');
				expect(refs1).to.have.length(refs2.length);
				refs1.forEach((ref, refOffset) => {
					Object.keys(ref).forEach(k => {
						if (juggleOptions.skipFields.has(k)) return;
						let val1 = refs1[refOffset][k];
						let val2 = refs2[refOffset][k];

						expect(val1).to.not.equal(undefined, `REF[${refOffset}].${k} (${module1.id})`);
						expect(val2).to.not.equal(undefined, `REF[${refOffset}].${k} (${module2.id})`);
						expect(refs1[refOffset][k]).to.deep.equal(refs2[refOffset][k], `Mismatch for REF[${refOffset}].${k}`);
					})
				});
			})
		)
	})
