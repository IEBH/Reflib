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


test('Output BibTeX to STDOUT without a trailing blank line', async (t) => {
	let {stdout} = await execa(binPath, [
		'--input',
		`${__dirname}/data/blue-light-tiny.xml`,
		'--format',
		'bibtex',
	], {stripFinalNewline: false});

	expect(stdout).to.match(/\}\n$/);
	expect(stdout).to.not.match(/\n\n$/);
	expect(stdout.match(/^@/gm)).to.have.length(10);
});


test('Honour --format when writing to a file', async (t) => {
	let tempPath = temp.path({prefix: 'reflib-', suffix: '.dat'});

	t.stage('Convert XML -> RIS into a file with an unknown extension');
	await execa(binPath, [
		'--input',
		`${__dirname}/data/blue-light-tiny.xml`,
		'--output',
		tempPath,
		'--format',
		'ris',
	]);

	t.stage('Check output file');
	let refs = await reflib.readFile(tempPath, {module: 'ris'});
	expect(refs).to.be.an('array');
	expect(refs).to.have.length(10);
	expect(refs[0]).to.have.property('type', 'journalArticle');
});

