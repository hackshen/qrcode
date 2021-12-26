const path = require('path');
const env = process.env.NODE_ENV;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const copyWpackPlugin = require('copy-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HappyPack = require('happypack');
const os = require('os')

const happyThreadPool = HappyPack.ThreadPool({size: os.cpus().length})
const outDirObj = [
  {
    filename: 'popup.html',
    template: './src/popup.html',
    chenks: 'popup',
  },
];
const dir = outDirObj.map(item => {
  const {filename, template, chunks} = item;
  return new HtmlWebpackPlugin({
    filename,
    template,
    chunks,
  })
})

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

const htmlBackground = new HtmlWebpackPlugin({
  filename: 'background.html',
  template: './src/background.html',
  chunks: ['background']
});
const table = new HtmlWebpackPlugin({
  filename: 'table.html',
  template: './src/table.html',
  chunks: ['table']
});

const cssPlugin = new MiniCssExtractPlugin({
  filename: env === 'dev' ? 'index.css' : 'index.[hash:8].css'
});

module.exports = {
  mode: env === 'dev' ? 'development' : 'production',
  watchOptions: {
    ignored: /node_modules/
  },
  entry: {
    popup: './src/popup.js',
    background: './src/background.js',
    table: './src/table.js'
  },

  output: {
    path: path.join(__dirname, './assets'),
    filename: env === 'dev' ? '[name].js' : '[name].js'
    // filename: env === 'dev' ? '[name].js' : '[name].[hash:8].js'
  },
  // watch: true,
  // watchOptions: {
  //     poll: 1000,  // 每秒查询1000次
  //     aggregateTimeout: 500, // 防抖，节流
  //     ignored: /node_modules/  //不需要监控的文件
  // },
  devtool: env === 'dev' ? 'cheap-module-source-map' : 'source-map',
  devServer: {
    contentBase: path.join(__dirname, 'assets'),
    host: 'localhost',
    port: '7766',
    progress: true,
    open: true,
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
        use: {
          // loader: 'babel-loader',
          loader: 'happypack/loader?id=happyBabel',
          // options: {
          //     presets: [
          //         ['@babel/preset-env', {
          //             "useBuiltIns": "usage"
          //         }]
          //     ],
          //     plugins: [[
          //         '@babel/plugin-transform-runtime',
          //         {
          //             corejs: { version: 3 } // 指定 runtime-corejs 的版本，目前有 2 3 两个版本
          //         }
          //     ]]
          // }
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: "css-loader"
        })
        // use: ['style-loader', 'css-loader']
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
  plugins: [new ExtractTextPlugin('[name].[hash:8].css'), table, htmlPlugin, htmlBackground, cssPlugin, copyPlugin, cleanPlugin,
    new HappyPack({
      // id标识happypack处理那一类文件
      id: 'happyBabel',
      // 配置loader
      loaders: [{
        loader: 'babel-loader'
      }],
      // 共享进程池
      threadPool: happyThreadPool,
      // 日志输出
      verbose: true
    })
  ]
}
