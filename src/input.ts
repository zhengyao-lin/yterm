export class Input {
    private handlers: Array<(string) => void>;

    constructor () {
        this.handlers = [];
    }

    onInput (handler: (string) => void) {
        this.handlers.push(handler);
    }

    input (data) {
        for (const handler of this.handlers) {
            handler(data);
        }
    }
};

export class KeyboardEventInput extends Input {
    constructor (dom: EventTarget) {
        super();
        
        dom.addEventListener("keydown", (event: KeyboardEvent) => {
            console.log(event.key, event.charCode, event);

            const input = str => {
                this.input(str);
                
                event.preventDefault();
                event.stopImmediatePropagation();
            }

            // ESC [ Pn A                      Cursor Up
            // ESC [ Pn B                      Cursor Down
            // ESC [ Pn C                      Cursor Right
            // ESC [ Pn D                      Cursor Left
            switch (event.key) {
                case "Down":
                case "ArrowDown":
                    input("\x1b[1B");
                    break;
                
                case "Up":
                case "ArrowUp":
                    input("\x1b[1A");
                    break;

                case "Left":
                case "ArrowLeft":
                    input("\x1b[1D");
                    break;

                case "Right":
                case "ArrowRight":
                    input("\x1b[1C");
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

                case "CapsLock":
                    // TODO: switch case
                    break;

                case "Tab":
                    input("\t");
                    break;

                default:
                    if (event.ctrlKey) {
                        switch (event.key) {
                            case "d":
                                input("\x04");
                                break;

                            case "c":
                                input("\x03");
                                break;
                        }
                    } else {
                        input(event.key);
                    }
            }
        });
    }
}
