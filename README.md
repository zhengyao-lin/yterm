# yterm

`yterm` is a terminal emulator in web. Similar project [`xterm.js`](https://github.com/xtermjs/xterm.js).
My project proposal and weekly rubrics can be found [here](https://gitlab.engr.illinois.edu/zl38/fa19-cs242-project/tree/proposal)

# Project structure

This project is based on typescript and node.

`src` contains source code for the yterm module.  
`demo` contains a minimal demo. See below for usage.  
`tests` contains tests of the `yterm` module.  

# Usage

```
npm install
npm run build # build yterm module
```

# Demo usage

```
npm run demo # start demo server
# open demo/demo.html now and you should be able to see a terminal screen
```

# Tests and coverage

```
npm run test
npm run coverage
```
