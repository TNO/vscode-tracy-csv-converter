import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import React from "react";
import { FileDataContext } from "./FileDataContext";
import { Ext2WebMessage, SubmissionTypes, postW2EMessage, updateWebviewState, vscodeAPI } from "../communicationProtocol";

interface Props {
    dates: [string, string];
}

let initialization = false;
export default function SubmissionComponent({ dates }: Props) {
    const { fileData, fileDataDispatch: _fileDataDispatch } = React.useContext(FileDataContext);

    const amountOfFiles = Object.keys(fileData).length;

    // Style
    const [submitText, setSubmitText] = React.useState("");
    const submitError = submitText.includes("ERROR");

    const [showProcessingRing, setShowProcessingRing] = React.useState(false);

    const sameEdgeDates = dates[0] === dates[1];

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize": {
                initialization = false;
                break;
            }
            case "submit-message":
                setSubmitText(message.text);
                setShowProcessingRing(false);
                break;
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize
        initialization = true;
        const prevState = vscodeAPI.getState();
        if (prevState) {
            // Read prev state
            setSubmitText(prevState.submitText);
        }
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ submitText });
    }, [submitText]);

    function onSubmit(type: SubmissionTypes) {
        setSubmitText("Loading...");
        setShowProcessingRing(true);
        postW2EMessage({ command: "submit", 
            files: fileData, 
            constraints: dates,
            type
        });
    }

    return (
        <div>
            <VSCodeButton appearance={amountOfFiles > 0 ? 'primary' : 'secondary'} 
                onClick={() => onSubmit("save")} 
                disabled={ amountOfFiles === 0 || sameEdgeDates }>
                    Merge and Save
            </VSCodeButton>
            <VSCodeButton appearance={amountOfFiles > 0 ? 'primary' : 'secondary'} 
                onClick={() => onSubmit("open")} 
                disabled={ amountOfFiles === 0 || sameEdgeDates }>
                    Merge and Open
            </VSCodeButton>
            {showProcessingRing && <VSCodeProgressRing/>}
            {submitText.length > 0 && <span style={{ color: submitError ? "red" : undefined }}>{submitText}</span>}
        </div>
    )
}