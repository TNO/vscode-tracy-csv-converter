/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Property } from "csstype";

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
const verticalPadding = "10px";
const barCssStyle = css({
    borderRadius: "2.5px",
    fontSize: "10px",
    textAlign: "center",
    overflow: "hidden"
});
const thumbCssStyle = css({
    position: "absolute",
    border: "none",
    borderLeft: "1px dotted var(--vscode-editor-foreground)",
    width: "1px",
    height: "100%",
    top: "0px"
});

export default function DateTimeRangeRail(props: Props) {

    function getBar(bar: Bar, index: number) {
        const percentageWidth = (bar.end - bar.begin) * 100 / (props.latest - props.earliest);
        const barHeight = "15px";//`calc((100%-${verticalPadding}*2)/${props.bars.length})%`;
        const percentageLeft = (bar.begin - props.earliest) * 100 / (props.latest - props.earliest);
        
        return (
            <div key={index} className="simple-border" css={barCssStyle} style={{
                backgroundColor: bar.color ?? "var(--vscode-editor-background)",
                width: `${percentageWidth}%`,
                height: barHeight,
                marginLeft: `${percentageLeft}%`
            }}>{bar.label}</div>
        );
    }
    const startThumbLeft = props.begin !== undefined && (props.begin - props.earliest) * 100 / (props.latest - props.earliest);
    const stopThumbLeft = props.end !== undefined && (props.end - props.earliest) * 100 / (props.latest - props.earliest);

    return (
        <div className="simple-border" css={{ width: "100%", paddingTop: verticalPadding, paddingBottom: verticalPadding, position: "relative" }}>
            {!!startThumbLeft && startThumbLeft > 0 && <div css={thumbCssStyle} style={{ left: `${startThumbLeft}%` }} />}
            {props.bars.map(getBar)}
            {!!stopThumbLeft && stopThumbLeft < 100 && <div css={thumbCssStyle} style={{ left: `${stopThumbLeft}%` }} />}
        </div>
    );
}