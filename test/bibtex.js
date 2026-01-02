import test, {expect} from '@momsfriendlydevco/testa';
import * as reflib from '../lib/default.js';

import config from './config.js';


test('BibTeX - should parse a file').timeout('30s').do(()=> Promise.resolve()
	.then(()=> reflib.readFile(`${config.testPath}/data/blue-light.bib`))
	.then(refs => {
		expect(refs).to.be.an('array');
		expect(refs).to.have.length(102);
	})
);
