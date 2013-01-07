var requirejs = require('requirejs');

requirejs.config({
    baseUrl: '../js/app',
    paths: {
        lib: '../lib'
    },
    nodeRequire: require
});

requirejs(["fs", "assert", "openscad-parser", "Globals", "openscad-parser-support"], 
    function(fs, assert, parser, Globals, parser_support) {

    var filedir = "2d_primitives/";

	logMessage = function(msg){
		console.log("\n"+msg+"\n");
	}

	function parse(s) {
	    return parser.parse(s);
	}

	function check(testFileName) {
	    var test = fs.readFileSync(filedir+testFileName+".scad", "utf8");
	    var expected = fs.readFileSync(filedir+testFileName+".jscad", "utf8").replace(/\n/g,'');
	    var actual = parse(test).lines.join('').replace(/\n/g,'');
	    assert.equal(actual, expected);
	}

	exports["test Square"] = function() {
	    check("squareEx1");
	}

	if(module === require.main) require("test").run(exports);

});