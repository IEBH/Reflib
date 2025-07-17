import {defineConfig, globalIgnores} from "eslint/config";
import RulesMFDC from '@momsfriendlydevco/eslint-config';

export default defineConfig([
	globalIgnores([
		'.*',
		'docs/',
		'dist/',
		'node_modules/',
		'public/',
		'**/.wrangler/',
	]),
	...RulesMFDC,
])
