define("Controller", ["Globals", "openscad-parser"], function(Globals, openscadParser){

	var globalLibs = {};
	var importCache = {};

	function Controller(persistence){
		this.persistence = persistence;
		this.connectedToFilesystem = false;
		this.modelIsShown = false;
	};

	Controller.prototype = {

		setUI: function(ui){
			this.ui = ui;
		},

		connect: function(callback){
			var _controller = this;
			this.persistence.connect(function(){
				callback(_controller);
			})
		},

		disconnect: function(callback){
			if (this.connectedToFilesystem){
				var _controller = this;
				this.ui.confirm("Disconnect from "+this.ui.filesystemName+"?", function(confirmed) {
					if (!confirmed) return;

					_controller.persistence.disconnect(function(){
						callback(_controller);
					});

				});
			}
		},

		readDir:  function(path, root) {

			var _controller = this;

				//todo - stats leaks from dropbox - refactor to generic structure
				this.persistence.readDir(path, function(stats){

					_.each(stats, function (stat) {

						var id = stat.path.replace(/\//g, '_').replace(/\./g, '_')

						if (stat.isFile){
							_controller.ui.filetree.create_node(
								root, 'inside', 
								{ attr: {id:id, class:"dbFile"}, metadata: {stat: stat}, data: {title:stat.name, icon: "img/led-icons/page_white_text.png"} }
								);
						} else {
							_controller.ui.filetree.create_node(
								root, 'inside', 
								{ attr: {id:id},  state: "closed", metadata: {stat: stat}, data: stat.name }
								);
						}

					});

					_controller.ui.filetree.open_node(root);
					root.data("isloaded", true);

				});
			},

			readFile: function(path, callback) {
				var _controller = this;
				this.persistence.openFile(path, function(content, stat){
					callback(content, stat.path);
				});
			},

			writeFile: function(path, content, callback) {
				var _controller = this;
				this.persistence.writeFile(path, content, callback);      
			},

			updateSolid: function() {

				var _controller = this;

				var text = $('#editor').val().trim();

				if (_.isEmpty(text)){
					return;
				}

				if ($('#sourcetype_openscad').attr("checked")== "checked"){

					_controller.collateLibraries(text, function(libs){

						var lines = text.split("\n");
						var libraries = [];

						for (var i in lines){
							var line = lines[i];

							var includedLibrary = line.match(Globals.includedLibraryRegex);
							if (includedLibrary != null){
								libraries.push(['include',includedLibrary[1]]);
							}

							var usedLibrary = line.match(Globals.usedLibraryRegex);
							if (usedLibrary != null){
								libraries.push(['use',usedLibrary[1]]);
							}

							var importedObject = line.match(Globals.importedObjectRegex);
							if (importedObject != null){
								libraries.push(['import',importedObject[1]]);
							}

						}
						_controller.newParse(lines, libraries, function(result){
							_controller.ui.display(result);
							_controller.modelIsShown = true;
						});
					});
				} else {
					gProcessor.setJsCad(text, getOutputFilename());
					_controller.modelIsShown = true;
				}
			},

			attemptFilesystemConnection: function(){
				if (this.persistence.shouldConnect()){
					this.connect(this.ui.whenConnectedToFilesystem);
				}
			},

			collateLibraries: function(text, callback){

				var _controller = this;

				_controller.extractLibraryNames(text);

				_.each(globalLibs, function (value, key, list) {
					if (value == undefined){

					  var isBinary = /.*\.stl$/.test(key); // default to reading all stl files as binary

					  _controller.persistence.readFile(key, isBinary, function(content) {
						globalLibs[key] = content;
						_controller.collateLibraries(isBinary?"":content, callback);
					  });
					}
				})

				if (callback){
					var currentGlobalLibContents = _.values(globalLibs);

					if (_.indexOf(currentGlobalLibContents, undefined) == -1){
						callback();
					}
				}
			},



			extractLibraryNames: function(text) {
				var lines = text.split("\n");
				for (var i in lines){
					var line = lines[i];

					var includedLibrary = line.match(Globals.includedLibraryRegex);
					if (includedLibrary != null){
						globalLibs[includedLibrary[1]] = undefined;
					}

					var usedLibrary = line.match(Globals.usedLibraryRegex);
					if (usedLibrary != null){
						globalLibs[usedLibrary[1]] = undefined;
					}

					var importedObject = line.match(Globals.importedObjectRegex);
					if (importedObject != null){
						globalLibs[importedObject[1]] = undefined;
					}

				}
			},

			newParse: function(lines, libraries, callback) {

				if (libraries.length>0){

					var library = libraries[0];
					var isUse = library[0] == 'use';
					var isInclude = library[0] == 'include';
					var isImport = library[0] == 'import';
					var filename = library[1];

					var libContent = globalLibs[filename]||"";

					switch (library[0]){
						case 'use':
							// the following hack puts single line module definitions into braces
							libContent = Globals.preParse(libContent);

							var usedModuleResult = openscadParser.parse(libContent);
							openscadParser.yy.context = usedModuleResult.context;
							break;
							case 'include':
							// the following hack puts single line module definitions into braces
							libContent = Globals.preParse(libContent);

							var fileTextLines = libContent.split("\n");
							lines = _.union(fileTextLines, lines);
							break;
							case 'import':
							importCache[filename] = libContent;
							openscadParser.yy.importCache = importCache;
							break;
							default:
							throw Error("Unknown parse replacement command: " + library[0]);
						}

					newParse(lines, libraries.slice(1), callback);

				} else {
					var joinedLines = lines.join('\n');

					// the following hack puts single line module definitions into braces
					joinedLines = Globals.preParse(joinedLines);

					try {
						var result = openscadParser.parse(joinedLines);
						callback(result);
					} catch (e) {
						console.error(e.message);
						console.error(e.stack);
						logMessage("Error: " + e);
					}
				}

			}

		}


	return Controller;


})