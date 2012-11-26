var assert = require("assert");
var parser = require("../openscad-parser").parser;
var fs = require("fs");

function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("2d_to_3d_extrusion/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("2d_to_3d_extrusion/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test Linear Extrude"] = function() {
    check("linearExtrudeEx1");
    check("linearExtrudeEx2");
    check("linearExtrudeEx3");
    check("linearExtrudeEx4");
    check("linearExtrudeEx5");
    check("linearExtrudeEx6");
    check("linearExtrudeEx7");
}

if(module === require.main) require("test").run(exports);