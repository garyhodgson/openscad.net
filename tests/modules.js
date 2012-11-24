var assert = require("assert");
var parser = require("../openscad").parser;
var fs = require("fs");

function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("modules/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("modules/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test modules"] = function() {
    check("modulesEx1");
}

exports["test modules child"] = function() {
    check("modulesChildEx1");
}

exports["test modules children"] = function() {
    check("modulesChildrenEx1");
}

exports["test modules parameters"] = function() {
    check("modulesParametersEx1");
}

if(module === require.main) require("test").run(exports);