/**
 * Babel configuration — intended for Jest (babel-jest) only.
 *
 * The webpack build passes its own inline preset options to babel-loader, so we
 * deliberately return an empty config outside the `test` environment to avoid
 * applying presets twice (and to leave the production bundle untouched). Jest
 * runs with BABEL_ENV/NODE_ENV = "test" and needs CommonJS + current-node
 * targets to transform the ES module / JSX sources.
 */
module.exports = api => {
    if (!api.env('test')) {
        return {};
    }

    return {
        presets: [
            ['@babel/preset-env', {targets: {node: 'current'}}],
            '@babel/preset-react'
        ],
        plugins: [
            '@babel/plugin-syntax-dynamic-import'
        ]
    };
};
