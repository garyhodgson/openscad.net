requirejs.config({
		baseUrl: 'js/app',
		paths: {
				lib: '../lib'
		},
		shim: {
				'lib/jquery-ui-latest': ['lib/jquery-latest'],
				'lib/jquery.layout-latest': ['lib/jquery-latest', 'lib/jquery-ui-latest'],
				'lib/jquery-ui-latest': ['lib/jquery-latest'],
				'lib/jquery.fontselector': ['lib/jquery-latest'],
				'lib/jquery.jstree': ['lib/jquery-latest'],
				'lib/jquery.textarea': ['lib/jquery-latest'],
				'lib/jquery.mousewheel': ['lib/jquery-latest'],
				'lib/bootstrap': ['lib/jquery-latest'],
				'lib/bootbox': ['lib/bootstrap'],
				'lib/garlic': ['lib/jquery-latest']
			}
});

define("main",["DropBoxPersistence", "UI", "Controller",
		"lib/underscore", "lib/lightgl", "lib/csg","openjscad"], function(Persistence, UI, Controller) {

		$(function() {

			var persistence = new Persistence();
			var controller = new Controller(persistence);
			var ui = new UI(controller);

			controller.setUI(ui);
			
			ui.setFilesystemName(persistence.getFilesystemName())
			ui.initialise();

		});

});