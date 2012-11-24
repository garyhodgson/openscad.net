var assert = require("assert");
var parser = require("../openscad").parser;
var fs = require("fs");

function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("transformations/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("transformations/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test scale"] = function() {
    check("scaleEx1");
    check("scaleEx2");
}

exports["test rotate"] = function() {
    check("rotateEx1");
    check("rotateEx2");
}

exports["test translate"] = function() {
    check("translateEx1");
}

exports["test mirror"] = function() {
    check("mirrorEx1");
}

exports["test multmatrix"] = function() {
    check("multmatrixEx1");
    check("multmatrixEx2");
}

exports["test color"] = function() {
    check("colorEx1");
    check("colorEx1");
}

exports["test minkowski"] = function() {
    // todo
    assert.ok(false);
}

exports["test hull"] = function() {
    // todo
    assert.ok(false);
}

if(module === require.main) require("test").run(exports);