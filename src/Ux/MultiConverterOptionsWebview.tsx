import React from 'react';
import { List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell } from '@vscode/webview-ui-toolkit/react';

interface Props {

}

interface State {
    files: string[],
}

const BACKDROP_STYLE: React.CSSProperties = {
    width: '100vw', backgroundColor: '#00000030', position: 'absolute', padding: '10px'
}
const DIALOG_STYLE: React.CSSProperties = {height: '90', width: '70%', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'};
const innerStyle: React.CSSProperties = {
    display: 'flex', height: '20px', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    paddingLeft: '2px'
};

/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default class MultiConverterOptionsWebview extends React.Component<Props, State> {
    // @ts-ignore
    vscode = acquireVsCodeApi();
    
    constructor(props: Props) {
        super(props);
        this.state = {
            files: []
        };

        this.onMessage = this.onMessage.bind(this); // this is done in tracy, dont know why yet
        window.addEventListener('message', this.onMessage);
        this.vscode.postMessage({command: "clear"});
    }

    onMessage(event: MessageEvent) {
        const message = event.data;
        switch (message.command) {
            case "clear":
                this.setState({files: []}); // temporary
                break;
            case "add-files":
                this.setState({ files: [...this.state.files, ...message.data]});
                break;
        }
    }

    renderFiles() {
        return (
            <VSCodeDataGrid id="files-grid">
                <VSCodeDataGridRow row-rowType='header'>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='1'>File</VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>Type</VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {this.state.files.map((file, index) => (<VSCodeDataGridRow>
                    <VSCodeDataGridCell gridColumn='1'>{file}</VSCodeDataGridCell>
                    <VSCodeDataGridCell gridColumn='2'>csv</VSCodeDataGridCell>
                </VSCodeDataGridRow>))}
            </VSCodeDataGrid>
        );
    }

    doAddFiles(event) {
        //console.log("Sending message");
        //this.setState({ files: [...this.state.files, "test"] });
        this.vscode.postMessage({ command: "add-files" }); // tell extension to show file open dialog
    }

    render() {
        return (
            <div style={BACKDROP_STYLE}>
                <h1>Options</h1>
                <div className='dialog' style={DIALOG_STYLE}>
                    {/* Put the file adding/removing list here */}
                    <h2>Files {}</h2>
                    {this.renderFiles()}
                    {/* <List>
                        <ListItem disablePadding>
                            <ListItemButton>
                                <ListItemText primary="Test"/>
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            <ListItemButton>
                                <ListItemText primary="Test2"/>
                            </ListItemButton>
                        </ListItem>
                    </List> */}
                    <VSCodeButton appearance='secondary' onClick={(e) => this.doAddFiles(e)}>Add</VSCodeButton>
                    {/* Put the file options here */}
                </div>
            </div>
        );
    }
}