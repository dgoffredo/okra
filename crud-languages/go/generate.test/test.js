#!/usr/bin/env node

'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../../../dependencies/node-amd-loader/amd-loader');

// TODO: it's so hacky in here I can't breathe
/*
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {renderFile} = require('../render');
const {glob} = require('../../../lib/filesystem');
*/

const {generate} = require('../generate');

console.log(generate({}));
