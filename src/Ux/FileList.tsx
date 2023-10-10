import React from 'react';
import { cloneDeep } from 'lodash';
import { Tooltip } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { vscodeAPI, FileData, FILE_STATUS_TABLE, Ext2WebMessage, FileStatus, postW2EMessage, updateWebviewState } from '../communicationProtocol';

interface Props {
    files: {[s: string]: FileData},
    headers_per_file: {[s: string]: string[]},
    setFiles: React.Dispatch<React.SetStateAction<{ [s: string]: FileData }>>
}

let initialization = false;
export default function FileList({files, headers_per_file, setFiles}: Props) {
    // Initialize states, this is here because the converters.ts imports fs and vscode
    const [convertersList, setConvertersList] = React.useState<string[]>(["Getting converters"]);

    // const [removeMode, setRemoveMode] = React.useState(false);
    const removeMode = true;

    const [filesStatus, setFilesStatus] = React.useState<{ [s: string]: FileStatus }>({});

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize":
                setConvertersList(message.converters);
                initialization = false;
                break;
            case "warning":
                setFilesStatus((filesStatus) => {
                    const newFilesStatus = cloneDeep(filesStatus);
                    message.file_names.forEach((f, i) => {
                        newFilesStatus[f] = { ...newFilesStatus[f], warning: message.messages[i] };
                    });
                    return newFilesStatus;
                });
                break;
            case "error":
                setFilesStatus((filesStatus) => {
                    const newFilesStatus = cloneDeep(filesStatus);
                    message.file_names.forEach((f, i) => {
                        newFilesStatus[f] = { ...newFilesStatus[f], error: message.messages[i] };
                    });
                    return newFilesStatus;
                });
                break;
            case "add-files": { // When new files are read by the extension, send to the webview and add them here
                // Add the requested files
                setFiles((files) => {
                    const newFiles = cloneDeep(files);
                    message.data.forEach((file_name) => {
                        if (!newFiles[file_name]) {
                            newFiles[file_name] = { converter: 0 };
                        }
                    });
                    return newFiles;
                });
                break;
            }
            case "metadata": {
                setFilesStatus((filesStatus) => {
                    const newFilesStatus = cloneDeep(filesStatus);
                    Object.keys(message.headers).forEach((f) => {
                        newFilesStatus[f] = {
                            ...newFilesStatus[f],
                            status: FILE_STATUS_TABLE.ReceivedHeaders(message.headers[f].length),
                        };
                    });
                    return newFilesStatus;
                });
                break;
            }
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', onMessage);
        // Read persistance state
        const prevState = vscodeAPI.getState();
        if (prevState) {
            initialization = true;
            setFilesStatus(prevState.filesStatus);
            setConvertersList(prevState.convertersList);
        }
    }, []);

    // Update persistance state
    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ filesStatus, convertersList });
    }, [filesStatus, convertersList]);

    const amountOfFiles = Object.keys(files).length;

    // When you change the converter you want to use for a specific file
    const onConverterSwitch = (file: string, value: string) => {
        // Set the state
        const newFiles = cloneDeep(files);
        newFiles[file].converter = parseInt(value);
        setFiles(newFiles);

        const newFilesStatus = cloneDeep(filesStatus);
        newFilesStatus[file] = { status: FILE_STATUS_TABLE.New()};
        setFilesStatus(newFilesStatus);
    };

    const onRemoveFileRow = (file: string) => {
        const newFiles = cloneDeep(files);
        delete newFiles[file];
        setFiles(newFiles);
        const newFilesStatus = cloneDeep(filesStatus);
        delete newFilesStatus[file];
        setFilesStatus(newFilesStatus);
    };

    const onAddFiles = () => {
        vscodeAPI.postMessage({ command: "add-files" });
    };

    const renderFileRow = (file: string) => {
        const iconStyle: React.CSSProperties = { width: 10, height: 10, color: removeMode ? 'red' : '', cursor: removeMode ? 'pointer' : 'default' };
        const fileStatus = filesStatus[file];
        let fileStatusText = fileStatus?.status;
        let fileStatusColor = undefined;
        if (fileStatus?.error) {
            fileStatusText = "Error: " + fileStatus.error;
            fileStatusColor = "#FF0000"; // red
        } else if (fileStatus?.warning) {
            fileStatusText += " Warning: " + fileStatus.warning;
            fileStatusColor = "#FF5733"; // warning orange
        }
        const statusStyle: React.CSSProperties = { color: fileStatusColor };

        return (
            <VSCodeDataGridRow key={file+"dropdown"}>
                <VSCodeDataGridCell gridColumn='1'>
                    {removeMode && <div style={iconStyle} className='codicon codicon-close' onClick={() => onRemoveFileRow(file)}/>}
                    {!removeMode && <div style={iconStyle} className='codicon codicon-circle-filled'/>}
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='2'>{file}</VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='3'>
                    {/* Show converters for the file */}
                    <VSCodeDropdown style={{ width: '100%' }} value={files[file].converter.toString()} onInput={(e: React.BaseSyntheticEvent) => onConverterSwitch(file, e.target.value)}>
                        {convertersList.map((converter_name, index) => ( // TODO: disable unusable converters (based on filename?)
                            <VSCodeOption key={converter_name + " converter"} value={index.toString()}>{converter_name}</VSCodeOption>
                        ))}
                    </VSCodeDropdown>
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='4'>
                    <span style={statusStyle}>{ fileStatusText }</span>
                </VSCodeDataGridCell>
            </VSCodeDataGridRow>
        );
    };

    
    return (
        <div style={{ paddingBottom: 5, width: '100%' }}>
            <h2>Files</h2>
            <VSCodeDataGrid id="files-grid" gridTemplateColumns='2vw 40vw 250px' style={{ border: "1px solid white", minHeight: "100px" }}>
                <VSCodeDataGridRow row-rowType='sticky-header'>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='1'></VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>File</VSCodeDataGridCell>
                    <Tooltip title="The format of the file.">
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='3'>Format</VSCodeDataGridCell>
                    </Tooltip>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='4'>Status</VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {Object.keys(files).map((file) => renderFileRow(file))}
            </VSCodeDataGrid>
            <div style={{ paddingTop: 5 }}>
                <VSCodeButton appearance={amountOfFiles === 0 ? 'primary' : 'secondary'} onClick={onAddFiles}>Add</VSCodeButton>
                {/* <VSCodeButton appearance='secondary' onClick={() => setRemoveMode(mode => !mode)} disabled={amountOfFiles === 0}>{removeMode ? "Stop removing" : "Remove"}</VSCodeButton> */}
            </div>
        </div>
    );
    
}