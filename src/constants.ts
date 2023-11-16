// This has to match the package.json contributes.commands.command value
export const COMMAND_ID_CURRENT = "extension.tracyCsvConverter";
export const COMMAND_ID_MULTIPLE = "extension.tracyMultiCsvConverter";

// Make this something unique
export const SCHEME = 'vscodeTracyCsvConverter';

// ID of the tracy editor command
export const TRACY_EDITOR = 'tno.tracy';

// Max file size that tracy can handle, in bytes
export const TRACY_MAX_FILE_SIZE = 1024*1024*30;

export const FILE_NAME_HEADER = "_File_Name";
export const RESOLVED_TIMESTAMP_HEADER = "_Resolved_Timestamp";
export const RESOLVED_TIMESTAMP_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSSZ[Z]";

export const DEFAULT_TIME_SELECTION_STEPSIZE = 60_000;
export const DEFAULT_TIME_SELECTION_SMALL = "Shift";
export const DEFAULT_TIME_SELECTION_STEPSIZE_SMALL = 60;
export const DEFAULT_TIME_SELECTION_SMALLER = "Control";
export const DEFAULT_TIME_SELECTION_STEPSIZE_SMALLER = 1000;


export const WEBVIEW_TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss.SSS";

export const DEFAULT_SEARCH_TERMS = ["Warning", "Error", "Fail"];
export const DEFAULT_TERM_SEARCH_INDEX = 1;

export const WARNING_COLOR = "#FF5733";