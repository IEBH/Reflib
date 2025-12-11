import { expect } from 'chai';

/**
* Manual coding for example references, these are compared in each respective `test/${module}.js` test kit
* @type {array<Object>}
*/
export let testRefs = [
      { // First reference in series
            type: 'journalArticle',
            date: '2026',
            volume: '112',
            //isbn: ['1746-8108', '1746-8094'],
            isbn: '1746-8094',
            journal: 'Biomedical Signal Processing and Control',
            urls: [
                  'https://www.embase.com/search/results?subaction=viewrecord&id=L2040010236&from=export',
                  'http://dx.doi.org/10.1016/j.bspc.2025.108531',
                  'https://libkey.io/libraries/1432/gotofulltext/openurl?sid=EMBASE&sid=EMBASE&issn=17468108&id=doi:10.1016%2Fj.bspc.2025.108531&atitle=Multi-task+deep+learning+for+bacilli+detection+and+counting+in+sputum+smear+microscopy&stitle=Biomed.+Signal+Process.+Control&title=Biomedical+Signal+Processing+and+Control&volume=112&issue=&spage=&epage=&aulast=de+Carvalho+Brito&aufirst=Vit%C3%B3ria&auinit=V.&aufull=de+Carvalho+Brito+V.&coden=&isbn=&pages=-&date=2026&auinit1=V&auinitm='
            ],
            database: 'Embase',
            doi: '10.1016/j.bspc.2025.108531',
            authors: [
                  'de Carvalho Brito, V.',
                  'dos Santos, P.R.S.',
                  'de Carvalho Filho, A.O.',
                  'Diniz, J.O.B.'
            ],
            address: 'A.O. de Carvalho Filho, Department of Information Systems, Federal University of Piauí, R. Cícero Duarte, PI, Picos, Brazil',
            title: 'Multi-task deep learning for bacilli detection and counting in sputum smear microscopy',
            language: 'English',
            keywords: [
                  'article',
                  'Bacilli',
                  'Bacillus',
                  'bacterial count',
                  'bacterium detection',
                  'behavior change',
                  'collaborative learning',
                  'comparative study',
                  'controlled study',
                  'deep learning',
                  'false positive result',
                  'image analysis',
                  'image reconstruction',
                  'morphology',
                  'nonhuman',
                  'patient monitoring',
                  'sputum',
                  'sputum analysis',
                  'sputum smear'
            ],
            fallbackAbstract: 'Tuberculosis is an infectious disease that mainly affects the lungs. Transmission occurs through the air when infected patients cough, sneeze, or spit. Despite being the second leading cause of death from infection, tuberculosis is curable, and the patient has a greater chance of a complete recovery when diagnosed and treated early, also reducing the risk of transmission. Sputum smear microscopy is a traditional method for diagnosis and treatment monitoring, where the specialist analyzes sputum samples to detect the presence of bacilli. The literature has explored computational approaches to support specialists through slide image analysis. In this study, we proposed a solution using the multi-task learning strategy, where two models share learning during training to execute their tasks. The first model generates density maps highlighting locations with the presence of bacilli, while the second performs regression of the amount of bacilli on the map. The results showed PSNR of 20.75, BA of 0.87, F1 of 0.72, AP of 0.53, R2 of 0.78, and MSE of 5.14 using fine-tuning and spatial and intensity data augmentation operations. Despite the complexity of the problem, the method produced consistent and encouraging results in both tasks, extracting important characteristics of the bacilli and a final count based on the shared learning of the two networks. This solution can integrate into clinical workflows by providing a second opinion to assist specialists in validating their diagnosis and monitoring bacillus count over time. The learned density maps can assist in confirming the bacillus count, helping clinicians assess disease severity.'
      }
]


/**
* Compare the incoming ref collection against the data that we know is valid
* "Valid" data is specified in `testRefs` above and should be considered pristine data
* @param {array<object>} refs Collection of input refs to compare against the known-correct data-set
* @param {Object} [options] Additional options to use when comparing
* @param {Array<String>} [options.keys] Keys to exclude when comparing ref-to-ref
* @param {string} [options.profile] Meta profile to set other options, see function for definitions
*/
export function compareEmbaseTestRefs(refs, options) {
      // Argument mangling {{{
      let settings = {
            excludeKeys: [],
            ...options,
      };
      if (['medline', 'ris'].includes(settings.profile)) settings.excludeKeys.push('recNumber');
      if (['medline'].includes(settings.profile)) settings.excludeKeys.push('address', 'isbn', 'notes', 'custom1', 'custom2');

      settings.excludeKeys = new Set(settings.excludeKeys); // Cast `excludeKeys` into a faster Set lookup
      // }}}

      expect(refs).to.be.an('array');
      // expect(refs).to.have.length(102);

      testRefs.forEach(originalRef => {
            let computedRef = refs.find(r => r.title == originalRef.title || r.recNumber == originalRef.recNumber);

            if (!computedRef) {
                  console.warn('Cannot find reference', {title: originalRef.title, recNumber: originalRef.recNumber});
                  expect.fail;
            }

            expect(computedRef).to.be.an('object');
            // console.log('Compare ref', {given: computedRef, wanted: originalRef});
            Object.entries(originalRef).forEach(([key, val]) => {
                  if (settings.excludeKeys.has(key)) return; // Ignore key if excluded
                  expect(computedRef).to.have.property(key);
                  //console.log('CMP', key, {given: computedRef[key], wanted: val});
                  expect(computedRef[key]).to.deep.equal(val, `Expected key ${key} to match`);
                  
            });
      });
}
