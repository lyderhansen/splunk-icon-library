var path = require('path');

module.exports = {
    target: ['web', 'es5'],
    entry: './src/visualization_source.js',
    output: {
        filename: 'visualization.js',
        path: path.resolve(__dirname),
        libraryTarget: 'amd',
        environment: {
            arrowFunction: false,
            bigIntLiteral: false,
            const: false,
            destructuring: false,
            forOf: false,
            dynamicImport: false,
            module: false
        }
    },
    externals: [
        'api/SplunkVisualizationBase'
    ]
};
