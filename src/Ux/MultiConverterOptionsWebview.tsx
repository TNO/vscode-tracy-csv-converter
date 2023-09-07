import React from 'react';
import * as Mui from '@mui/material';

interface Props {

}

interface State {

}

const BACKDROP_STYLE: React.CSSProperties = {
    width: '100vw', backgroundColor: '#00000030', position: 'absolute', padding: '10px'
}
const DIALOG_STYLE: React.CSSProperties = {height: '90', width: '70%', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'};
const innerStyle: React.CSSProperties = {
    display: 'flex', height: '20px', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    paddingLeft: '2px'
};

export default class MultiConverterOptionsWebview extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <div style={BACKDROP_STYLE}>
                <div className='dialog' style={DIALOG_STYLE}>
                    {/* Put the file adding/removing list here */}
                    <Mui.List>
                        <Mui.ListItem disablePadding>
                            <Mui.ListItemButton>
                                <Mui.ListItemText primary="Test"/>
                            </Mui.ListItemButton>
                        </Mui.ListItem>
                    </Mui.List>
                    {/* Put the file options here */}
                </div>
            </div>
        );
    }
}