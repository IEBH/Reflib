import test, {expect} from '@momsfriendlydevco/testa';
import {compareTestRefs} from './data/blue-light.js';
import {createReadStream, createWriteStream} from 'node:fs';
import * as reflib from '../lib/default.js';
import fspath from 'node:path';
import temp from 'temp';

import config from './config.js';

let medlineOptions = {
	read: {
		journal: 'short', // Use short journal name to match up with JSON tests
	},
	write: {},
};


test('Medline - should parse a Medline file #1 (via stream reader)').timeout('30s').do(()=> Promise.resolve()
	.then(()=> new Promise((resolve, reject) => {
		let refs = [];

		reflib.readStream('medline', createReadStream(`${config.testPath}/data/blue-light.nbib`), medlineOptions.read)
			.on('end', ()=> resolve(refs))
			.on('error', reject)
			.on('ref', ref => refs.push(ref))
	}))
	.then(refs => compareTestRefs(refs, {profile: 'medline'}))
);


test('Medline - should read a Medline file #2 (via promise)').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.nbib`, medlineOptions.read))
	.then(refs => compareTestRefs(refs, {profile: 'medline'}))
);


test('Medline - should write a Medline file #1 (via promise)').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.nbib'});
	return Promise.resolve()
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.nbib`, medlineOptions.read))
		.then(refs => reflib.writeFile(tempPath, refs, medlineOptions.write))
		.then(()=> t.log(`Medline file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath, medlineOptions.read))
		.then(refs => compareTestRefs(refs, {profile: 'medline'}))
});


test('Medline - should stream a Medline file').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.nbib'});
	return new Promise((resolve, reject) => {
		let output = reflib.writeStream('medline', createWriteStream(tempPath), medlineOptions.write);

		output.start();

		reflib.readStream('medline', createReadStream(`${config.testPath}/data/blue-light.nbib`), medlineOptions.read)
			.on('ref', ref => output.write(ref))
			.on('end', ()=> output.end().then(resolve))
			.on('error', reject)
	})
		.then(()=> t.log(`Medline file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath), medlineOptions.read)
		.then(refs => compareTestRefs(refs, {profile: 'medline'}))
});


test('Medline - should run a parse -> write -> parse test with all references').timeout('1m').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.nbib'});
	let originalRefs;
	let ignoreKeys = new Set(['address', 'medlineAuthorsAffiliation']); // Fields that don't carry over

	return Promise.resolve()
		.then(()=> t.stage('Reading ref file'))
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.nbib`), medlineOptions.read)
		.then(refs => originalRefs = refs)
		.then(()=> t.stage('Writing ref file'))
		.then(()=> reflib.writeFile(tempPath, originalRefs, medlineOptions.write))
		.then(()=> t.log(`Medline file available at ${tempPath}`))
		.then(()=> t.stage('Re-reading ref file'))
		.then(()=> reflib.readFile(tempPath), medlineOptions.read)
		.then(newRefs => {
			t.stage('Comparing', newRefs.length, 'references');
			newRefs.forEach((ref, refOffset) => {
				Object.keys(originalRefs[refOffset])
					.filter(key => !ignoreKeys.has(key))
					.forEach(key => {
						// console.log('CMP', key);
						expect(ref).to.have.property(key);
						expect(ref[key]).to.deep.equal(originalRefs[refOffset][key]);
					})
			});
		})
});
