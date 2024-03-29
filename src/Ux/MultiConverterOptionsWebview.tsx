/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material';
import FileList from './FileList';
import { vscodeAPI, Ext2WebMessage, postW2EMessage, updateWebviewState, TermFlags } from '../communicationProtocol';
import { parseDateString } from '../utility';
import TermSearch from './TermSearch';
import DateTimeRangeSelection from './DateTimeRangeSelection';
import { FileDataContext, fileDataReducer } from './context/FileDataContext';
import SubmissionComponent from './SubmissionComponent';
import { DatesContextProvider, DatesReducer } from "./context/DatesContext";
import { DEFAULT_COMPARATOR } from "../utility";
import useEffectFileData from "./customHooks/useEffectFileData";

const BACKDROP_STYLE = css({
    width: 'calc(100% - 60px)', backgroundColor: '#00000030', position: 'absolute', margin: '10px', padding: '0 10px 0 10px'
})
const DIALOG_STYLE = css({
    width: 'calc(100% - 20px)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'
});

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

    // Start and End Date
    const [dates, datesDispatch] = React.useReducer(DatesReducer, {
        earliest: 0,
        latest: 0,
        begin: 0,
        end: 0
    });

    // Terms
    const [terms, setTerms] = React.useState<[string, TermFlags][]>([]);

    // The use of reducers works well for onMessage handling.
    function onMessage(event: MessageEvent) {
        const message = event.data as Ext2WebMessage;
        console.log("Webview received message:", message);
        switch (message.command) {
            case "initialize": {
                initialization = false;
                break;
            }
        }
    }

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize
        initialization = true;
        const prevState = vscodeAPI.getState();
        if (prevState) {
            // Read prev state
            fileDataDispatch({ type: "set-data", state: prevState.fileData });
            datesDispatch({ type: "new-state", state: prevState.dates });
        }
        postW2EMessage({ command: "initialize" });
        return () => {
            window.removeEventListener("message", onMessage);
        }
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ fileData, dates });
    }, [fileData, dates]);


    React.useEffect(() => {
        if (initialization) return;
        const termSearchIndex: {[s: string]: number} = {};
        Object.keys(fileData).forEach(f => termSearchIndex[f] = fileData[f].termSearchIndex);
        postW2EMessage({ command: "read-metadata", files: fileData, options: { terms, termSearchIndex } });
    }, [dirtyMetadata]);

    useEffectFileData(() => {
        // Get the edge dates
        const fileDates = Object.keys(fileData).map(f => fileData[f].dates);
        const earliest = fileDates.map(m => m[0]).filter(m => parseDateString(m).isValid()).sort(DEFAULT_COMPARATOR)[0];
        const latest = fileDates.map(m => m[1]).filter(m => parseDateString(m).isValid()).sort(DEFAULT_COMPARATOR).at(-1)!;

        datesDispatch({
            type: "update-limits",
            earliest: parseDateString(earliest).valueOf(),
            latest: parseDateString(latest).valueOf()
        });
    }, fileData, ["dates"]);
    
    // Using contexts allows me to skip the passing of most of the data, so there is less clutter.
    return (
        <FileDataContext.Provider value={{fileData, fileDataDispatch}}>
        <DatesContextProvider dates={dates} datesDispatch={datesDispatch}>
        <div css={BACKDROP_STYLE}>
            <ThemeProvider theme={darkTheme}>
            
            <h1>Options</h1>
            <div className='dialog' css={DIALOG_STYLE}>
                <FileList onChange={() => { setDirtyMetadata(d => d + 1)}}/>
                
                {/* Put the file options here */}
                <div css={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <DateTimeRangeSelection 
                        onDirtyMetadata={() => setDirtyMetadata(d => d + 1)}
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
                <SubmissionComponent/>
            </div>
            </ThemeProvider>
        </div>
        </DatesContextProvider>
        </FileDataContext.Provider>
    );
}