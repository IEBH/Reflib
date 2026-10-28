import fakeStreams from './fakeStreams.js';
import test, {expect} from '@momsfriendlydevco/testa';
import {compareTestRefs} from "./data/blue-light.js";
import {compareEmbaseTestRefs} from "./data/Embase-aerosols.js";
import {createReadStream, createWriteStream} from "node:fs";
import * as reflib from "../lib/default.js";
import temp from "temp";

import config from './config.js';

[
	'blue-light.ris',
	'Embase-aerosols.ris',
].forEach(risFile => {

	test(`RIS - parse a RIS file #1 (via stream reader) - ${risFile}`).timeout('30s').do(()=> Promise.resolve()
		.then(() => new Promise((resolve, reject) => {
			let refs = [];
			reflib
				.readStream(
					"ris",
					createReadStream(`${config.testPath}/data/${risFile}`) //foreach risFile
				)
				.on("end", () => resolve(refs))
				.on("error", reject)
				.on("ref", (ref) => refs.push(ref));
		}))
		.then((refs) => {
			if (risFile == "blue-light.ris")
				compareTestRefs(refs, { profile: "ris" });
			if (risFile == "Embase-aerosols.ris")
				compareEmbaseTestRefs(refs, { profile: "ris" });
		})
	);


	test(`RIS - should read a RIS file #2 (via promise) - ${risFile}`).timeout('30s').do(()=> reflib
		.readFile(`${config.testPath}/data/${risFile}`) //foreach risFile
		.then(refs => {
			if (risFile == "blue-light.ris") {
				compareTestRefs(refs, {profile: "ris"});
			} else if (risFile == "Embase-aerosols.ris") {
				compareEmbaseTestRefs(refs, {profile: "ris"});
			}
		})
	);


	test(`RIS - should write a RIS file #1 (via promise)- ${risFile}`).timeout('30s').do(t => {
		let tempPath = temp.path({ prefix: "reflib-", suffix: ".ris" });
		return Promise.resolve()
			.then(() => reflib.readFile(`${config.testPath}/data/${risFile}`)) //foreach risFile
			.then(refs => reflib.writeFile(tempPath, refs))
			.then(() => t.log(`RIS file available at ${tempPath}`))
			.then(() => reflib.readFile(tempPath))
			//.then((refs) => compareTestRefs(refs, { profile: "ris" }));
			.then(refs => {
				if (risFile == "blue-light.ris") {
					compareTestRefs(refs, {profile: "ris"});
				} else if (risFile == "Embase-aerosols.ris") {
					compareEmbaseTestRefs(refs, {profile: "ris"});
				}
			})
	});


	test(`RIS - should stream a RIS file - ${risFile}`).timeout('30s').do(t => {
		let tempPath = temp.path({ prefix: "reflib-", suffix: ".ris" });
		return new Promise((resolve, reject) => {
			let output = reflib.writeStream("ris", createWriteStream(tempPath));

			output.start();

			reflib
				.readStream("ris", createReadStream(`${config.testPath}/data/${risFile}`)) //foreach risFile
				.on("ref", (ref) => output.write(ref))
				.on("end", () => output.end().then(resolve))
				.on("error", reject);
		})
			.then(() => t.log(`RIS file available at ${tempPath}`))
			.then(() => reflib.readFile(tempPath))
			//.then((refs) => compareTestRefs(refs, { profile: "ris" }));
			.then((refs) => {
				if (risFile == "blue-light.ris")
					compareTestRefs(refs, { profile: "ris" });
				if (risFile == "Embase-aerosols.ris")
					compareEmbaseTestRefs(refs, { profile: "ris" });
			})
	});


	if (risFile === "blue-light.ris") {
		test(`RIS - should run a parse -> write -> parse test with all references - ${risFile}`).timeout('1m').do(t => {
			let tempPath = temp.path({ prefix: "reflib-", suffix: ".ris" });
			let originalRefs;
			return Promise.resolve()
				.then(() => t.stage("Reading ref file"))
				.then(() => reflib.readFile(`${config.testPath}/data/${risFile}`)) //foreach risFile
				.then((refs) => {
					expect(refs).to.have.length(102);
					originalRefs = refs;
				})
				.then(() => t.stage("Writing ref file"))
				.then(() => reflib.writeFile(tempPath, originalRefs))
				.then(() => t.log(`RIS file available at ${tempPath}`))
				.then(() => t.stage("Re-reading ref file"))
				.then(() => reflib.readFile(tempPath))
				.then((newRefs) => {
					t.stage("Comparing", newRefs.length, "references");
					newRefs.forEach((ref, refOffset) => {
						Object.keys(originalRefs[refOffset]).forEach((key) => {
							expect(ref).to.have.property(key);
							expect(ref[key]).to.deep.equal(originalRefs[refOffset][key]);
						});
					});
				});
		});
	}


	if (risFile === "Embase-aerosols.ris") {
		test(`RIS - should run a parse -> write -> parse test with all references - ${risFile}`).timeout('1m').do(t => {
			let tempPath = temp.path({ prefix: "reflib-", suffix: ".ris" });
			let originalRefs;
			return Promise.resolve()
				.then(() => t.stage("Reading ref file"))
				.then(() => reflib.readFile(`${config.testPath}/data/${risFile}`)) //foreach risFile
				.then((refs) => {
					expect(refs).to.have.length(3225);
					originalRefs = refs;
				})
				.then(() => t.stage("Writing ref file"))
				.then(() => reflib.writeFile(tempPath, originalRefs))
				.then(() => t.log(`RIS file available at ${tempPath}`))
				.then(() => t.stage("Re-reading ref file"))
				.then(() => reflib.readFile(tempPath))
				.then((newRefs) => {
					t.stage("Comparing", newRefs.length, "references");
					newRefs.forEach((ref, refOffset) => {
						Object.keys(originalRefs[refOffset]).forEach((key) => {
							if (originalRefs[refOffset][key] === "") return; //Allow some propertys' content are empty (EXP. SN  - 0028-2162 => AD is empty (Embase-aerosols.ris))
							expect(ref).to.have.property(key);
							expect(ref[key]).to.deep.equal(originalRefs[refOffset][key]);
						});
					});
				});
		});
	}

});


