import path from "path";
import webpack from "webpack";

const webpackConfig = (env: any): webpack.Configuration => ({
    entry: "./src/Ux/index.tsx",
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    output: {
        path: path.join(__dirname, "/out/ux"),
        filename: "main.js"
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                options: {
                    transpileOnly: true
                },
                exclude: /out/
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
});
export default webpackConfig;