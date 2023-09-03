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

// Define your own converter
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
function customSingleConverter(content: string, col_delimiter: string = ',', row_delimiter: string = '\n', sort_by_column: string | undefined) {
	const rows = content.split(row_delimiter) // split by row delimiter
		.filter((l) => l.trim() !== '') // remove leading and trailing whitespace
		.map((l) => l.split(col_delimiter)); // split by column delimiter and copy to new array
	const headers = rows[0];
	return rows.slice(1).map((r) => {
		const row: {[s: string]: string} = {};
		headers.forEach((h, i) => row[h] = r[i]);
		return row;
	}).sort((a: {[s: string]: string}, b: {[s: string]: string}) => {
		if (sort_by_column) // TODO: its a bit inefficient to have the if call inside the sort, fix it
			return a[sort_by_column] > b[sort_by_column] ? 1 : -1;
		else 
			return 0;
	});
}

export function getHeaders(content: string, col_delimiter: string = ',') { // only expect the first line
	return content.split(col_delimiter);
}

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

	const shared_char_counts = char_counts.reduce((prev_row, current_row) => {
		let intersect_chars: {[s: string]: number} = {};
		for (const char in prev_row) {
			if (current_row[char] === prev_row[char]) intersect_chars[char] = prev_row[char]; // keep only the chars that both rows have
		}
		return intersect_chars;
	});
	// console.log("Found delimiters: ", shared_char_counts);
	const shared_chars = Object.keys(shared_char_counts);
	if (shared_chars.length > 0) return shared_chars[0];
	// TODO: ask user what delimiter to use (show example text maybe?)
	return ','; // if no shared character is found, return the default delimiter
}

function autoCSVConverter(content: string): {[s: string]: string}[] {
	const col_delimiter = getColumnDelimiter(content.slice(0, 5000));
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
	'Using standard converter.' : standardConvert,
	'Auto converter.'			: autoCSVConverter,
	'Define custom converter!' 	: customSingleConverter,
}

function string_compare(a: string, b: string) {
	return a < b; // default comparator, currently only works because the timestamps are reasonably structured
}

export function multiConverter(files: string[], sort_column: string = "timestamp", comparator: (a: string, b: string) => boolean = string_compare) : {[s: string]: string}[] {
	// TODO: add multiple different headers options
	const tracy_docs = files.map(content => autoCSVConverter(content));
	// combine the files
	return tracy_docs.reduce((prev, current) => {
		// assumption is that the "timestamp"s are already sorted in both prev and current
		// this means an insertion sort/merge is efficient
		let prev_index = 0;
		let current_index = 0;
		let output: {[s: string]: string}[] = [];
		while (prev_index < prev.length || current_index < current.length) {
			if (prev_index === prev.length) output.push(current[current_index++]);
			else if (current_index === current.length) output.push(prev[prev_index++]);
			else if (comparator(prev[prev_index][sort_column], current[current_index][sort_column])) {
				output.push(prev[prev_index]);
				prev_index++;
			} else {
				output.push(current[current_index]);
				current_index++;
			}
		}
		return output;
	});
}