/**
* Read a RIS string via the stream reader
*
* @param {String} content RIS content to parse
* @param {Object} [options] Options to pass to the reader
* @returns {Promise<Array<Object>>} The parsed references
*/
function readRis(content, options) {
	return new Promise((resolve, reject) => {
		let refs = [];
		reflib.readStream('ris', fakeStreams.readStream(content), options)
			.on('ref', ref => refs.push(ref))
			.on('end', ()=> resolve(refs))
			.on('error', reject);
	});
}


/**
* Write references to a RIS string via the stream writer
*
* @param {Array<Object>} refs References to write
* @param {Object} [options] Options to pass to the writer
* @returns {Promise<String>} The written RIS content
*/
function writeRis(refs, options) {
	let fakeWriter = fakeStreams.writeStream();
	let stream = reflib.writeStream('ris', fakeWriter, options);
	return Promise.resolve()
		.then(()=> stream.start())
		.then(()=> refs.reduce((chain, ref) => chain.then(()=> stream.write(ref)), Promise.resolve()))
		.then(()=> stream.end())
		.then(()=> fakeWriter.contents());
}


test('RIS - write the correct TY for each reference type').do(t => Promise.resolve()
	.then(()=> writeRis([
		{type: 'journalArticle', title: 'A'},
		{type: 'book', title: 'B'},
		{type: 'thesis', title: 'C'},
		{type: 'personalCommunication', title: 'D'},
		{type: 'filmOrBroadcast', title: 'E'},
		{title: 'F'}, // No type - should use the default
	]))
	.then(contents => {
		t.dump(contents);
		expect(contents.match(/^TY {2}- .*$/gm)).to.deep.equal([
			'TY  - JOUR',
			'TY  - BOOK',
			'TY  - THES',
			'TY  - PCOMM',
			'TY  - VIDEO',
			'TY  - JOUR',
		]);
	})
);


