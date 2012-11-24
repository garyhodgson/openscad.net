var assert = require("assert");
var parser = require("../openscad").parser;
var fs = require("fs");

function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("primitive_solids/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("primitive_solids/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test cube"] = function() {
    check("cubeEx1");
    check("cubeEx2");
}

exports["test sphere"] = function() {
    check("sphereEx1");
    check("sphereEx2");
}


exports["test cylinder"] = function() {
    check("cylinderEx1");
    check("cylinderEx2");
    check("cylinderEx3");
    check("cylinderEx5");
}

exports["test cylinder additional parameters"] = function() {
    check("cylinderEx4"); // fails due to missing fs and fa parameters
}

exports["test polyhedron"] = function() {
    check("polyhedronEx1");
    check("polyhedronEx2");
}

if(module === require.main) require("test").run(exports);
