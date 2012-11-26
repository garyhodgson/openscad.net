var assert = require("assert");
var fs = require("fs");
var parser = require("../openscad-parser").parser;


function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("submodule_tests/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("submodule_tests/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test transformed submodule"] = function() {
    check("transformedSubmoduleEx1");
}


exports["test transformed submodule with extra line"] = function() {
	check("transformedSubmoduleEx2");
}

exports["test transformed submodule with color mod"] = function() {
	check("transformedSubmoduleEx3");
}

exports["test nested submodules"] = function() {
	check("nestedSubmoduleEx1");
	check("nestedSubmoduleEx2");
}


if(module === require.main) require("test").run(exports);