var assert = require("assert");
var parser = require("../openscad-parser").parser;
var fs = require("fs");

function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("2d_primitives/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("2d_primitives/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test Square"] = function() {
    check("squareEx1");
}

if(module === require.main) require("test").run(exports);