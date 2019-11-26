/**
 * An abstraction of input
 */
export class Input {
    private handlers: Array<(a: string) => void>;

    public applicationCursorMode: boolean;

    constructor () {
        this.handlers = [];
        this.applicationCursorMode = false;
    }

    onInput (handler: (a: string) => void) {
        this.handlers.push(handler);
    }

    input (data: string) {
        for (const handler of this.handlers) {
            handler(data);
        }
    }

    // https://the.earth.li/~sgtatham/putty/0.60/htmldoc/Chapter4.html#config-appcursor
    setApplicationCursorMode (enable: boolean) {
        this.applicationCursorMode = enable;
    }
};

/**
 * Implements an input device based on the keyboard events in browser
 */
export class KeyboardEventInput extends Input {
    constructor (dom: EventTarget) {
        super();
        
        dom.addEventListener("keydown", event => {
            const keyboardEvent = event as KeyboardEvent;

            // console.log(keyboardEvent.key, keyboardEvent.charCode, event);

            const input = (str: string) => {
                // console.log("inputing", str);

                this.input(str);
                
                keyboardEvent.preventDefault();
                keyboardEvent.stopImmediatePropagation();
            }

            // ESC [ Pn A                      Cursor Up
            // ESC [ Pn B                      Cursor Down
            // ESC [ Pn C                      Cursor Right
            // ESC [ Pn D                      Cursor Left
            switch (keyboardEvent.key) {
                case "Down":
                case "ArrowDown":
                    if (this.applicationCursorMode) {
                        input("\x1bOB");
                    } else {
                        input("\x1b[B");
                    }
                
                    break;
                
                case "Up":
                case "ArrowUp":
                    if (this.applicationCursorMode) {
                        input("\x1bOA");
                    } else {
                        input("\x1b[A");
                    }
                    
                    break;

                case "Left":
                case "ArrowLeft":
                    if (this.applicationCursorMode) {
                        input("\x1bOD");
                    } else {
                        input("\x1b[D");
                    }
                    
                    break;

                case "Right":
                case "ArrowRight":
                    if (this.applicationCursorMode) {
                        input("\x1bOC");
                    } else {
                        input("\x1b[C");
                    }
                    
                    break;

                case "Enter":
                    input("\n");
                    break;

                case "Esc":
                case "Escape":
                    input("\x1b");
                    break;

                case "Control":
                    break;

                case "Shift":
                    break;

                case "Backspace":
                    input("\x08");
                    break;

                case "Delete":
                    input("\x7f");
                    break;

                case "CapsLock":
                    // TODO: switch case
                    break;

                case "Tab":
                    input("\t");
                    break;

                default:
                    if (keyboardEvent.ctrlKey) {
                        // the full list can be found here
                        // http://jkorpela.fi/chars/c0.html
                        const map = "abcdefghijklmnopqrstuvwxyz[\\]^_";
                        const key = keyboardEvent.key;

                        if (key.length == 1) {
                            const index = map.indexOf(key);

                            if (index != -1) {
                                input(String.fromCharCode(1 + index));
                            }
                        }
                    } else {
                        input(keyboardEvent.key);
                    }
            }
        });
    }
}
