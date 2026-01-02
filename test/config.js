import fspath from 'node:path';

export default {
	testPath: fspath.resolve(fspath.dirname(decodeURI(new URL(import.meta.url).pathname))),
};
