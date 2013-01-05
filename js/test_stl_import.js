define("test_stl_import", ["lib/jquery-latest", "lib/dropbox",  "lib/underscore", "app/text!../tmp/example016.stl", "app/StlDecoder"], 
	function(jQuery, dropbox, underscore, test_stl, StlDecoder) {

	$(function() {

		var canvas = document.getElementById("myCanvas");
		var context = canvas.getContext("2d");	
		context.strokeStyle = 'black';
		var rX = 270;
		var rY = 0;
		var rZ = 0;

		var stlDecoder = new StlDecoder(test_stl);
		context.strokeStyle = 'black';
		stlDecoder.decode();
		stlDecoder.drawWireFrame(context, canvas.width, canvas.height, 100, rX, rY, rZ);

		console.log(stlDecoder.getCSG());
		console.log(stlDecoder.getCSGString());

	});
	
});