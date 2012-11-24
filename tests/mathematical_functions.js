var assert = require("assert");
var parser = require("../openscad").parser;
var fs = require("fs");

function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("mathematical_functions/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("mathematical_functions/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test math functions"] = function() {

}

if(module === require.main) require("test").run(exports);