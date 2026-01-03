@IEBH/Reflib
============
Reference library processing for Node.

This library provides various read/write functionality to process citation libraries and handle individual references (henceforth "Refs").

This module forms part of the [Systematic Review Accelerator](https://sr-accelerator.com)


Compatibility
=============

| Library                | Extension(s)    | Read               | Write              |
|------------------------|-----------------|--------------------|--------------------|
| BibTeX                 | `.bib`          | :x:                | :x:                |
| Comma Separated Values | `.csv`          | :x:                | :x:                |
| EndNote ENL            | `.enl`          | :heavy_check_mark: | (untested)         |
| EndNote ENLX           | `.enlx`         | :heavy_check_mark: | :x:                |
| EndNote XML            | `.xml`          | :heavy_check_mark: | :heavy_check_mark: |
| JSON                   | `.json`         | :heavy_check_mark: | :heavy_check_mark: |
| Medline                | `.nbib`         | :heavy_check_mark: | :heavy_check_mark: |
| RIS                    | `.ris`          | :heavy_check_mark: | :heavy_check_mark: |
| Tab Separated Values   | `.tsv`          | :x:                | :x:                |


**Notes on different formats**:

* Medline seems to implement a totally different [publication type system](https://www.nlm.nih.gov/mesh/pubtypes.html) than others. Reflib will attempt to guess the best match, storing the original type in the `medlineType` key. Should the citation library be exported _back_ to Medline / `.nbib` files this key will take precedence to avoid data loss


Reference Structure
===================
Reflib creates a simple Plain-Old-JavaScript-Object (POJO) for each reference it parses, or writes to a file format when given a collection of the same.

Each reference has the following standardized fields, these are translated from whatever internal format each module uses - e.g. the `TY` RIS field is automatically translated to `title`.


| Field            | Type            | Description                                                                            |
|------------------|-----------------|----------------------------------------------------------------------------------------|
| recNumber        | `Number`        | The sorting number of the reference. Not present in RIS files                          |
| type             | `String`        | A supported [reference type](#reference-types) (e.g. journalArticle)                   |
| title            | `String`        | The reference's main title                                                             |
| journal          | `String`        | The reference's secondary title, this is usually the journal for most published papers |
| authors          | `Array<String>` | An array of each Author in the originally specified format                             |
| date             | `String`        | The raw, internal date of the reference                                                |
| urls             | `Array<String>` | An array of each URL for the reference                                                 |
| pages            | `String`        | The page reference, usually in the format `123-4`                                      |
| volume           | `String`        |                                                                                        |
| number           | `String`        |                                                                                        |
| isbn             | `String`        |                                                                                        |
| abstract         | `String`        |                                                                                        |
| label            | `String`        |                                                                                        |
| caption          | `String`        |                                                                                        |
| notes            | `String`        |                                                                                        |
| address          | `String`        |                                                                                        |
| researchNotes    | `String`        |                                                                                        |
| keywords         | `Array<String>` | Optional list of keywords that apply to the reference                                  |
| accessDate       | `String`        |                                                                                        |
| accession        | `String`        | [Accession numbers spec](https://support.nlm.nih.gov/knowledgebase/article/KA-03434/en-us), can sometimes be the PubMed ID |
| doi              | `String`        |                                                                                        |
| section          | `String`        |                                                                                        |
| language         | `String`        |                                                                                        |
| researchNotes    | `String`        |                                                                                        |
| databaseProvider | `String`        |                                                                                        |
| database         | `String`        |                                                                                        |
| workType         | `String`        |                                                                                        |
| custom1          | `String`        |                                                                                        |
| custom2          | `String`        |                                                                                        |
| custom3          | `String`        |                                                                                        |
| custom4          | `String`        |                                                                                        |
| custom5          | `String`        |                                                                                        |
| custom6          | `String`        |                                                                                        |
| custom7          | `String`        |                                                                                        |


Reference Types
---------------
As with refs the following ref types are supported and translated from the module internal formats.


```
aggregatedDatabase
ancientText
artwork
audioVisualMaterial
bill
blog
book
bookSection
case
catalog
chartOrTable
classicalWork
computerProgram
conferencePaper
conferenceProceedings
dataset
dictionary
editedBook
electronicArticle
electronicBook
electronicBookSection
encyclopedia
equation
figure
filmOrBroadcast
generic
governmentDocument
grant
hearing
journalArticle
legalRuleOrRegulation
magazineArticle
manuscript
map
music
newspaperArticle
onlineDatabase
onlineMultimedia
pamphlet
patent
personalCommunication
report
serial
standard
statute
thesis
unknown
unpublished
web
```



API
===
Each API is available either from the default `reflib` object or as a separate import.


```javascript
import reflib from 'reflib'; // Import everything as `reflib`
reflib.readFile(path);
reflib.writeFile(path, refs);


import {readFile, writeFile} from 'reflib'; // Import specific functions
readFile(path);
writeFile(path, refs);
```


formats
=======
Available: Node + Browser
A lookup object of all supported citation library formats.
Each key is the unique ID of that module.

Properties are:

| Key          | Type            | Description                                                            |
|--------------|-----------------|------------------------------------------------------------------------|
| `id`         | `String`        | The unique ID of that module (same as object key)                      |
| `title`      | `String`        | Longer, human readable title of the module                             |
| `titleShort` | `String`        | Shorter, human readable title of the module                            |
| `ext`        | `Array<String>` | Array of output file extensions, first extension should be the default |
| `canRead`    | `boolean`       | Whether the format is supported when reading a citation library        |
| `canWrite`   | `boolean`       | Whether the format is supported when writing a citation library        |


identifyFormat(path)
====================
Available: Node + Browser
Attempt to determine the format of a file on disk from its path. The file does not need to actually exist.

```javascript
identifyFormat('My Refs.csv') //= csv
identifyFormat('My Refs.json') //= json
identifyFormat('My Refs.nbib') //= nbib
identifyFormat('My Refs.txt.ris') //= ris
identifyFormat('MY REFS.TXT.RIS') //= ris
identifyFormat('My Refs.data.tsv') //= tsv
identifyFormat('My Refs.xml') //= endnoteXml
```


readFile(path, options)
=======================
Available: Node
Read a file on disk, returning a Promise which will resolve with an array of all Refs extracted.

```javascript
reflib.readFile('./data/json/json1.json')
	.then(refs => /* Do something with Ref collection */)
```

An emitter is available to track progress while reading. Note that due to the chainable nature of promises the first return contains the `emitter` key only:

```javascript
let reader = reflib.readFile('./data/json/json1.json');

reader.emitter
	.on('progress', ({readBytes, totalSize, refsFound}) => /* Report progress somehow */);
	.on('end', ({refsFound}) => /* Report progress somehow */);

reader
	.then(refs => /* Do something with Ref collection */)
```

uploadFile(options)
===================
Available: Browser
Prompt the user for a file and process it into an array of citations.

```javascript
reflib.uploadFile({ // Additional options
	file, // Optional File object if known, if omitted this function will prompt the user to select a file
	onStart, // Async function called as `(File)` when starting the read stage
	onProgress, // Function called as `(position, totalSize)` when processing the file
	onEnd, // Async function called as `()` when the read stage has completed
})
	.then(refs => /* Do something with Ref collection */)
```


writeFile(path, refs, options)
==============================
Available: Node
Write a file back to disk, returning a Promise which will resolve when done.

```javascript
reflib.writeFile('MyRefs.xml', refs);
```



readStream(moduleId, inputStream, options)
==========================================
Available: Node + Browser
Low level worker of `readFile()`.
Accept an input Stream.Readable and return a emitter which will emit each Ref found.

```javascript
reflib.readStream('json', createReadStream('./data/json/json1.json'))
	.on('end', ()=> /* Finished reading */)
	.on('error', err => /* Deal with errors */)
	.on('ref', ref => /* Do something with extracted Ref */)
```


writeStream(moduleId, outputStream, options)
============================================
Available: Node + Browser
Low level worker of `writeFile()`.
Return an object with methods to call to write to a given stream.
The returned object will have a `start()`, `end()` and `write(ref)` (optional `middle(ref)`) function which can be called to write to the original input stream.

```javascript
// Convert a JSON file to EndNoteXML via a stream
let output = reflib.writeStream('json', createWriteStream('./MyRefs.xml'));

output.start(); // Begin stream writing

reflib.readStream('json', createReadStream('./data/json/json1.json'))
	.on('ref', ref => output.write(ref))
	.on('end', ()=> output.end())
```


Credits
=======
Developed for the [Bond University Institute for Evidence-Based Healthcare](https://iebh.bond.edu.au).
Please contact [the author](mailto:matt_carter@bond.edu.au) with any issues.
