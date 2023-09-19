import React from 'react';
import { cloneDeep } from 'lodash';
import dayjs, { Dayjs } from 'dayjs';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ThemeProvider, createTheme } from '@mui/material';
import FileList from './FileList';
import { vscodeAPI, askForNewHeaders, askForNewDates } from '../WebviewCommunication';
import { COMPARATORS, CONVERTERS } from '../converters';

const BACKDROP_STYLE: React.CSSProperties = {
    width: 'calc(100% - 50px)', height: 'calc(100% - 50px)', backgroundColor: '#00000030', position: 'absolute', margin: '10px', paddingLeft: '10px'
}
const DIALOG_STYLE: React.CSSProperties = {height: '100%', width: 'calc(100% - 20px)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'};

const STYLES: {[s: string]: React.CSSProperties} = {
    "pt5": { paddingTop: 5 },
    "pb5": { paddingBottom: 5 },
    "ml5": { marginLeft: 5 },
    "mb5": { marginBottom: 5 },
    "border1white": { border: "1px solid white "},
    "minheight200": { minHeight: "100px" }
};

function getStyle(style_string: string) {
    return style_string.split(' ').map(s => STYLES[s] ?? "").reduce((prev, curr) => {return {...prev, ...curr};});
}

const darkTheme = createTheme({ palette: { mode: 'dark' } });

const DEFAULT_CONVERTER = Object.keys(CONVERTERS)[0];

interface FileData {
    // name: string, // This will be stored in the keys
    converter: string,
    header: number,
}

/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default function MultiConverterOptionsWebview() {
    // File list
    const [files, setFiles] = React.useState<{[s: string]: FileData}>({});
    const [headers_per_file, setHeadersPerFile] = React.useState<{[s: string]: string[]}>({}); // TODO: find a way to send this to the FileList component

    const amount_of_files = Object.keys(files).length;

    // Comparator
    const [comparator, setComparator] = React.useState(Object.keys(COMPARATORS)[0]);

    // Start and End Date
    const [start_date, setStartDate] = React.useState<Dayjs>(dayjs());
    const [end_date, setEndDate] = React.useState<Dayjs>(dayjs());
    const [earliest_date, setEarliestDate] = React.useState<Dayjs>(dayjs());
    const [latest_date, setLatestDate] = React.useState<Dayjs>(dayjs());

    const onMessage = (event: MessageEvent) => {
        const message = event.data;
        console.log(message);
        switch (message.command) {
            case "clear":
                setFiles({});
                break;
            case "add-files": // When new files are read by the extension, send to the webview and add them here
                setFiles(files => {
                    const new_files = cloneDeep(files);
                    // Add the requested files
                    const add_file_names = message.data as string[];
                    add_file_names.forEach((file_name) => {
                        if (!new_files[file_name])
                            new_files[file_name] = { converter: DEFAULT_CONVERTER, header: 0 };
                    });

                    // ask the extension to read headers of the new files
                    Object.keys(new_files).forEach((file) => {
                        askForNewHeaders(file, new_files[file].converter);
                    });

                    return new_files;
                });
                
                break;
            case "headers": // When a file is read to get the headers, send to the webview and display
                setHeadersPerFile(prev => {
                    const new_headers = cloneDeep(prev);
                    new_headers[message.file] = message.data;
                    // askForNewDates(message.file, new_headers[message.file][]);
                    return new_headers;
                });

                break;
            case "start-date":
                const start_date = dayjs(message.data);
                setEarliestDate(start_date);
                setStartDate(start_date);
                break;
            case "end-date":
                const end_date = dayjs(message.data);
                setEndDate(end_date);
                setLatestDate(end_date);
                break;
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);
    }, []);

    const onSubmit = (e: any) => {
        vscodeAPI.postMessage({ command: "submit", 
            files, 
            comparator
        });
    };
    
    return (
        <div style={BACKDROP_STYLE}>
            <ThemeProvider theme={darkTheme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <h1>Options</h1>
                <div className='dialog' style={DIALOG_STYLE}>
                    <FileList files={files} headers_per_file={headers_per_file} setFiles={setFiles}/>
                    
                    {/* Put the file options here */}
                    <div>
                        <VSCodeButton onClick={() => askForNewDates(files)}>
                            Reset time range
                        </VSCodeButton>
                        <h3>Timestamp range selection: </h3>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <DateTimePicker label="Start Timestamp" value={start_date} minDateTime={earliest_date} maxDateTime={latest_date} onChange={(newDate) => setStartDate(newDate ?? dayjs())}/>
                            <DateTimePicker label="End Timestamp" value={end_date} minDateTime={earliest_date} maxDateTime={latest_date} onChange={(newDate) => setEndDate(newDate ?? dayjs())}/>
                        </div>
                    </div>
                    <div>
                        Comparator
                        <VSCodeDropdown style={getStyle("ml5 mb5")} onInput={(e: any) => setComparator(e.target.value)}>
                            {Object.keys(COMPARATORS).map((comparator_name) => (
                                <VSCodeOption key={comparator_name + " comparator"} value={comparator_name}>{comparator_name}</VSCodeOption>
                            ))}
                        </VSCodeDropdown>
                    </div>
                    <VSCodeButton appearance={amount_of_files > 0 ? 'primary' : 'secondary'} onClick={onSubmit} disabled={amount_of_files === 0}>Submit</VSCodeButton>
                </div>
            </LocalizationProvider>
            </ThemeProvider>
        </div>
    );
}