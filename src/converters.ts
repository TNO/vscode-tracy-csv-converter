// This has to match the package.json contributes.commands.command value
export const COMMAND_ID = "extension.tracyCsvConverter";

// Make this something unique
export const SCHEME = 'vscodeTracyCsvConverter';


// Define converters here
function standardConvert(content: string) {
	const rows = content.split('\n').filter((l) => l.trim() !== '').map((l) => l.split(','));
	const headers = rows[0];
	return rows.slice(1).map((r) => {
		const row: {[s: string]: string} = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
}

// Define your own converter on runtime
export const COL_DELIMITERS: {[s: string]: string} = {
	'Comma ","'    	: ',',
	'Semicolon ";"'	: ';',
	'Colon ":"'		: ':',
	'Tab "\t"'		: '\t',
	'Line "|"'		: '|',
};
export const ROW_DELIMITERS: {[s: string]: string} = {
	'Newline "\n"'  		: '\n', // Unix and unix-like (also works for windows I believe because that uses \r\n)
	'Carriage Return "\r"'	: '\r', // old apple computers
	'Tab "\t"'				: '\t',
}
/**
 * A converter where almost all parameters can be determined on runtime.
 * @param content The content of a CSV file, including header
 * @param col_delimiter The column delimiter of the CSV file.
 * @param row_delimiter The row delimiter of the CSV file.
 * @param sort_by_column The column to sort by.
 * @returns A tracy object.
 */
function customSingleConverter(content: string, col_delimiter: string = ',', row_delimiter: string = '\n', sort_by_column: string | undefined) {
	const rows = content.split(row_delimiter) // split by row delimiter
		.filter((l) => l.trim() !== '') // remove leading and trailing whitespace
		.map((l) => l.split(col_delimiter)); // split by column delimiter and copy to new array
	const headers = rows[0];
	const to_be_sorted = rows.slice(1).map((r) => {
		const row: {[s: string]: string} = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
	if (sort_by_column) return to_be_sorted.sort((a: {[s: string]: string}, b: {[s: string]: string}) => {
		return a[sort_by_column] > b[sort_by_column] ? 1 : -1;
	});
	return to_be_sorted;
}

/**
 * Returns a likely candidate for a CSV file's column delimiter.
 * @param content A slice of CSV content that contains multiple rows. The bigger the slice, the more accurate this function becomes.
 * @param row_delimiter The row delimiter, default='\n'.
 * @returns A char which is occurs the same amount of times in each row.
 */
export function getColumnDelimiter(content: string, row_delimiter: string = '\n') {
	// this function assumes that the row delimiter is a newline
	// will start simple by checking the amount of chars of each row and checking if they are the same
	const rows = content.slice(0, content.lastIndexOf(row_delimiter)) // ensure only checking complete rows
		.split(row_delimiter).filter((l)=> l.trim() !== '');
	
	const char_counts = rows.map((row: string) => {
		// get the char count of a row
		let count: {[s: string]: number} = {};
		[...row].forEach(char => {
			if (!(char in count)) count[char] = 0;
			count[char] = count[char] + 1;
		});
		return count;
	});

	// only keep the chars that are present in each row, and occur the same amount of times
	const shared_char_counts = char_counts.reduce((prev_row, current_row) => {
		let intersect_chars: {[s: string]: number} = {};
		for (const char in prev_row) {
			if (current_row[char] === prev_row[char]) intersect_chars[char] = prev_row[char]; // keep only the chars that both rows have
		}
		return intersect_chars;
	});
	// console.log("Found delimiters: ", shared_char_counts);
	const shared_chars = Object.keys(shared_char_counts);
	if (shared_chars.length > 0) return shared_chars[0]; // TODO: is there a better way to get the option than taking the first char?
	// TODO: ask user what delimiter to use (show example text maybe?), instead of giving a default
	return ','; // if no shared character is found, return the default delimiter
}

/**
 * Automatic CSV converter.
 * @param content CSV file contents, with '\n' as the row delimiter.
 * @returns Tracy json of the input
 */
function autoCSVConverter(content: string): {[s: string]: string}[] {
	// Only use a slice of the string to compute the column delimiter, on account of efficiency
	const col_delimiter = getColumnDelimiter(content.slice(0, Math.min(5000, content.length)));
	const rows = content.split('\n').filter((l) => l.trim() !== '').map((l) => l.split(col_delimiter));
	const headers = rows[0];
	return rows.slice(1).map((r) => {
		const row: {[s: string]: string} = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	});
}

// List all converters here, key will be the name, value is the converter function
export const CONVERTERS: {[s: string]: (content: string, ...args: any[]) => {[s: string]: string}[]} = {
	'Auto converter'			: autoCSVConverter,
	'Using standard converter' 	: standardConvert,
	'Define custom converter' 	: customSingleConverter, // name is used in extension.ts and ConverterReactPanel.ts
}
// List all comparators here, key will be the name, value is the comparator function
export const COMPARATORS: {[s: string]: (a: string, b: string) => number} = {
	"String compare"		: (a: string, b: string) => a.localeCompare(b),
	"Date compare"			: (a, b) => (new Date(a).getTime() - new Date(b).getTime()),
}

/**
 * Combines and converts multiple CSV files into a single tracy file.
 * @param files The contents of the CSV files.
 * @param sort_column The column the multiple files will be sorted by.
 * @param comparator The comparator function for the sorting of the sort column.
 * @returns A single tracy object array.
 */
// TODO: could possibly combine the comparator and the sort_column
export function multiCSVtoTracyConverter(files: string[], sort_column: string = "timestamp", comparator: (a: string, b: string) => number = COMPARATORS["String compare"]) : {[s: string]: string}[] {
	// TODO: add multiple different headers options
	const tracy_docs = files.map(content => autoCSVConverter(content));
	// combine the files
	return multiTracyCombiner(tracy_docs, Array(files.length).fill(sort_column), comparator);
}

/**
 * Combines multiple instances of tracy object arrays.
 * @param contents The contents of the CSV files in tracy format.
 * @param sort_headers The headers that will be compared to each other for sorting the data.
 * @param comparator The comparator function for the sorting.
 * @returns A single tracy object array.
 */
export function multiTracyCombiner(contents: {[s: string]: string}[][], sort_headers: string[], comparator: (a: string, b: string) => number = COMPARATORS["String compare"]) : {[s: string]: string}[] {

	// Combine all headers
	const all_headers_array = Object.keys(contents.map(tracy_array => tracy_array[0]).reduce((prev, curr) => {
		return {...prev, ...curr};
	}));
	let all_headers: {[s: string]: string} = {};
	all_headers_array.forEach((key) => { all_headers[key] = ""; });
	

	return contents.reduce((prev, current, index) => {
		// assumption is that the "timestamp"s are already sorted in both prev and current
		// this means an insertion sort/merge is efficient
		let prev_index = 0;
		let current_index = 0;
		let output: {[s: string]: string}[] = [];
		while (prev_index < prev.length || current_index < current.length) {
			if (prev_index === prev.length) output.push({ ...all_headers, ...current[current_index++] });
			else if (current_index === current.length) output.push({ ...all_headers, ...prev[prev_index++] });
			else if (comparator(prev[prev_index][sort_headers[index - 1]], current[current_index][sort_headers[index]]) > 0) {
				output.push({ ...all_headers, ...prev[prev_index++] });
				prev_index++;
			} else {
				output.push({ ...all_headers, ...current[current_index++] });
				current_index++;
			}
		}
		return output;
	});
}
