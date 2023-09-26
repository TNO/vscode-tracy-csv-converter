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
import { vscodeAPI, FileData, askForNewDates, askForNewHeaders, Ext2WebMessage, FILE_STATUS_TABLE } from '../WebviewCommunication';

const BACKDROP_STYLE: React.CSSProperties = {
    width: 'calc(100% - 50px)', height: 'calc(100% - 50px)', backgroundColor: '#00000030', position: 'absolute', margin: '10px', paddingLeft: '10px'
}
const DIALOG_STYLE: React.CSSProperties = {height: '100%', width: 'calc(100% - 20px)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'};

const darkTheme = createTheme({ palette: { mode: 'dark' } });
dayjs.extend(utc);

/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default function MultiConverterOptionsWebview() {
    // Initialize states, this is here because the converters.ts imports fs and vscode
    const [convertersList, setConvertersList] = React.useState<string[]>(["Getting converters"]);

    // File list
    const [files, setFiles] = React.useState<{[s: string]: FileData}>({});
    const [headersPerFile, setHeadersPerFile] = React.useState<{[s: string]: string[]}>({});

    const amountOfFiles = Object.keys(files).length;

    // Start and End Date
    const [startDate, setStartDate] = React.useState<Dayjs>(dayjs());
    const [endDate, setEndDate] = React.useState<Dayjs>(dayjs());
    const [earliestDate, setEarliestDate] = React.useState<Dayjs>(dayjs());
    const [latestDate, setLatestDate] = React.useState<Dayjs>(dayjs());
    const [showLoadingDate, setShowLoadingDate] = React.useState(false);
    const dateTimeFormat = "YYYY-MM-DD[T]HH:mm:ss";

    const sameEdgeDates = startDate.isSame(endDate);

    // Style
    const [submitText, setSubmitText] = React.useState("");
    const submitError = submitText.includes("ERROR");

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        console.log("Webview received message:", message);
        switch (message.command) {
            case "initialize":
                setConvertersList(message.converters);
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
                            newFiles[file_name] = { converter: 0, status: FILE_STATUS_TABLE.New() };
                    });

                    // ask the extension to read headers of the new files
                    askForNewHeaders(message.data, message.data.map(() => 0)); // 0 is default converter

                    askForNewDates(newFiles);

                    return newFiles;
                });
                
                break;
            case "headers": {
                const newHeaders = cloneDeep(headersPerFile);
                message.file_names.forEach((file_name, index) => {
                    newHeaders[file_name] = message.data[index];
                });
                
                setHeadersPerFile(newHeaders);
                setFiles(files => {
                    const newFiles = cloneDeep(files);
                    message.file_names.forEach((file_name, index) => {
                        newFiles[file_name].status = FILE_STATUS_TABLE.ReceivedHeaders(message.data[index].length);
                        if (message.data[index].length === 1) newFiles[file_name].statusColor = "#FF5733"
                    });
                    return newFiles;
                });
                break;
            }
            case 'error': {
                setFiles(files => {
                    const newFiles = cloneDeep(files);
                    message.file_names.forEach((file_name, i) => {
                        newFiles[file_name].status = FILE_STATUS_TABLE.Error(message.messages[i]);
                        newFiles[file_name].statusColor = "#FF0000";
                    });
                    return newFiles;
                });
                break;
            }
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
            case "submit-message":
                setSubmitText(message.text);
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize the 
        vscodeAPI.postMessage({ command: "initialize" })
    }, []);

    const onSubmit = () => {
        setSubmitText("Loading...");
        vscodeAPI.postMessage({ command: "submit", 
            files, 
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
                    <div>
                        
                        <Tooltip title="The output only contains timestamps bewteen these two dates/times.">
                            <h3>Timestamp range selection: </h3>
                        </Tooltip>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <DateTimePicker label="Start Timestamp" value={startDate} minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={dateTimeFormat} onChange={(newDate) => setStartDate(newDate ?? dayjs())}/>
                            <DateTimePicker label="End Timestamp" value={endDate} minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={dateTimeFormat} onChange={(newDate) => setEndDate(newDate ?? dayjs())}/>
                            <div>
                                <VSCodeButton onClick={() => { askForNewDates(files); setShowLoadingDate(true); }}
                                disabled={amountOfFiles === 0} appearance={ sameEdgeDates && amountOfFiles > 0 ? 'primary' : 'secondary'}>
                                    Reset time range
                                </VSCodeButton>
                                {showLoadingDate && <VSCodeProgressRing/>}
                            </div>
                        </div>
                    </div>
                    <div>
                        <VSCodeButton appearance={amountOfFiles > 0 ? 'primary' : 'secondary'} onClick={onSubmit} disabled={ amountOfFiles === 0 || sameEdgeDates }>Merge and Open</VSCodeButton>
                        {(!submitError && submitText.length > 0) && <VSCodeProgressRing/>}
                        {submitText.length > 0 && <span style={{ color: submitError ? "red" : undefined }}>{submitText}</span>}
                    </div>
                </div>
            </LocalizationProvider>
            </ThemeProvider>
        </div>
    );
}