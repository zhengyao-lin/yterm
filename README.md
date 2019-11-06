# yterm

`yterm` is a terminal emulator in web. Similar project [`xterm.js`](https://github.com/xtermjs/xterm.js)

# Project structure

This project is based on typescript and node.

`src/yterm` contains source code for the in browser module.
`src/server` contains a simple server side program that opens a websocket interface,
which, upon connection, will open a bash process and feed the info back to the client (only bind this to localhost!)

`src/test.ts` contains a simple in browser script that uses the module and it's used in `test.html` at the root.

`tests` contains tests of the `yterm` module.

# Usage

```
npm install
npm run build # build yterm module and the test script
npm run server # start up the server

# open test.html now and you should be able to see a terminal screen
```

# Tests and coverage

```
npm run test
npm run coverage
```
