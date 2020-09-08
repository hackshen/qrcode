const path = require('path');
const env = process.env.NODE_ENV;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const copyWpackPlugin = require('copy-webpack-plugin')
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

const cleanPlugin = env === 'dev' ? () => {
} : new CleanWebpackPlugin();

const copyPlugin = new copyWpackPlugin(
    //接受一个数组 可以多个文件
    [{
        from: './src/dist',
        to: './'
    }]
);

const htmlPlugin = new HtmlWebpackPlugin({
    filename: 'popup.html',
    template: './src/popup.html',
    chunks: ['popup']
    // minify: {
    // removeAttributeQuotes:true,
    // collapseWhitespace:true,
    // },
    // hash : true
});

const cssPlugin = new MiniCssExtractPlugin({
    filename: env === 'dev' ? 'index.css' : 'index.[hash:8].css'
});

module.exports = {
    mode: env === 'dev' ? 'development' : 'production',
    entry: {
        popup: './src/popup.js'
    },

    output: {
        path: path.join(__dirname, './build'),
        filename: env === 'dev' ? '[name].js' : '[name].[hash:8].js'
    },
    // watch: true,
    // watchOptions: {
    //     poll: 1000,  // 每秒查询1000次
    //     aggregateTimeout: 500, // 防抖，节流
    //     ignored: /node_modules/  //不需要监控的文件
    // },
    devtool: env === 'dev' ? 'cheap-module-source-map' : 'source-map',
    devServer: {
        host: 'localhost',
        port: '7766',
        progress: true,
        open: false,
        hot: true,
    },
    resolve: {
        extensions: ['.js', '.jsx', '.css', '.scss', '.json'],
        alias: {
            //配置后可以直接用@来表示这个位置,直接应用目录下得文件,是绝对路径
            '@': path.join(__dirname, './src')
        }
    },
    module: {
        rules: [
            {
                test: /\.md$/,
                use: "raw-loader"
            },
            {
                test: /\.(js|jsx)$/,
                use: {loader: 'babel-loader'},
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader']
            }, {
                test: /\.(png|jpg|gif)/,
                use: [{
                    loader: 'url-loader',
                    options: {
                        name: '[hash:8].[ext]',
                        outputPath: 'img',
                        limit: 500000
                    }
                }]
            }
        ]
    },
    plugins: [htmlPlugin, cssPlugin, copyPlugin, cleanPlugin]
}
