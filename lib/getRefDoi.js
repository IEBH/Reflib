/**
* Identify a DOI with a URL or scheme prefix (e.g. 'https://dx.doi.org/10.1186/s40504-020-00106-2'), strip the prefix so only the bare DOI remains (e.g. '10.1186/s40504-020-00106-2') and update the ref in place
*
* Handled prefixes: `http(s)://doi.org/`, `http(s)://dx.doi.org/`, `doi.org/`, `dx.doi.org/` and `doi:`
*
* @param {Object} ref The input object to identify and change DOI format
* @returns {string|null} The modified DOI or null if no DOI is available
*/
export function getRefDoi(ref) {
	if (!ref.doi) return null;

	ref.doi = ('' + ref.doi)
		.trim()
		.replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\/|^doi:\s*/i, '');

	return ref.doi;
}
