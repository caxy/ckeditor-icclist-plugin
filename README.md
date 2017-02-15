# ICC List Plugin for CKEditor

## Install

Install via yarn (or npm)

```bash
$ yarn add ckeditor-icclist-plugin # or npm install --save ckeditor-icclist-plugin
```

Install via bower

```bash
$ bower install --save ckeditor-icclist-plugin
```

## Usage

...

## Development

This uses webpack to compile the plugins into the dist directory. The JS files are passed through [babel-loader](https://github.com/babel/babel-loader) and are bundled into a single `plugin.js` file for each plugin directory.

The webpack configuration expects the list of plugins it needs to compile in `config/project.config.js` at property `config.pluginNames`. Therefore, if a plugin directory name is changed, the plugin name in `config/project.config.js` must also be changed.

#### Setup

```bash
$ yarn install
```

#### To compile for release:

```bash
$ yarn run compile
```
