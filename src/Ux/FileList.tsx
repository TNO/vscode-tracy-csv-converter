import React from 'react';
import { Tooltip } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell } from '@vscode/webview-ui-toolkit/react';
import { vscodeAPI, FILE_STATUS_TABLE, Ext2WebMessage } from '../communicationProtocol';
import FileListRow from './FileListRow';
import { FileDataContext } from './FileDataContext';

interface Props {
    onChange: () => void;
}

export default function FileList({ onChange }: Props) {
    const [convertersList, setConvertersList] = React.useState<string[]>([]);

    const { fileData, fileDataDispatch } = React.useContext(FileDataContext);

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize":
                setConvertersList(message.converters);
                break;
            case "add-files": { // When new files are read by the extension, send to the webview and add them here
                fileDataDispatch({ type: "add-files", files: message.data });
                break;
            }
            case "warning":
            case "error":
                fileDataDispatch({ type: "new-status", files: message.file_names, level: message.command, messages: message.messages});
                break;
            case "metadata": {
                const fileNames = message.metadata.map(fmd => fmd.fileName);
                // Update headers
                fileDataDispatch({ type: "new-headers", files: fileNames, headers: message.metadata.map(fmd => fmd.headers)});
                fileDataDispatch({ type: "new-dates", files: fileNames, dates: message.metadata.map(fmd => [ fmd.firstDate, fmd.lastDate ])});
                fileDataDispatch({ type: "new-status", files: fileNames, level: "status", messages: message.metadata.map(fmd => FILE_STATUS_TABLE.ReceivedHeaders(fmd.headers.length))});
                fileDataDispatch({ type: "new-terms", files: fileNames, terms: message.metadata.map(fmd => fmd.termOccurrances)});
                break;
            }
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', onMessage);
    }, []);

    const amountOfFiles = Object.keys(fileData[0]).length;

    // When you change the converter you want to use for a specific file
    const onConverterSwitch = (file: string, value: string) => {
        fileDataDispatch({ type: "switch-converter", file, converter: parseInt(value) });
        onChange();
    };

    const onRemoveFileRow = (file: string) => {
        fileDataDispatch({ type: "remove-file", file });
        onChange();
    };

    const onAddFiles = () => {
        vscodeAPI.postMessage({ command: "add-files" });
    };
    
    return (
        <div style={{ paddingBottom: 5, width: '100%' }}>
            <h2>Files</h2>
            <VSCodeDataGrid id="files-grid" gridTemplateColumns='2vw 30vw 250px 165px 160px' style={{ border: "1px solid white", minHeight: "100px" }}>
                <VSCodeDataGridRow row-rowType='sticky-header'>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='1'></VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>File</VSCodeDataGridCell>
                    <Tooltip title="The format of the file.">
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='3'>Format</VSCodeDataGridCell>
                    </Tooltip>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='4'>Timestamps</VSCodeDataGridCell>
                    <Tooltip title="The amount of times certain terms occur in the file under the specified header.">
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='5'>Terms</VSCodeDataGridCell>
                    </Tooltip>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='6'>Status</VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {Object.keys(fileData[0]).map((file) => 
                    <FileListRow
                        key={file}
                        convertersList={convertersList}
                        fileName={file}
                        fileData={fileData[0][file]}
                        onConverterSwitch={onConverterSwitch}
                        onRemove={onRemoveFileRow}
                    />)
                }
            </VSCodeDataGrid>
            <div style={{ paddingTop: 5 }}>
                <VSCodeButton appearance={amountOfFiles === 0 ? 'primary' : 'secondary'} onClick={onAddFiles}>Add</VSCodeButton>
                {/* <VSCodeButton appearance='secondary' onClick={() => setRemoveMode(mode => !mode)} disabled={amountOfFiles === 0}>{removeMode ? "Stop removing" : "Remove"}</VSCodeButton> */}
            </div>
        </div>
    );
    
}