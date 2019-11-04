export class Input {
    private handlers: Array<(a: string) => void>;

    constructor () {
        this.handlers = [];
    }

    onInput (handler: (a: string) => void) {
        this.handlers.push(handler);
    }

    input (data: string) {
        for (const handler of this.handlers) {
            handler(data);
        }
    }
};

export class KeyboardEventInput extends Input {
    constructor (dom: EventTarget) {
        super();
        
        dom.addEventListener("keydown", event => {
            const keyboardEvent = event as KeyboardEvent;

            console.log(keyboardEvent.key, keyboardEvent.charCode, event);

            const input = (str: string) => {
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
                    input("\x1b[B");
                    break;
                
                case "Up":
                case "ArrowUp":
                    input("\x1b[A");
                    break;

                case "Left":
                case "ArrowLeft":
                    input("\x1b[D");
                    break;

                case "Right":
                case "ArrowRight":
                    input("\x1b[C");
                    break;

                case "Enter":
                    input("\n");
                    break;

                case "Esc":
                case "Escape":
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
                        switch (keyboardEvent.key) {
                            case "d":
                                input("\x04");
                                break;

                            case "c":
                                input("\x03");
                                break;

                            case "a":
                                input("\x01");
                                break;

                            case "e":
                                input("\x05");
                                break;
                        }
                    } else {
                        input(keyboardEvent.key);
                    }
            }
        });
    }
}
