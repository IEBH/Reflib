import {dirname} from 'node:path';
import {execa} from 'execa';
import {fileURLToPath} from 'node:url';
import reflib from '../lib/default.js';
import test, {expect} from '@momsfriendlydevco/testa';
import temp from 'temp';

const __dirname = dirname(fileURLToPath(import.meta.url));
let binPath = `${__dirname}/../app.js`;


test('Probe CLI version', async (t) => {
	let {stdout} = await execa(binPath, ['--version']);
	expect(stdout).to.match(/^Version: \d\.\d\.\d$/);
});


test('Output an EndNoteXML file to STDOUT', async (t) => {
	let {stdout} = await execa(binPath, [
		'--input',
		`${__dirname}/data/blue-light.xml`,
	]);

	expect(()=> JSON.parse(stdout)).to.not.throw;
});


test('Convert an EndNoteXML file to BibTeX', async (t) => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.bib'});

	t.stage('Convert XML -> BIB');
	let {stdout} = await execa(binPath, [
		'--input',
		`${__dirname}/data/blue-light.xml`,
		'--output',
		tempPath,
		'--verbose',
	]);

	t.stage('Check output file');
	let refs = await reflib.readFile(tempPath);
	expect(refs).to.be.an('array');
	expect(refs).to.have.length(102);
});
