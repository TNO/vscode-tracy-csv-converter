import React from "react";
import SearchInput from "./SearchInput";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { DEFAULT_TERM_SEARCH_INDEX } from "../constants";
import { TermFlags } from "../communicationProtocol";
import { cloneDeep } from "lodash";
import { Tooltip } from "@mui/material";

interface Props {
    minHeaders: number;
    onChange?: (terms: [string, TermFlags][], searchHeaderIndex: number) => void;
}
// [string, termflags], number
export default function TermSearch({ minHeaders, onChange }: Props) {
    const [headerToSearch, setHeaderToSearch] = React.useState(DEFAULT_TERM_SEARCH_INDEX);
    const [terms, setTerms] = React.useState<{[s: string]: TermFlags}>({});
    
    const headersArray: number[] = (minHeaders > 0) ? new Array(minHeaders).fill(0) : [];
    return (<div>
        Header Index:
        <VSCodeDropdown value={headerToSearch.toString()} disabled={minHeaders === 0} onInput={(e: React.BaseSyntheticEvent) => setHeaderToSearch(parseInt(e.target.value))}>
            {headersArray.map((_, v) => (<VSCodeOption key={v} value={v.toString()}>{v.toString()}</VSCodeOption>))}
        </VSCodeDropdown>
        <SearchInput clearOnSearch onSearch={(s: string, f: TermFlags) => {
            const newTerms = cloneDeep(terms);
            newTerms[s] = f;
            setTerms(newTerms);
        }} disabled={minHeaders === 0}/>
        <div>
            {Object.keys(terms).map(s => (
                <div key={s} style={{display: "flex", justifyContent: "space-between", marginRight: '5px', marginBottom: '1px', padding: '5px', background: '#FFFFFF10'}}>
                    <span>{s}</span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span>{flagsToString(terms[s])}</span>
                        <span
                            slot="end"
                            style={{ cursor: "pointer", color: "red", margin: "2px" }}
                            className="codicon codicon-close"
                            onClick={() => {
                                const newTerms = cloneDeep(terms);
                                delete newTerms[s];
                                setTerms(newTerms);
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>);
}

function flagsToString(f: TermFlags) {
    return `F${f.caseSearch?1:0}${f.wholeSearch?1:0}${f.reSearch?1:0}`;
}