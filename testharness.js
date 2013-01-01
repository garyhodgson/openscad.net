var requirejs = require('requirejs');

requirejs.config({
    baseUrl: 'js/app',
    paths: {
        lib: '../lib'
    },
    nodeRequire: require
});

requirejs(["fs", "openscad-parser", "Globals", "openscad-parser-support"], 
    function(fs, parser, Globals, parser_support) {

	if (parser.yy === undefined){
		parser.yy = {}
	}

	logMessage = function(msg){
		console.log("\n"+msg+"\n");
	}

	var openSCADText = fs.readFileSync("test.scad", "UTF8");

	openSCADText = Globals.preParse(openSCADText);

	var lines = openSCADText.split("\n");

	for (var i in lines){
		var line = lines[i];


		lines[i] = line.replace(/include <([^>]*)>;?/, function(match, p1, offset, string) {
			var includedModuleText = fs.readFileSync(p1, "UTF8");
			return includedModuleText;
		});


		lines[i] = line.replace(/use <([^>]*)>;?/, function(match, p1, offset, string) {
			var usedModuleText = fs.readFileSync(p1, "UTF8");
			
			var usedModuleResult = parser.parse(usedModuleText);

			parser.yy.context = usedModuleResult.context;

			return match;
		});


	}

	var joinedLines = lines.join('\n');

	console.log(joinedLines);


	var openJSCADResult = parser.parse(joinedLines);

	console.log(openJSCADResult.lines.join('\n'));




});
