const path = require("path");

module.exports = {
    entry: "./src/yterm.ts",
    devtool: "inline-source-map",
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [ ".ts" ],
    },
    output: {
        library: "yterm",
        libraryTarget: "umd",
        filename: "yterm.js",
        path: path.resolve(__dirname, "dist"),
    },
};
  