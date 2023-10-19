import React from 'react';
import { cloneDeep } from 'lodash';
import { Dayjs } from 'dayjs';
import { VSCodeButton, VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ThemeProvider, Tooltip, createTheme } from '@mui/material';
import FileList from './FileList';
import { vscodeAPI, FileData, Ext2WebMessage, postW2EMessage, updateWebviewState, FileMetaDataOptions } from '../communicationProtocol';
import { DEFAULT_TERM_SEARCH_INDEX, TRACY_MAX_FILE_SIZE, WEBVIEW_TIMESTAMP_FORMAT } from '../constants';
import { formatNumber, parseDateNumber, parseDateString } from '../utility';
import TermSearch from './TermSearch';

const BACKDROP_STYLE: React.CSSProperties = {
    backgroundColor: '#00000030', padding: '10px', marginTop: '10px'
}
const DIALOG_STYLE: React.CSSProperties = {height: '100%', width: 'calc(100% - 20px)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'};

const darkTheme = createTheme({ palette: { mode: 'dark' } });
let initialization = false;

/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default function MultiConverterOptionsWebview() {
    // File list
    const [files, setFiles] = React.useState<{[s: string]: FileData}>({});
    const [headersPerFile, setHeadersPerFile] = React.useState<{[s: string]: string[]}>({});

    const minHeaders = Object.keys(headersPerFile).map(h => headersPerFile[h].length).sort().at(0) ?? 0;
    const amountOfFiles = Object.keys(files).length;

    // Start and End Date
    const [startDate, setStartDate] = React.useState(0);
    const [endDate, setEndDate] = React.useState(0);
    const [earliestDate, setEarliestDate] = React.useState<Dayjs>(parseDateNumber(0));
    const [latestDate, setLatestDate] = React.useState<Dayjs>(parseDateNumber(0));
    const [showLoadingDate, setShowLoadingDate] = React.useState(false);

    const dayjsStartDate = parseDateNumber(startDate);
    const dayjsEndDate = parseDateNumber(endDate);
    const sameEdgeDates = startDate === endDate;

    // Output file size
    const [fileSize, setFileSize] = React.useState(0);
    const fileTooBig = fileSize > TRACY_MAX_FILE_SIZE;

    // Terms
    const [metaDataOptions, setMetaDataOptions] = React.useState<FileMetaDataOptions>({ terms: [], termSearchIndex: DEFAULT_TERM_SEARCH_INDEX });

    // Style
    const [submitText, setSubmitText] = React.useState("");
    const submitError = submitText.includes("ERROR");

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        console.log("Webview received message:", message);
        switch (message.command) {
            case "initialize": {
                initialization = false;
                break;
            }
            case "metadata": {
                // Update headers
                const newHeaders = cloneDeep(headersPerFile);
                Object.keys(message.metadata).forEach((f) => {
                    newHeaders[f] = message.metadata[f].headers;
                });
                setHeadersPerFile(newHeaders);

                // Update dates
                const startDateUtc = parseDateString(message.totalStartDate);
                const endDateUtc = parseDateString(message.totalEndDate);
                setEarliestDate(startDateUtc);
                if (startDate === 0 || parseDateNumber(startDate).isBefore(startDateUtc))
                    setStartDate(startDateUtc.valueOf());
                if (endDate === 0 || parseDateNumber(endDate).isAfter(endDateUtc))
                    setEndDate(endDateUtc.valueOf());
                setLatestDate(endDateUtc);
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

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize
        initialization = true;
        const prevState = vscodeAPI.getState();
        if (prevState) {
            // Read prev state
            setFiles(prevState.files);
            setHeadersPerFile(prevState.headersPerFile);
            setStartDate(prevState.dates[0]);
            setEndDate(prevState.dates[1]);
            setEarliestDate(parseDateString(prevState.dates[2]));
            setLatestDate(parseDateString(prevState.dates[3]));
            setFileSize(prevState.fileSize);
            setSubmitText(prevState.submitText);
        }
        postW2EMessage({ command: "initialize" });
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        const earliestDateString = earliestDate.isValid() ? earliestDate.toISOString() : "";
        const latestDateString = latestDate.isValid() ? latestDate.toISOString() : "";
        updateWebviewState({ files, headersPerFile, fileSize, submitText, dates: [startDate, endDate, earliestDateString, latestDateString] });
    }, [files, headersPerFile, startDate, endDate, earliestDate, latestDate, fileSize, submitText]);

    // If The files change
    React.useEffect(() => {
        if (initialization) return;
        postW2EMessage({ command: "read-metadata", files, options: metaDataOptions });
        setShowLoadingDate(true);
    }, [files, metaDataOptions]);

    // If the selected timestamp range changes
    React.useEffect(() => {
        if (initialization) return;
        postW2EMessage({ command: "get-file-size", date_start: dayjsStartDate.toISOString(), date_end: dayjsEndDate.toISOString()});
    }, [startDate, endDate]);

    const onSubmit = () => {
        setSubmitText("Loading...");
        postW2EMessage({ command: "submit", 
            files, 
            constraints: [dayjsStartDate.toISOString(), dayjsEndDate.toISOString()],
        });
    };
    
    return (
        <div style={BACKDROP_STYLE}>
            <ThemeProvider theme={darkTheme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
            <h1>Options</h1>
            <div className='dialog' style={DIALOG_STYLE}>
                <FileList files={files} setFiles={setFiles}/>
                
                {/* Put the file options here */}
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <div> 
                        <Tooltip title="The output only contains timestamps between these two dates/times.">
                            <h3>Timestamp range selection: </h3>
                        </Tooltip>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <DateTimePicker label="Start Timestamp" value={dayjsStartDate} 
                                minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={WEBVIEW_TIMESTAMP_FORMAT} 
                                onChange={(newDate) => { setStartDate(newDate?.valueOf() ?? 0) }}
                            />
                            <DateTimePicker label="End Timestamp" value={dayjsEndDate} 
                                minDateTime={earliestDate} maxDateTime={latestDate}
                                views={["hours", "minutes", "seconds"]} ampm={false} format={WEBVIEW_TIMESTAMP_FORMAT} 
                                onChange={(newDate) => { setEndDate(newDate?.valueOf() ?? 0) }}
                            />
                            <div>
                                {(showLoadingDate && amountOfFiles > 0) && <VSCodeProgressRing/>}
                            </div>
                        </div>
                        
                        <Tooltip title="The output file size may be much larger than the sum of the input file sizes due to differences in formatting.">
                            <div>Estimated file size (serialized output): <span>{formatNumber(fileSize)}</span>B. {fileTooBig && <span style={{color: 'red'}}>TOO BIG!</span>}</div>
                        </Tooltip>
                    </div>
                    <TermSearch minHeaders={minHeaders} onChange={(terms, termSearchIndex) => {
                            setMetaDataOptions({terms, termSearchIndex});
                        }}/>
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