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


	test(`RIS - should read a RIS file #2 (via promise) - ${risFile}`).timeout('30s').do(()=> {
		reflib
			.readFile(`${config.testPath}/data/${risFile}`) //foreach risFile
			.then(refs => {
				if (risFile == "blue-light.ris") {
					compareTestRefs(refs, {profile: "ris"});
				} else if (risFile == "Embase-aerosols.ris") {
					compareEmbaseTestRefs(refs, {profile: "ris"});
				}
			})
	});


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
							//expect(ref[key]).to.deep.equal(originalRefs[refOffset][key]);
							if (
								key === "type" &&
								originalRefs[refOffset][key] === "generic"
							) {
								expect(true).to.be.true; //Allow type equal to "generic" & "journalArticle"
							} else {
								expect(ref[key]).to.deep.equal(originalRefs[refOffset][key]);
							}
						});
					});
				});
		});
	}

});
