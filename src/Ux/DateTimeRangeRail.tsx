/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";

interface Bar {
    begin: number;
    end: number;
    color?: string;
}

interface Props {
    begin: number;
    end: number;
    bars: Bar[];
}
const verticalPadding = "10px";

export default function DateTimeRangeRail(props: Props) {
    // First need a container
    // inside the container are the bars, are the bars given colors?
    

    function getBar(bar: Bar) {
        const percentageWidth = (bar.end - bar.begin) * 100 / (props.end - props.begin);
        const percentageHeight = "10px";//`calc((100%-${verticalPadding}*2)/${props.bars.length})%`;
        const percentageLeft = (bar.begin) * 100 / (props.end - props.begin);
        const style = css({
            backgroundColor: bar.color ?? "lightgrey",
            width: `${percentageWidth}%`,
            height: percentageHeight,
            marginLeft: `${percentageLeft}%`,
            borderRadius: "2.5px",
        });
        return (
            <div css={style}></div>
        );
    }

    return (
        <div className="simple-border" css={{ width: "100%", paddingTop: verticalPadding, paddingBottom: verticalPadding }}>
            {props.bars.map((bar, index) => getBar(bar))}
        </div>
    );
}