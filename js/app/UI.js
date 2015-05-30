define("UI", [	"lib/jquery-latest",
				"lib/text!../../examples.insert.html",
				"lib/jquery-ui-latest",
				"lib/jquery.layout-latest",
				"lib/jquery.fontselector",
				"lib/modernizr",
				"lib/jquery.jstree",
				"lib/bootstrap",
				"lib/jquery.textarea",
				"lib/jquery.mousewheel",
				"lib/garlic",
				"lib/shortcut",
				"lib/bootbox"], function(jQuery, examples_insert){

	var uiLayout, logLayout;
	var colorSchemes = {
		"cornfield": { backgroundColor: [255/255, 255/255, 229/255], faceColor: [249/255, 215/255, 44/255, 1.0] },
		"metallic": { backgroundColor: [170/255, 170/255, 255/255], faceColor: [221/255, 221/255, 225/255, 1.0] },
		"sunset": { backgroundColor: [170/255, 68/255, 68/255], faceColor: [255/255, 170/255, 170/255, 1.0] },
		"sunrise": { backgroundColor: [196/255, 207/255, 210/255], faceColor: [255/255, 245/255, 184/255, 1.0] }
	};

	var lastEditorContent = '';

	var autoReload;

	function UI(controller){
		this.controller = controller;
		this.filetree;
		this.filesystemName = "Filesystem";
		this.gProcessor = null;
		this.editorIsDirty = false;
	};

	UI.prototype = {

		updateSolid: function(){
			var text = $('#editor').val().trim();
			var isOpenscadSyntax = $('#sourcetype_openscad').attr('checked');
			var filePath = $('#currentFilename').val();
			if (filePath){
				filePath = filePath.replace(/[^\/]*$/, "");
			}

			this.controller.updateSolid(
				text,
				isOpenscadSyntax,
				filePath
			);
		},

		toggleGrid: function(show){
			show_grid = show;
			if (this.controller.modelIsShown){
				this.updateSolid();
			}
		},

		toggleAxis: function(show){
			show_axis = show;
			if (this.controller.modelIsShown){
				this.updateSolid();
			}
		},

		initialise: function() {

			var _ui = this;

			if (!Modernizr.webgl){
				this.log("This app needs webGL - Google Chrome would be a good choice of browser.");
				return
			}

			uiLayout = $('#container').layout({
				minSize: 100,
				center__paneSelector: ".outer-center",
				west__onresize_end: $.proxy(_ui.resizeEditor, _ui),
				stateManagement: {
					enabled: true,
					cookie: {
						name: "uiLayout"
					}
				},
				enableCursorHotkey: false,
				center__children: {
					minSize: 10,
					center__onresize_end: $.proxy(_ui.resizeViewer, _ui),
					south__size: 50,
					stateManagement: {
						enabled: true,
						cookie: {
							name: "logLayout"
						}
					}
				}
			});

			logLayout = $("#center-container").layout({
				center__paneSelector: ".outer-center"
			});

			$('#settingsForm').garlic({conflictManager: {enabled: false}});
			show_axis = $('input[name=menu_view_show_axis]').attr("checked")=="checked";
			show_grid = $('input[name=menu_view_show_grid]').attr("checked")=="checked";
			autoReload = $('input[name=menu_design_auto_reload]').attr("checked")=="checked";
			_ui.hideEditor();
			_ui.hideConsole();
			if (!$('#sourcetype_openscad').attr('checked') && !$('#sourcetype_openjscad').attr('checked')){
				$('#sourcetype_openscad').attr('checked','checked');
			}

			$('#editor').tabby({tabString:'    '});

			if (localStorage.lastEdit !== undefined){
				_ui.setEditorContent(localStorage.getItem("lastEdit"));
				_ui.editorIsDirty = true;
			} else {
				_ui.setEditorContent("// Example script. Press F4, or choose Reload and Compile from the Design menu, to render.\n\nsize = 50;\nhole = 25;\n\nfunction r_from_dia(d) = d / 2;\n\ncy_r = r_from_dia(hole);\ncy_h = r_from_dia(size * 2.5);\n\nmodule rotcy(rot, r, h) {\n    rotate(90, rot)\n      cylinder(r = r, h = h, center = true);\n}\n\ndifference() {\n    sphere(r = r_from_dia(size));\n    rotcy([0, 0, 0], cy_r, cy_h);\n    rotcy([1, 0, 0], cy_r, cy_h);\n    rotcy([0, 1, 0], cy_r, cy_h);\n}");
			}

			if (localStorage.currentFilename !== undefined){
				_ui.setCurrentFilename(localStorage.getItem("currentFilename"));
			}

			var viewerWidth = $('#viewer-container').width();
			var viewerHeight = $('#viewer-container').height();

			_ui.gProcessor = new OpenJsCad.Processor(viewerWidth, viewerHeight, document.getElementById("viewer-container"), null, logMessage,  colorScheme);

			_ui.resizeEditor(); // needed to take into account any scrollbars

			var font = (localStorage.getItem("preferencesFontFamily") != undefined)? localStorage.getItem("preferencesFontFamily") : "Courier New,Courier New,Courier,monospace";
			_ui.setEditorFontFamily(font);

			var fontSize = (localStorage.getItem("preferencesFontSize") != undefined)? Number(localStorage.getItem("preferencesFontSize")) : 12;
			_ui.setEditorFontSize(fontSize);

			var colorSchemeName = (localStorage.getItem("preferencesColorScheme") != undefined)? localStorage.getItem("preferencesColorScheme") : 'cornfield';
			var colorScheme = colorSchemes[colorSchemeName];
			_ui.setColorScheme(colorSchemeName);

			$('#editor').on('keyup', function(){
				if ($(this).val() != lastEditorContent){
					_ui.editorIsDirty = true;
					localStorage.setItem("lastEdit", $(this).val());
					lastEditorContent = $(this).val();
				}
			});

			$("#editor").keypress(function(e) {
				if (e.keyCode == 10 && e.ctrlKey == true){
					_ui.updateSolid();
				}
			});

			shortcut.add("Ctrl+s",function() {_ui.saveEditor();});
			shortcut.add("F4", function() {_ui.updateSolid();});

			var resizeTimeout;
			window.onresize = function() {
				clearTimeout(resizeTimeout);
				resizeTimeout = setTimeout(_ui.resizeViewer, 250); // set for 1/4 second.  May need to be adjusted.
			};

			$('#menu_file_disconnect').parent().addClass("disabled");

      if (window.location.host == "localhost" || window.location.protocol == "https:") {
        this.controller.attemptFilesystemConnection();
      } else {
        $('#menu_file_connect').parent().addClass("disabled");
        $('#menu_file_connect').parent().attr('title', "Unavailable as Dropbox api not available over http");
      }

			setupEventHandlers(this, this.controller);

			$('#fontSelect').fontSelector({
				'hide_fallbacks' : true,
				'initial' : font,
				'selected' : function(font) {
					_ui.setEditorFontFamily(font);
					localStorage.setItem("preferencesFontFamily", font);
				}
			});

			$('#examples').prepend(examples_insert);

			$('#shareLinkModal').on('shown', function () {
				$("#share_link").select();
			});

			$('#menu_file_share_as_link').click(function(){
				$('#share_link').val(location.href + "?c=" + escape(btoa($('#editor').val())));
				$('#shareLinkModal').modal('show');
			});

			$('#openFile').on('click', function () {
				$('#fileOpenModal').modal('hide');

				var stat = _ui.filetree.get_selected().data("stat");
				if (!stat){
					logMessage("Unable to read data from selection.");
					return;
				}
				if (stat.isFile){
					_ui.controller.readFile(stat.path, function(content, filename){
						_ui.closeFileOpenModal();
						_ui.setEditorContent(content, filename);
				});
				}

			});

			if (getUrlParam('c')){
				if (localStorage.getItem("lastEdit") !== undefined){
					_ui.setEditorContent(atob(unescape(getUrlParam('c'))));
					localStorage.setItem("lastEdit", $('#editor').val());
					_ui.setCurrentFilename('');
				}
				if (getUrlParam('r') && confirm("Compile and display?")){
					_ui.updateSolid();
				}
			}

			if (autoReload){
				_ui.updateSolid();
			}
		},

		confirm: function(msg, callback) {
			return bootbox.confirm(msg, callback);
		},

		setCurrentFilename: function(filename) {
			$('#currentFilename').val(filename);
			localStorage.setItem("currentFilename", filename);
		},

		setFilesystemName: function(name) {
			this.filesystemName = name;
		},

		setColorScheme: function(schemeName) {
			var scheme = colorSchemes[schemeName];
			if (scheme === undefined){
				logMessage("Unknown color scheme.");
				return;
			}

			if (viewer) {
				viewer.setColorScheme(scheme);
			}
			$('#colorScheme option').attr('selected','');
			$('#colorScheme option[value='+schemeName+']').attr('selected','selected');
			if (this.controller.modelIsShown){
				this.updateSolid();
			}
		},

		setEditorFontFamily: function(font){
			$('#editor').css('font-family', font);
		},

		setEditorFontSize: function(fontSize){
			$('#editor').css('font-size', fontSize);
			$('#preferencesFontSize option').attr('selected','');
			$('#preferencesFontSize option[value='+fontSize+']').attr('selected','selected');
		},

		resizeEditor: function(){
			$('#editor').width(uiLayout.state.west.layoutWidth-20)
		},

		resizeViewer: function(paneName,paneElement){
			viewerWidth = $(paneElement).width();
			viewerHeight = $(paneElement).height();

			if (viewerWidth<=0&&viewerHeight<=0){
				return;
			}

			this.gProcessor.canvasResize(viewerWidth, viewerHeight);
			$('.viewer').width(viewerWidth);
			$('.viewer').height(viewerHeight);
		},


		hideConsole: function(show) {
			if ($('input[name=menu_view_hide_console]').attr('checked')=='checked'){
				logLayout.close("south");
			} else {
				logLayout.open("south");
			}
		},

		clearConsole: function() {
			$('#log').val("");
		},

		display: function(result) {
			console.log(result);
			this.gProcessor.setJsCad(result, getOutputFilename());

		},



		closeFileOpenModal: function() {
			$('#fileOpenModal').modal('hide');
		},

		reloadFileTree: function() {
			var _ui = this;
			_ui.filetree._get_children($('#root')).each(function(index,child){
				_ui.filetree.delete_node(child);
			});
			_ui.readDir("/", $('#root'));
		},

		loadExample: function(filename) {
			var exampleElement = $('#'+filename.replace(/\./g, "_"))

			if (!exampleElement.length){
				logMessage("Unable to find example: " + filename);
				return;
			}

			this.setEditorContent(exampleElement.text());
			this.setCurrentFilename('');
			this.gProcessor.clearViewer();
			this.controller.modelIsShown = false;
			localStorage.setItem("lastEdit", exampleElement.text());

		},

		notify: function(msg){
			if (msg == ""){
				return;
			}
			var val = $('#log').val();
			if (val == ""){
				$('#log').val(msg);
			} else {
				$('#log').val($('#log').val()+"\n"+msg)
			}
			$('#log').scrollTop($('#log')[0].scrollHeight);

			console.log(msg);
		},

		newEditor:  function() {
			if (this.editorIsDirty){
				if (!confirm("Editor has unsaved changes. Continue?")){
					return;
				}
			}

			$('#editor').val('');
			this.setCurrentFilename('');
			this.gProcessor.clearViewer();
			this.controller.modelIsShown = false;
			localStorage.setItem("lastEdit", "");

		},

		saveEditor:  function() {
			var _ui = this;
			if (!_ui.controller.connectedToFilesystem){
				bootbox.alert("Not connected to "+this.filesystemName+". Please connect and attempt to save again.");
				return;
			}
			var currentFilename = getCurrentFilename();

			var filename = currentFilename != '' ? currentFilename : 'newfile.scad';


			bootbox.prompt("File path and name?", "Cancel", "OK", function(filepath) {

				if (!filepath) return;

				_ui.controller.writeFile(filepath, $('#editor').val(), function(){
					logMessage("File saved: " +filepath);
					_ui.setCurrentFilename(filepath);
					_ui.editorIsDirty = false;

					$.proxy(_ui.reloadFileTree, _ui);
				});

			}, filename);
		},

		setEditorContent: function(content, filepath){

			if (this.editorIsDirty){
	          if(!confirm("Current editor is not saved, continue?")){
	            return;
	          }
	        }

			lastEditorContent = content;
			$('#editor').val(content);
			this.editorIsDirty = false;
			localStorage.setItem("lastEdit", content);

			if (filepath){
				this.setCurrentFilename(filepath);
				logMessage("Loaded file: " + filepath);
			}
		},

		hideEditor: function() {
			if ($('input[name=menu_view_hide_editor]').attr('checked')=='checked'){
				uiLayout.close("west");
			} else {
				uiLayout.open("west");
			}
		},

		whenConnectedToFilesystem: function(controller){
			initFilelist(controller);
			$('#notificationbar').attr("title", "Connected to " + controller.ui.filesystemName);
			$('#notificationbar').html("<img src='img/led-icons/connect.png'>&nbsp;" + controller.ui.filesystemName + "</li>")
			$('#menu_file_disconnect').parent().removeClass("disabled");
			controller.connectedToFilesystem = true;
		},

		whenDisconnectedFromFilesystem: function(controller){
			$('#notificationbar').attr("title", "Not Connected to " + controller.ui.filesystemName);
			$('#notificationbar').html("<img src='img/led-icons/disconnect.png'>&nbsp;" + controller.ui.filesystemName + "</li>")
			$('#jstree_container').html("<button class='btn btn-success' type='button' onclick='connect();'>Connect to " + controller.ui.filesystemName + "</button>");
			$('#menu_file_disconnect').parent().addClass("disabled");
			controller.connectedToFilesystem = false;
		},

		logMessage: logMessage
	};

	function setupEventHandlers(ui, controller){

		$('.menu_option').on('click', function(e){ e.stopPropagation(); });

		$('#menu_file_new').click(function(e) { ui.newEditor(); });

		$('#menu_file_save').click(function(e) { ui.saveEditor(); });

		$('#menu_file_connect').click(function(e) { controller.connect(ui.whenConnectedToFilesystem); });

		$('#menu_file_disconnect').click(function(e) { controller.disconnect(ui.whenDisconnectedFromFilesystem); });

		$('.loadExample').click(function() { ui.loadExample($(this).attr('data-filename')); })

		$('#preferencesFontSize').change(function(){
			var fontSize = Number($("#preferencesFontSize option:selected").val());
			ui.setEditorFontSize(fontSize);
			localStorage.setItem("preferencesFontSize", fontSize);
		});

		$('#colorScheme').change(function() {
			var schemeName = $("#colorScheme option:selected").val();
			ui.setColorScheme(schemeName);
			localStorage.setItem("preferencesColorScheme", schemeName);
		});

		$('#menu_design_reload_compile').click(function(e) { ui.updateSolid(); });

		$('#menu_design_export_stl').click(function(){
			if (controller.modelIsShown){
				ui.gProcessor.generateOutputFile();
			} else {
				logMessage("Please render the model before attempting to export.");
			}
		});

		$('input[name=menu_view_hide_editor]').change(function(e) { ui.hideEditor(); });
		$('input[name=menu_view_hide_console]').change(function(e) { ui.hideConsole(); });

		$('input[name=menu_view_show_axis]').change(function() { ui.toggleAxis($(this).attr('checked')=='checked'); });

		$('input[name=menu_view_show_grid]').change(function() { ui.toggleGrid($(this).attr('checked')=='checked'); });

		$('input[name=menu_design_auto_reload]').change(function() { autoReload = $(this).attr('checked')=='checked'; });

		$('#share_autoload').change(function() {
			if ($(this).attr('checked')=='checked'){
				$('#share_link').val(location.href + "?r=true&c=" + escape(btoa($('#editor').val())));
			} else {
				$('#share_link').val(location.href + "?c=" + escape(btoa($('#editor').val())));
			}

		});

		$('#menu_view_clear_console').click(function(e) { ui.clearConsole(); });

		$('#connect_to_filesystem').click(function(e) { controller.connect(ui.whenConnectedToFilesystem); });

		// Filetree file double click
		$(document).on('dblclick','.dbFile', function (e) {
			var stat = $(this).data("stat");
			if (!stat){
				return;
			}
			if (stat.isFile){
				controller.readFile(stat.path, function(content, filename){
					ui.closeFileOpenModal();
					ui.setEditorContent(content, filename);
				});
			}
		});
	};

	function getCurrentFilename() {
		return $('#currentFilename').val();
	};

	function getOutputFilename(){
		var currentFilename = getCurrentFilename();
		if (currentFilename == ''){
			return "output";
		}

		var y = currentFilename.substring(currentFilename.lastIndexOf("/") + 1);
		var q = y.lastIndexOf(".");
		return y.substring(0,q==-1?y.length:q);
	};

	function getUrlParam( param ){
			param = param.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
			var exp = "[\\?&]"+param+"=([^&#]*)";
			var regexp = new RegExp( exp );
			var results = regexp.exec( window.location.href );
			if( results == null ){
				return undefined;
			} else {
				return results[1];
			}
		}


	function initFilelist(controller){

	  $("#jstree_container").bind("loaded.jstree", function (event, data) {
			controller.ui.filetree = $.jstree._reference('#jstree_container');
			controller.readDir("/", $('#root'));
		}).bind("open_node.jstree", function (e, data) {
			var id = data.args[0].attr("id");
			var isloaded = data.args[0].data("isloaded")
			if (isloaded === undefined){
			  isloaded = false;
			}

			if (isloaded){
			  return;
			}

			var stat = data.args[0].data("stat");

			if (stat !== undefined){
			  controller.readDir(stat.path, $('#'+id));
			}
	  }).jstree({
		  ui: {
			select_limit: 1
		  },
		  themes : {
			url: "css/jstree/themes/default/style.css"
		  },
		  core : {
			animation: 200
		  },
		  plugins : [ "themes", "json_data", "ui" ],
		  json_data: {
			data: [
			  {
				data: "/",
				attr: {id:"root"},
				metadata: {path:"/"}
			  }
			]
		  }
		});
	  }

	  function logMessage(msg) {
		  if (msg == ""){
		    return;
		  }
		  var val = $('#log').val();
		  if (val == ""){
		    $('#log').val(msg);
		  } else {
		    $('#log').val($('#log').val()+"\n"+msg)
		  }
		  $('#log').scrollTop($('#log')[0].scrollHeight);

		  console.log(msg);
		}

	return UI;

})