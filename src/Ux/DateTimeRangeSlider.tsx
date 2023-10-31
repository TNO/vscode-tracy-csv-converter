/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import dayjs from "dayjs";
import React from "react";
import { WEBVIEW_TIMESTAMP_FORMAT } from "../constants";
import { Slider, Tooltip } from "@mui/material";
import { FileDataContext } from "./FileDataContext";
import { parseDateString } from "../utility";

interface Props {
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
    earliestDate: dayjs.Dayjs;
    latestDate: dayjs.Dayjs;
    onChange: (v: number | number[], t: number) => void;
    onChangeCommitted: () => void;
}

export default function DateTimeRangeSlider({startDate, endDate, earliestDate, latestDate, onChange, onChangeCommitted}: Props) {

    const { fileData, fileDataDispatch: _ } = React.useContext(FileDataContext);

    const startStopMarks = React.useMemo(() => 
        Object.keys(fileData).map(f => fileData[f].dates)
            .reduce((p: {value: number}[], d: [string, string]) => 
                p.concat([
                    { value: parseDateString(d[0]).valueOf() },
                    { value: parseDateString(d[1]).valueOf() }
                ]), [])
    , [fileData]);

    const [stepSize, setStepSize] = React.useState(60_000);
    const shifted = React.useRef(false);
    const control = React.useRef(false);
    function updateStepSize() {
        setStepSize(60_000 / ((control.current ? 1000 : 1) * (shifted.current ? 60 : 1)));
    }
    const onKeydown = (event: KeyboardEvent) => {
        if (event.key === "Shift") {
            shifted.current = true;
            updateStepSize();
        }
        if (event.key === "Control") {
            control.current = true;
            updateStepSize();
        }
    };
    const onKeyup = (event: KeyboardEvent) => {
        if (event.key === "Shift") {
            shifted.current = false;
            updateStepSize();
        }
        if (event.key === "Control") {
            control.current = false;
            updateStepSize();
        }
    }

    // Run only once!
    React.useEffect(() => {
        window.addEventListener("keydown", onKeydown);
        window.addEventListener("keyup", onKeyup);
    }, []);

    const helpListItemStyle = css({ fontSize: "14px", padding: "5px", listStyleType: "circle"});
    return <div css={{width: "100%"}}>
        <Tooltip title={<ul>
                <li css={helpListItemStyle}>Use the arrow keys to fine tune your selection.</li>
                <li css={helpListItemStyle}>Default step size: <b>1 minute</b>.</li>
                <li css={helpListItemStyle}>Hold <b>Shift</b> for a step size of <b>1 second</b>.</li>
                <li css={helpListItemStyle}>Hold <b>Ctrl</b> for a step size of <b>60 ms</b>.</li>
                <li css={helpListItemStyle}>Hold <b>Shift</b> and <b>Ctrl</b> for a stepsize of <b>1 ms</b>.</li>
            </ul>}>
            <i className="codicon codicon-question" />
        </Tooltip>
        <div css={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <span>{startDate.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
            <span>{endDate.format(WEBVIEW_TIMESTAMP_FORMAT)}</span>
        </div>
        <Slider
            value={[startDate.valueOf(), endDate.valueOf()]}
            min={earliestDate.valueOf()}
            max={latestDate.valueOf()}
            step={stepSize}
            onChange={(_, v, t) => onChange(v, t)}
            onChangeCommitted={onChangeCommitted}
            marks={startStopMarks}
            disableSwap
            sx={{
                '& .MuiSlider-thumb': {
                    borderRadius: '1px',
                    width: "5px"
                },
            }}
        />
    </div>
}