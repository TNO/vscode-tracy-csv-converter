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
    const [submitStatusText, setSubmitText] = React.useState("");
    const submitError = submitStatusText.includes("ERROR");

    const [isSubmitting, setShowProcessingRing] = React.useState(false);

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

    // Run only on initial mount
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

    // Update state on submit text change, this is for persistence
    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ submitText: submitStatusText });
    }, [submitStatusText]);

    function onSubmit(type: SubmissionTypes) {
        setSubmitText("Loading...");
        setShowProcessingRing(true);
        postW2EMessage({ command: "submit", 
            files: fileData, 
            constraints: dates,
            type
        });
    }

    const disableButtons = amountOfFiles === 0 || sameEdgeDates;
    const buttonAppearance = amountOfFiles > 0 ? "primary" : "secondary";
    return (
        <div className="flex-horizontal flex-colgap">
            <VSCodeButton appearance={buttonAppearance} 
                onClick={() => onSubmit("save")} 
                disabled={ disableButtons }>
                    Merge and Save
            </VSCodeButton>
            <VSCodeButton appearance={buttonAppearance} 
                onClick={() => onSubmit("open")} 
                disabled={ disableButtons }>
                    Merge and Open
            </VSCodeButton>
            {isSubmitting && <VSCodeProgressRing/>}
            {submitStatusText.length > 0 && <span style={{ color: submitError ? "red" : undefined }}>{submitStatusText}</span>}
        </div>
    )
}