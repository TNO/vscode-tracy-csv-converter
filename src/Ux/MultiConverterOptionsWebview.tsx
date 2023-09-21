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
import { vscodeAPI, FileData, askForNewDates, askForNewHeaders, Ext2WebMessage } from '../WebviewCommunication';

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
    const [convertersList, setConvertersList] = React.useState<string[]>(["Getting converters"]);
    const [comparatorsList, setComparatorsList] = React.useState<string[]>(["Getting comparators"]);

    // File list
    const [files, setFiles] = React.useState<{[s: string]: FileData}>({});
    const [headersPerFile, setHeadersPerFile] = React.useState<{[s: string]: string[]}>({});

    const amountOfFiles = Object.keys(files).length;

    // Comparator
    const [comparator, setComparator] = React.useState(0);

    // Start and End Date
    const [startDate, setStartDate] = React.useState<Dayjs>(dayjs());
    const [endDate, setEndDate] = React.useState<Dayjs>(dayjs());
    const [earliestDate, setEarliestDate] = React.useState<Dayjs>(dayjs());
    const [latestDate, setLatestDate] = React.useState<Dayjs>(dayjs());
    const [showLoadingDate, setShowLoadingDate] = React.useState(false);
    const dateTimeFormat = "YYYY-MM-DD[T]HH:mm:ss";

    const sameEdgeDates = startDate.isSame(endDate);

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        console.debug("Webview received message:", message);
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
                    const newFiles = cloneDeep(files);
                    // Add the requested files
                    message.data.forEach((file_name) => {
                        if (!newFiles[file_name])
                            newFiles[file_name] = { converter: 0, header: 0 };
                    });

                    // ask the extension to read headers of the new files
                    askForNewHeaders(message.data, message.data.map(() => 0));

                    askForNewDates(newFiles, comparatorsList[comparator]);

                    return newFiles;
                });
                
                break;
            case "headers":
                setHeadersPerFile(prev => {
                    const newHeaders = cloneDeep(prev);
                    message.file_names.forEach((file_name, index) => {
                        newHeaders[file_name] = message.data[index];
                    });
                    return newHeaders;
                });
                break;
            case "edge-dates": {
                const startDate = dayjs(message.date_start).utc();
                const endDate = dayjs(message.date_end).utc();
                setEarliestDate(startDate);
                setStartDate(startDate);
                setEndDate(endDate);
                setLatestDate(endDate);
                setShowLoadingDate(false);
                break;
            }
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize the 
        vscodeAPI.postMessage({ command: "initialize" })
    }, []);

    const onSubmit = () => {
        vscodeAPI.postMessage({ command: "submit", 
            files, 
            comparator: comparatorsList[comparator],
            constraints: [startDate.toISOString(), endDate.toISOString()],
        });
    };
    
    return (
        <div style={BACKDROP_STYLE}>
            <ThemeProvider theme={darkTheme}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='de'>
                <h1>Options</h1>
                <div className='dialog' style={DIALOG_STYLE}>
                    <FileList converters_list={convertersList} files={files} headers_per_file={headersPerFile} setFiles={setFiles}/>
                    
                    {/* Put the file options here */}
                    <div style={getStyle("mb5")}>
                        <Tooltip title="The comparator is used to sort the timestamps.">
                            <h4>Comparator</h4>
                        </Tooltip>
                        <VSCodeDropdown onInput={(e: React.BaseSyntheticEvent) => { setComparator(parseInt(e.target.value)) }}>
                            {comparatorsList.map((comparator_name, index) => (
                                <VSCodeOption key={comparator_name + " comparator"} value={index.toString()}>{comparator_name}</VSCodeOption>
                            ))}
                        </VSCodeDropdown>
                    </div>
                    <div>
                        <div>
                            <VSCodeButton onClick={() => { askForNewDates(files, comparatorsList[comparator]); setShowLoadingDate(true); }}
                            disabled={amountOfFiles === 0} appearance={ sameEdgeDates && amountOfFiles > 0 ? 'primary' : 'secondary'}>
                                Reset time range
                            </VSCodeButton>
                            {showLoadingDate && <VSCodeProgressRing/>}
                        </div>
                        <Tooltip title="The output only contains timestamps bewteen these two dates/times.">
                            <h3>Timestamp range selection: </h3>
                        </Tooltip>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <DateTimePicker label="Start Timestamp" value={startDate} minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={dateTimeFormat} onChange={(newDate) => setStartDate(newDate ?? dayjs())}/>
                            <DateTimePicker label="End Timestamp" value={endDate} minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={dateTimeFormat} onChange={(newDate) => setEndDate(newDate ?? dayjs())}/>
                        </div>
                    </div>
                    <VSCodeButton appearance={amountOfFiles > 0 ? 'primary' : 'secondary'} onClick={onSubmit} disabled={ amountOfFiles === 0 || sameEdgeDates }>Submit</VSCodeButton>
                </div>
            </LocalizationProvider>
            </ThemeProvider>
        </div>
    );
}