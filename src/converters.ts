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

// List all converters here, key will be the name, value is the converter function
export const CONVERTERS: {[s: string]: (content: string) => {[s: string]: string}[]} = {
	'Using standard converter' : standardConvert,
}
