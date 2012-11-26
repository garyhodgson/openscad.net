var assert = require("assert");
var parser = require("../openscad-parser").parser;
var fs = require("fs");

function parse(s) {
    return parser.parse(s);
}

function check(testFileName) {
    var actual = fs.readFileSync("conditional_and_iterator_functions/"+testFileName+".scad", "UTF8");
    var expected = fs.readFileSync("conditional_and_iterator_functions/"+testFileName+".jscad", "UTF8");
    assert.ok(parse(actual).lines.join('\n').indexOf(expected));
}

exports["test for loop"] = function() {
    check("forLoopEx1");
    check("forLoopEx2a");
    check("forLoopEx2b");
    check("forLoopEx3");
    check("forLoopEx4");
}

exports["test intersection_for loop"] = function() {
    check("intersectionForLoopEx1");
    check("intersectionForLoopEx2");
}

exports["test if statement"] = function() {
    check("ifStatementEx1");
}


exports["test assign statement"] = function() {
    check("ifStatementEx1");
}

if(module === require.main) require("test").run(exports);