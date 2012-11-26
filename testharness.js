var fs = require("fs");
var _ = require("underscore");
var CSG = require("./js/csg");
var parser = require("./openscad-parser").parser;

if (parser.yy === undefined){
	parser.yy = {}
}

var openSCADText = fs.readFileSync("test.scad", "UTF8");

var lines = openSCADText.split("\n");

for (var i in lines){
	var line = lines[i];


	lines[i] = line.replace(/include <([^>]*)>;/, function(match, p1, offset, string) {
		var includedModuleText = fs.readFileSync(p1, "UTF8");
		return includedModuleText;
	});


	lines[i] = line.replace(/use <([^>]*)>;/, function(match, p1, offset, string) {
		var usedModuleText = fs.readFileSync(p1, "UTF8");
		
		var usedModuleResult = parser.parse(usedModuleText);

		parser.yy.context = usedModuleResult.context;

		return match;
	});


}

var openJSCADResult = parser.parse(lines.join('\n'));

console.log(openJSCADResult.lines.join('\n'));
