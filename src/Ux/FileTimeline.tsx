/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Tooltip } from "@mui/material";
import { Property } from "csstype";
import { parseDateNumber } from "../utility";
import { WEBVIEW_TIMESTAMP_FORMAT } from "../constants";

interface Bar {
    begin: number;
    end: number;
    color?: Property.BackgroundColor;
    label?: string;
}

interface Props {
    earliest: number;
    latest: number;
    bars: Bar[];
    begin?: number;
    end?: number;
}
const barCssStyle = css({
    borderRadius: "2.5px",
    overflow: "hidden",
    fontSize: "10px",
    textAlign: "center",
});
const thumbCssStyle = css({
    position: "absolute",
    border: "none",
    borderLeft: "1px dotted var(--vscode-editor-foreground)",
    width: "1px",
    height: "100%",
    top: "0px"
});

export default function FileTimeline(props: Props) {

    function getBar(bar: Bar, index: number) {
        const notNan = !(Number.isNaN(bar.begin) || Number.isNaN(bar.end));
        const percentageWidth = notNan ? (bar.end - bar.begin) * 100 / (props.latest - props.earliest) : 100;
        const barHeight = "15px";//`calc((100%-${verticalPadding}*2)/${props.bars.length})%`;
        const percentageLeft = notNan ? (bar.begin - props.earliest) * 100 / (props.latest - props.earliest) : 0;
        
        return (
            <Tooltip disableInteractive title={`${parseDateNumber(bar.begin).format(WEBVIEW_TIMESTAMP_FORMAT)} to ${parseDateNumber(bar.end).format(WEBVIEW_TIMESTAMP_FORMAT)}`}>
                <div key={index} className="simple-border" css={barCssStyle} style={{
                    backgroundColor: bar.color ?? "var(--vscode-editor-background)",
                    width: `calc(${percentageWidth}% - 1px)`,
                    height: barHeight,
                    marginLeft: `${percentageLeft}%`
                }}>{bar.label}</div>
            </Tooltip>
        );
    }
    const startThumbLeft = props.begin !== undefined && (props.begin - props.earliest) * 100 / (props.latest - props.earliest);
    const stopThumbLeft = props.end !== undefined && (props.end - props.earliest) * 100 / (props.latest - props.earliest);

    return (
        <div className="simple-border timeline-vertical-padding" css={{ position: "relative" }}>
            {!!startThumbLeft && startThumbLeft > 0 && <div css={thumbCssStyle} style={{ left: `${startThumbLeft}%` }} />}
            {props.bars.map(getBar)}
            {!!stopThumbLeft && stopThumbLeft < 100 && <div css={thumbCssStyle} style={{ left: `${stopThumbLeft}%` }} />}
        </div>
    );
}