test('RIS - reference types survive a write -> read cycle').do(t => Promise.resolve()
	.then(()=> writeRis([
		{type: 'book', title: 'A'},
		{type: 'generic', title: 'B'},
		{type: 'report', title: 'C'},
	]))
	.then(contents => readRis(contents))
	.then(refs => {
		t.dump(refs);
		expect(refs.map(r => r.type)).to.deep.equal(['book', 'generic', 'report']);
	})
);


test('RIS - keep pipe characters within values').do(t => Promise.resolve()
	.then(()=> readRis([
		'TY  - JOUR',
		'TI  - Foo | Bar',
		'AB  - Alpha | Beta',
		'  Gamma | Delta',
		'KW  - one | two',
		'ER  - ',
		'',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs).to.deep.equal([{
			type: 'journalArticle',
			title: 'Foo | Bar',
			abstract: 'Alpha | Beta\r  Gamma | Delta',
			keywords: ['one | two'],
		}]);
	})
);


test('RIS - treat a blank field with no trailing space as a field, not a continuation line').do(t => Promise.resolve()
	.then(()=> readRis([
		'TY  - JOUR',
		'KW  - alpha',
		'AB  -',
		'N1  - ',
		'TI  - Title',
		'ER  - ',
		'',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs).to.deep.equal([{
			type: 'journalArticle',
			keywords: ['alpha'],
			abstract: '',
			notes: '',
			title: 'Title',
		}]);
	})
);


test('RIS - honour the convertAbstract and convertCity options').do(t => {
	let content = [
		'TY  - JOUR',
		'TI  - Title',
		'N2  - Fallback abstract',
		'CY  - London',
		'ER  - ',
		'',
	].join('\n');

	return Promise.resolve()
		.then(()=> Promise.all([
			readRis(content),
			readRis(content, {convertAbstract: false, convertCity: false}),
		]))
		.then(([converted, raw]) => {
			t.dump({converted, raw});
			expect(converted[0]).to.have.property('abstract', 'Fallback abstract');
			expect(converted[0]).to.not.have.property('fallbackAbstract');
			expect(converted[0]).to.have.property('city', 'London');
			expect(converted[0]).to.not.have.property('fallbackCity');

			expect(raw[0]).to.have.property('fallbackAbstract', 'Fallback abstract');
			expect(raw[0]).to.not.have.property('abstract');
			expect(raw[0]).to.have.property('fallbackCity', 'London');
			expect(raw[0]).to.not.have.property('city');
		})
});


test('RIS - convert city even when an abstract is present and keep it over a write -> read cycle').do(t => Promise.resolve()
	.then(()=> readRis([
		'TY  - JOUR',
		'TI  - Title',
		'AB  - Abstract',
		'CY  - London',
		'ER  - ',
		'',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs[0]).to.have.property('city', 'London');
		return writeRis(refs);
	})
	.then(contents => {
		t.dump(contents);
		expect(contents).to.match(/^CY {2}- London$/m);
		return readRis(contents);
	})
	.then(refs => {
		expect(refs[0]).to.have.property('city', 'London');
		expect(refs[0]).to.have.property('abstract', 'Abstract');
	})
);



test('RIS - map the ID tag to recNumber in both directions').do(t => Promise.resolve()
	.then(()=> readRis([
		'TY  - JOUR',
		'ID  - 895',
		'TI  - Title',
		'ER  - ',
		'',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs[0]).to.have.property('recNumber', '895');
		return writeRis(refs);
	})
	.then(contents => {
		t.dump(contents);
		expect(contents).to.match(/^ID {2}- 895$/m);
	})
);


test('RIS - map ST and OP tags to titleShort and originalPublication').do(t => Promise.resolve()
	.then(()=> readRis([
		'TY  - JOUR',
		'TI  - Full title',
		'ST  - Short title',
		'OP  - Original publication',
		'ER  - ',
		'',
	].join('\n')))
	.then(refs => {
		t.dump(refs);
		expect(refs[0]).to.have.property('titleShort', 'Short title');
		expect(refs[0]).to.have.property('originalPublication', 'Original publication');
		return writeRis(refs);
	})
	.then(contents => {
		t.dump(contents);
		expect(contents).to.match(/^ST {2}- Short title$/m);
		expect(contents).to.match(/^OP {2}- Original publication$/m);
	})
);
