import test, {expect} from '@momsfriendlydevco/testa';
import {getRefDoi} from '../lib/default.js';
import * as reflib from '../lib/default.js';

import config from './config.js';


test('getRefDoi - update DOI in the reference object if it has the prefix').timeout('1m').do(async ()=> {
	const filePath = `${config.testPath}/data/Dump-Converted test.xml`;
	// console.log("File path:", filePath);
	let library = await reflib.readFile(filePath);

	library.forEach(ref => {
		const originalDoi = ref.doi;
		const doiResult = getRefDoi(ref); // This will now return just the DOI value
		// console.log("Inside", originalDoi, "-->", doiResult);

		if (originalDoi) {
			if (originalDoi.startsWith('https://dx.doi.org/')) {
				const expectedDoi = originalDoi.replace('https://dx.doi.org/', '');
				expect(doiResult).to.equal(expectedDoi);
			} else {
				expect(doiResult).to.equal(originalDoi);
			}
		} else {
			expect(doiResult).to.be.null;
		}
	});
});
