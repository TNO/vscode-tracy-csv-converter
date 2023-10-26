import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material';
import FileList from './FileList';
import { vscodeAPI, Ext2WebMessage, postW2EMessage, updateWebviewState, TermFlags } from '../communicationProtocol';
import { parseDateNumber, parseDateString } from '../utility';
import TermSearch from './TermSearch';
import DateTimeRangeSelection from './DateTimeRangeSelection';
import { FileDataContext, fileDataReducer } from './FileDataContext';
import SubmissionComponent from './SubmissionComponent';

const BACKDROP_STYLE: React.CSSProperties = {
    width: 'calc(100% - 60px)', backgroundColor: '#00000030', position: 'absolute', margin: '10px', padding: '0 10px 0 10px'
}
const DIALOG_STYLE: React.CSSProperties = {
    width: 'calc(100% - 20px)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'
};

const darkTheme = createTheme({ palette: { mode: 'dark' } });
let initialization = false;
/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default function MultiConverterOptionsWebview() {
    // File list
    const [fileData, fileDataDispatch] = React.useReducer(fileDataReducer, {});
    const [dirtyMetadata, setDirtyMetadata] = React.useState(0);

    const minHeaders = Object.keys(fileData).map(h => fileData[h].headers.length).sort().at(0) ?? 0;
    const amountOfFiles = Object.keys(fileData).length;

    // Start and End Date
    const [startDate, setStartDate] = React.useState(0);
    const [endDate, setEndDate] = React.useState(0);

    const dayjsStartDate = parseDateNumber(startDate);
    const dayjsEndDate = parseDateNumber(endDate);

    // Terms
    const [terms, setTerms] = React.useState<[string, TermFlags][]>([]);

    const onMessage = React.useCallback((event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        console.log("Webview received message:", message);
        switch (message.command) {
            case "initialize": {
                initialization = false;
                break;
            }
            case "metadata": {
                // Update dates
                const startDateUtc = parseDateString(message.totalStartDate);
                const endDateUtc = parseDateString(message.totalEndDate);
                if (startDate === 0 || parseDateNumber(startDate).isBefore(startDateUtc))
                    setStartDate(startDateUtc.valueOf());
                if (endDate === 0 || parseDateNumber(endDate).isAfter(endDateUtc))
                    setEndDate(endDateUtc.valueOf());
                break;
            }
        }
    }, [startDate, endDate]);

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize
        initialization = true;
        const prevState = vscodeAPI.getState();
        if (prevState) {
            // Read prev state
            fileDataDispatch({ type: "set-data", state: prevState.fileData });
            setStartDate(prevState.dates[0]);
            setEndDate(prevState.dates[1]);
        }
        postW2EMessage({ command: "initialize" });
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ fileData, dates: [startDate, endDate] });
    }, [fileData, startDate, endDate]);


    React.useEffect(() => {
        if (initialization) return;
        const termSearchIndex: {[s: string]: number} = {};
        Object.keys(fileData).forEach(f => termSearchIndex[f] = fileData[f].termSearchIndex);
        postW2EMessage({ command: "read-metadata", files: fileData, options: { terms, termSearchIndex } });
    }, [dirtyMetadata]);
    
    return (
        <FileDataContext.Provider value={{fileData, fileDataDispatch}}>
        <div style={BACKDROP_STYLE}>
            <ThemeProvider theme={darkTheme}>
            
            <h1>Options</h1>
            <div className='dialog' style={DIALOG_STYLE}>
                <FileList onChange={() => { setDirtyMetadata(d => d + 1)}}/>
                
                {/* Put the file options here */}
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <DateTimeRangeSelection 
                        amountOfFiles={amountOfFiles}
                        startDate={dayjsStartDate}
                        endDate={dayjsEndDate}
                        onChangeStartDate={(newDate) => { setStartDate(newDate?.valueOf() ?? 0) }}
                        onChangeEndDate={(newDate) => { setEndDate(newDate?.valueOf() ?? 0) }}
                    />
                    <TermSearch 
                        minHeaders={minHeaders}
                        files={fileData}
                        onChange={(terms, headerToSearch) => {
                            setTerms(terms);
                            fileDataDispatch({ type: 'switch-signal-word-header', header: headerToSearch });
                            setDirtyMetadata(d => d + 1);
                        }}/>
                </div>
                <SubmissionComponent dates={[dayjsStartDate.toISOString(), dayjsEndDate.toISOString()]}/>
            </div>
            </ThemeProvider>
        </div>
        </FileDataContext.Provider>
    );
}