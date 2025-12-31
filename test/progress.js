import test, {expect} from '@momsfriendlydevco/testa';
import * as reflib from '../lib/default.js';

import config from './config.js';

Object.entries(reflib.formats)
	.filter(([, format]) => format.canRead)
	.forEach(([module, format]) =>
		test(`${module} - progress reporting while parsing`).timeout('30s').do(t => new Promise((resolve, reject) => {
			let readBytes = 0; // eslint-disable-line no-unused-vars

			let reader = reflib.readFile(`${config.testPath}/data/blue-light${format.ext[0]}`)

			reader.emitter
				.on('progress', ({readBytes, totalSize, refsFound}) =>
					t.log('Reading', module, readBytes, '/', totalSize, '~', refsFound, 'refs')
				)
				.on('error', reject)
				.on('end', ({refsFound})=> {
					expect(refsFound).to.be.above(0);
					resolve();
				})
		}))
	);
