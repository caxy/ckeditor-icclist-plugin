const project = require('./project.config');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const _ = require('lodash');

const webpackConfig = {
    name: 'client',
    target: 'web',
    devtool: false,
    resolve: {
        modules: [
            project.paths.client()
        ]
    },
    module: {}
};

webpackConfig.output = {
    filename: `plugin.js`,
    path: project.paths.dist(),
    publicPath: '/'
};

webpackConfig.plugins = [
    new CopyWebpackPlugin([
        {
            from: project.paths.client(),
            to: project.paths.dist(),
            ignore: ['*.js']
        }
    ])
];

// ------------------------------------
// Loaders
// ------------------------------------
// JavaScript / JSON
webpackConfig.module.rules = [
    {
        test    : /\.(js|jsx)$/,
        exclude : /node_modules/,
        use : [
            {
                loader: 'babel-loader',
                options: {
                    cacheDirectory: true,
                    plugins: ['transform-runtime'],
                    presets: ['es2015']
                }
            }
        ]
    }
];

// Loop over each plugin and add webpack config for each.
const webpackMultipleConfigs = [];

for (let i = 0; i < project.pluginNames.length; i++) {
    const pluginName = project.pluginNames[i];

    const pluginWebpackConfig = _.cloneDeep(webpackConfig);

    // Update the entry point to use the plugin's plugin.js file.
    pluginWebpackConfig.entry = project.paths.client(`${pluginName}/plugin.js`);

    // Append the plugin name to the output path.
    pluginWebpackConfig.output.path = pluginWebpackConfig.output.path + '/' + pluginName;

    // Add this plugin's config to the webpack configuration.
    webpackMultipleConfigs.push(pluginWebpackConfig);
}

module.exports = webpackMultipleConfigs;
