import React from 'react';
import { cloneDeep } from 'lodash';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/de';
import { VSCodeButton, VSCodeDropdown, VSCodeOption, VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ThemeProvider, Tooltip, createTheme } from '@mui/material';
import FileList from './FileList';
import { vscodeAPI, FileData, askForNewDates, askForMultipleNewHeaders } from '../WebviewCommunication';

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
dayjs.extend(utc);

/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default function MultiConverterOptionsWebview() {
    // Initialize states, this is here because the converters.ts imports fs and vscode
    const [converters_list, setConvertersList] = React.useState<string[]>(["Getting converters"]);
    const [comparators_list, setComparatorsList] = React.useState<string[]>(["Getting comparators"]);

    // File list
    const [files, setFiles] = React.useState<{[s: string]: FileData}>({});
    const [headers_per_file, setHeadersPerFile] = React.useState<{[s: string]: string[]}>({}); // TODO: find a way to send this to the FileList component

    const amount_of_files = Object.keys(files).length;

    // Comparator
    const [comparator, setComparator] = React.useState(0);

    // Start and End Date
    const [start_date, setStartDate] = React.useState<Dayjs>(dayjs());
    const [end_date, setEndDate] = React.useState<Dayjs>(dayjs());
    const [earliest_date, setEarliestDate] = React.useState<Dayjs>(dayjs());
    const [latest_date, setLatestDate] = React.useState<Dayjs>(dayjs());
    const [show_loading_date, setShowLoadingDate] = React.useState(false);
    const date_time_format = "YYYY-MM-DD[T]HH:mm:ss";

    const same_edge_dates = start_date.isSame(end_date);

    const onMessage = (event: MessageEvent) => {
        const message = event.data;
        console.log(message);
        switch (message.command) {
            case "initialize":
                setConvertersList(message.converters);
                setComparatorsList(message.comparators);
                break;
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
                            new_files[file_name] = { converter: 0, header: 0 };
                    });

                    // ask the extension to read headers of the new files
                    askForMultipleNewHeaders(add_file_names, add_file_names.map(_ => 0));

                    askForNewDates(new_files, comparators_list[comparator]);

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
            case "multiple-headers":
                setHeadersPerFile(prev => {
                    const new_headers = cloneDeep(prev);
                    message.file_names.forEach((file_name, index) => {
                        new_headers[file_name] = message.data[index];
                    });
                    return new_headers;
                });
                break;
            case "edge-dates":
                const start_date = dayjs(message.date_start).utc();
                setEarliestDate(start_date);
                setStartDate(start_date);
                const end_date = dayjs(message.date_end).utc();
                setEndDate(end_date);
                setLatestDate(end_date);
                setShowLoadingDate(false);
                break;
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize the 
        vscodeAPI.postMessage({ command: "initialize" })
    }, []);

    const onSubmit = (e: any) => {
        vscodeAPI.postMessage({ command: "submit", 
            files, 
            comparator: comparators_list[comparator],
            constraints: [start_date.toISOString(), end_date.toISOString()],
        });
    };
    
    return (
        <div style={BACKDROP_STYLE}>
            <ThemeProvider theme={darkTheme}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='de'>
                <h1>Options</h1>
                <div className='dialog' style={DIALOG_STYLE}>
                    <FileList converters_list={converters_list} files={files} headers_per_file={headers_per_file} setFiles={setFiles}/>
                    
                    {/* Put the file options here */}
                    <div style={getStyle("mb5")}>
                        <Tooltip title="The comparator is used to sort the timestamps.">
                            <h4>Comparator</h4>
                        </Tooltip>
                        <VSCodeDropdown  onInput={(e: any) => setComparator(parseInt(e.target.value))}>
                            {comparators_list.map((comparator_name, index) => (
                                <VSCodeOption key={comparator_name + " comparator"} value={index.toString()}>{comparator_name}</VSCodeOption>
                            ))}
                        </VSCodeDropdown>
                    </div>
                    <div>
                        <div>
                            <VSCodeButton onClick={() => { askForNewDates(files, comparators_list[comparator]); setShowLoadingDate(true); }}
                            disabled={amount_of_files === 0} appearance={ same_edge_dates && amount_of_files > 0 ? 'primary' : 'secondary'}>
                                Reset time range
                            </VSCodeButton>
                            {show_loading_date && <VSCodeProgressRing/>}
                        </div>
                        <Tooltip title="The output only contains timestamps bewteen these two dates/times.">
                            <h3>Timestamp range selection: </h3>
                        </Tooltip>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <DateTimePicker label="Start Timestamp" value={start_date} minDateTime={earliest_date} maxDateTime={latest_date}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={date_time_format} onChange={(newDate) => setStartDate(newDate ?? dayjs())}/>
                            <DateTimePicker label="End Timestamp" value={end_date} minDateTime={earliest_date} maxDateTime={latest_date}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={date_time_format} onChange={(newDate) => setEndDate(newDate ?? dayjs())}/>
                        </div>
                    </div>
                    <VSCodeButton appearance={amount_of_files > 0 ? 'primary' : 'secondary'} onClick={onSubmit} disabled={ amount_of_files === 0 || same_edge_dates }>Submit</VSCodeButton>
                </div>
            </LocalizationProvider>
            </ThemeProvider>
        </div>
    );
}