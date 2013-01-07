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

    var filedir = "modules/";

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
        assert.equal(actual, expected, console.log(testFileName));
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

});