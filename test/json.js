import fakeStreams from './fakeStreams.js';
import test, {expect} from '@momsfriendlydevco/testa';
import {compareTestRefs} from './data/blue-light.js';
import {createReadStream, createWriteStream} from 'node:fs';
import * as reflib from '../lib/default.js';
import temp from 'temp';
import {writeFile} from 'node:fs/promises';

import config from './config.js';


test('JSON - parse a JSON file #1 (via stream reader)').timeout('30s').do(()=> Promise.resolve()
	.then(()=> new Promise((resolve, reject) => { // Read JSON file via emitter
		let refs = [];

		reflib.readStream('json', createReadStream(`${config.testPath}/data/blue-light.json`))
			.on('end', ()=> resolve(refs))
			.on('error', reject)
			.on('ref', ref => refs.push(ref))
	}))
	.then(refs => compareTestRefs(refs))
);


test('should read a JSON file #2 (via promise)').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.json`))
	.then(refs => compareTestRefs(refs))
);


test('JSON - write a JSON file #1 (via promise)').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
	return Promise.resolve()
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.json`))
		.then(refs => reflib.writeFile(tempPath, refs))
		.then(()=> t.log(`JSON file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath))
		.then(refs => {
			expect(refs).to.be.an('array');
			expect(refs).to.have.length(102);
			return compareTestRefs(refs);
		})
});


test('JSON - stream a JSON file').timeout('30s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
	return new Promise((resolve, reject) => {
		let output = reflib.writeStream('json', createWriteStream(tempPath));

		output.start();

		reflib.readStream('json', createReadStream(`${config.testPath}/data/blue-light.json`))
			.on('ref', ref => output.write(ref))
			.on('end', ()=> output.end().then(resolve))
			.on('error', reject)
	})
		.then(()=> t.log(`JSON file available at ${tempPath}`))
		.then(()=> reflib.readFile(tempPath))
		.then(refs => {
			expect(refs).to.be.an('array');
			return compareTestRefs(refs);
		})
});


test('JSON - run a parse -> write -> parse test with all references').timeout('1m').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
	let originalRefs;
	return Promise.resolve()
		.then(()=> t.stage('Reading ref file'))
		.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.json`))
		.then(refs => {
			expect(refs).to.have.length(102);
			originalRefs = refs;
		})
		.then(()=> t.stage('Writing ref file'))
		.then(()=> reflib.writeFile(tempPath, originalRefs))
		.then(()=> t.log(`JSON file available at ${tempPath}`))
		.then(()=> t.stage('Re-reading ref file'))
		.then(()=> reflib.readFile(tempPath))
		.then(newRefs => {
			t.stage('Comparing', newRefs.length, 'references');
			newRefs.forEach((ref, refOffset) =>
				expect(ref).to.deep.equal(originalRefs[refOffset])
			);
		})
});


test('JSON - reject malformed JSON instead of hanging').timeout('5s').do(t => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.json'});
	return Promise.resolve()
		.then(()=> t.stage('Via stream reader'))
		.then(()=> new Promise((resolve, reject) => {
			reflib.readStream('json', fakeStreams.readStream('[{"title": "A"}, {broken'))
				.on('end', ()=> reject(new Error('Stream ended without an error event')))
				.on('error', resolve);
		}))
		.then(e => {
			t.dump(e);
			expect(e).to.be.an.instanceOf(Error);
		})
		.then(()=> t.stage('Via readFile'))
		.then(()=> writeFile(tempPath, '[{"title": "A"}, {broken'))
		.then(()=> reflib.readFile(tempPath))
		.then(
			()=> { throw new Error('readFile should have rejected') },
			e => expect(e).to.be.an.instanceOf(Error),
		)
});

