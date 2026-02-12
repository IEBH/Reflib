// Define the function locally
function generateCitationKey(ref) {
  let author = 'Anon';
  if (ref.authors && ref.authors.length > 0) {
    // Use last name of first author
    author = ref.authors[0].split(',')[0];
  }

  let year = 'n.d.';
  if (ref.year) {
    year = ref.year;
  }

  return `${author}${year}`;
}

// Test cases
const testRefs = [
  { authors: ["Roomruangwong, Chutima"], year: 2020 },
  { authors: ["Smith, John"], year: 2018 },
  { authors: [], year: 2022 },
  { authors: ["Doe, Jane"] }, // no year
  {} // no authors, no year
];

testRefs.forEach(ref => {
  console.log(generateCitationKey(ref));
});
