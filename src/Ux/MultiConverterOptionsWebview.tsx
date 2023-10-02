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
import { vscodeAPI, FileData, askForMetadata, Ext2WebMessage } from '../communicationProtocol';
import { TRACY_MAX_FILE_SIZE } from '../constants';
import { formatNumber } from '../utility';

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

    // Output file size
    const [fileSize, setFileSize] = React.useState(0);
    const fileTooBig = fileSize > TRACY_MAX_FILE_SIZE;

    // Style
    const [submitText, setSubmitText] = React.useState("");
    const submitError = submitText.includes("ERROR");

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        console.log("Webview received message:", message);
        switch (message.command) {
            case "metadata": {
                // Update headers
                const newHeaders = cloneDeep(headersPerFile);
                Object.keys(message.headers).forEach((f, i) => {
                    newHeaders[f] = message.headers[f];
                });
                setHeadersPerFile(newHeaders);

                // Update dates
                // TODO: check if users want to keep the dates should they change the files/formats
                const startDate = dayjs(message.date_start).utc();
                const endDate = dayjs(message.date_end).utc();
                setEarliestDate(startDate);
                setStartDate(startDate);
                setEndDate(endDate);
                setLatestDate(endDate);
                setShowLoadingDate(false);
                break;
            }
            case "size-estimate":
                setFileSize(message.size ?? 0);
                break;
            case "submit-message":
                setSubmitText(message.text);
        }
    };

    React.useEffect(() => {
        askForMetadata(files);
        setShowLoadingDate(true);
    }, [files]);

    React.useEffect(() => {
        vscodeAPI.postMessage({ command: "get-file-size", date_start: startDate.toISOString(), date_end: endDate.toISOString()});
    }, [startDate, endDate]);

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
                    <FileList files={files} headers_per_file={headersPerFile} setFiles={setFiles}/>
                    
                    {/* Put the file options here */}
                    <div>
                        
                        <Tooltip title="The output only contains timestamps between these two dates/times.">
                            <h3>Timestamp range selection: </h3>
                        </Tooltip>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <DateTimePicker label="Start Timestamp" value={startDate} minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={dateTimeFormat} onChange={(newDate) => { setStartDate(newDate ?? dayjs()) }}/>
                            <DateTimePicker label="End Timestamp" value={endDate} minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={dateTimeFormat} onChange={(newDate) => { setEndDate(newDate ?? dayjs()) }}/>
                            <div>
                                {(showLoadingDate && amountOfFiles > 0) && <VSCodeProgressRing/>}
                            </div>
                        </div>
                        <div>Estimated file size: <span>{formatNumber(fileSize)}</span>B. {fileTooBig && <span style={{color: 'red'}}>TOO BIG!</span>}</div>
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