requirejs.config({
    shim: {
        'jquery-ui-latest': ['jquery-latest.min'],
        'jquery.layout-latest.min': ['jquery-latest.min', 'jquery-ui-latest.min'],
        'jquery-ui-latest.min': ['jquery-latest.min'],
        'jquery.fontselector.min': ['jquery-latest.min'],
        'jquery.jstree.min': ['jquery-latest.min'],
        'jquery.textarea': ['jquery-latest.min'],
        'jquery.mousewheel': ['jquery-latest.min'],
        'bootstrap/bootstrap.min': ['jquery-latest.min'],
        'garlic.min': ['jquery-latest.min'],
        'openscad-parser': ['underscore-min', 'jquery-latest.min', 'openscad2openjscad_support', 'csg']

    }
});
var filetree;

define("main",["jquery-latest.min", "text!../examples.insert.html", "jquery-ui-latest.min", "jquery.layout-latest.min","jquery.fontselector.min","modernizr.min", "dropbox.min", 
	"jquery.jstree.min", "bootstrap/bootstrap.min", "jquery.textarea", "jquery.mousewheel", "underscore-min", "garlic.min", "shortcut", "bootbox.min",
	"openscad2openjscad_support", "lightgl", "csg", "openjscad", "openscad-parser"], function(jQuery, examples_insert) {

	  var myLayout;
    var gProcessor=null;
    var auto_reload;
    var editorIsDirty = false;
    var modelIsShown = false;
    var currentFilename = '';
    var client;
    var uiLayout, logLayout;
    var colorSchemes = {
      "cornfield": { backgroundColor: [255/255, 255/255, 229/255], faceColor: [249/255, 215/255, 44/255] },
      "metallic": { backgroundColor: [170/255, 170/255, 255/255], faceColor: [221/255, 221/255, 225/255] },
      "sunset": { backgroundColor: [170/255, 68/255, 68/255], faceColor: [255/255, 170/255, 170/255] },
      "sunrise": { backgroundColor: [196/255, 207/255, 210/255], faceColor: [255/255, 245/255, 184/255] }
    };

    $(function() {

    	if (!Modernizr.webgl){
        logMessage("This app needs webGL - Google Chrome would be a good choice of browser.")
        return 
      }

      openscadParser.yy.logMessage = logMessage;

      client = new Dropbox.Client({
          key: "HXhDdRlFUUA=|ExW13h6tJ+jTCm96w87G1F3wvtvRRKnOdXuYBn3BIg==", sandbox: true
      });
      client.authDriver(new Dropbox.Drivers.Redirect({rememberUser: true}));

      uiLayout = $('#container').layout({
                    minSize: 100, 
                    center__paneSelector: ".outer-center", 
                    stateManagement: {
                      enabled: true,
                      cookie: {
                        name: "uiLayout"
                      }
                    }, 
                    enableCursorHotkey: false, 
                    center__children: {
                      minSize: 10, 
                      center__onresize_end: resizeViewer, 
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
      })

      $('#settingsForm').garlic({conflictManager: {enabled: false}});
      show_axis = $('input[name=menu_view_show_axis]').attr("checked")=="checked";
      show_grid = $('input[name=menu_view_show_grid]').attr("checked")=="checked";
      auto_reload = $('input[name=menu_design_auto_reload]').attr("checked")=="checked";
      hideEditor();
      hideConsole();
      if (!$('#sourcetype_openscad').attr('checked') && !$('#sourcetype_openjscad').attr('checked')){
        $('#sourcetype_openscad').attr('checked','checked');
      }

      $('#editor').tabby({tabString:'    '});

      if (localStorage.lastEdit !== undefined){
        $('#editor').val(localStorage.getItem("lastEdit"));
      }

      if (getUrlParam('c') !== undefined){
        if (localStorage.getItem("lastEdit") !== undefined && confirm("Overwrite existing editor contents with URL parameter content?")){
            $('#editor').val(atob(unescape(getUrlParam('c'))));
            editorIsDirty = true;
            localStorage.setItem("lastEdit", $('#editor').val());
        } else {
          $('#editor').val(localStorage.getItem("lastEdit"));
        }
      }

      var font = (localStorage.getItem("preferencesFontFamily") != undefined)? localStorage.getItem("preferencesFontFamily") : "Courier New,Courier New,Courier,monospace";
      setEditorFontFamily(font);

      var fontSize = (localStorage.getItem("preferencesFontSize") != undefined)? Number(localStorage.getItem("preferencesFontSize")) : 12;
      setEditorFontSize(fontSize);

      var colorScheme = (localStorage.getItem("preferencesColorScheme") != undefined)? colorSchemes[localStorage.getItem("preferencesColorScheme")] : colorSchemes['cornfield'];

      $('#editor').live('keyup blur', function(){
        localStorage.setItem("lastEdit", $(this).val());
      });

      $("#editor").keypress(function(e) {
        if (e.keyCode == 10 && e.ctrlKey == true){
            updateSolid();
        } else {
          editorIsDirty = true;
        }
      });

      shortcut.add("Ctrl+s",saveEditor);
      shortcut.add("F4",updateSolid);

      var viewerWidth = $('#viewer-container').width();
      var viewerHeight = $('#viewer-container').height();

      gProcessor = new OpenJsCad.Processor(viewerWidth, viewerHeight, document.getElementById("viewer-container"), null, logMessage,  colorScheme);
  
      var resizeTimeout;
      window.onresize = function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeViewer, 250); // set for 1/4 second.  May need to be adjusted.
      };

      $('.menu_option').on('click', function(e){
        e.stopPropagation();
      });

      $('#menu_file_new').click(newEditor);

      $('#menu_file_save').click(saveEditor);

      $('#menu_file_dropbox_connect').click(connectToDropbox);

      $('#menu_file_dropbox_signout').click(disconnectFromDropbox);

      if (getUrlParam("oauth_token") !== undefined){
        connectToDropbox();
      } else {
        for (var key in localStorage){
          if (key.match(/^dropbox-auth.*/)) {
            connectToDropbox();
            break;
          }
        }
      }

      if (auto_reload){
        updateSolid();
      }

      $('.loadExample').click(function() {
          loadExample($(this).text());
      })

      $('#fontSelect').fontSelector({
          'hide_fallbacks' : true,
          'initial' : font,
          'selected' : function(font) {
            setEditorFontFamily(font);      
            localStorage.setItem("preferencesFontFamily", font);    
          }
      });

      $('#preferencesFontSize').change(function(){
        var fontSize = Number($("#preferencesFontSize option:selected").val());
        
        setEditorFontSize(fontSize);
        localStorage.setItem("preferencesFontSize", fontSize);
      });

      $('#colorScheme').change(function () {
        var scheme = $("#colorScheme option:selected").val();
        setColorScheme(scheme);

        if (modelIsShown){
          updateSolid();
        }
      });

      $('#menu_design_reload_compile').click(updateSolid);

      $('#menu_design_export_stl').click(function(){
      	gProcessor.generateOutputFile();
      });

      $('input[name=menu_view_hide_editor]').change(hideEditor);
      $('input[name=menu_view_hide_console]').change(hideConsole);

      $('input[name=menu_view_show_axis]').change(function () {
      	showAxis($(this).attr('checked')=='checked');
      });

	    $('input[name=menu_view_show_grid]').change(function () {
      	showGrid($(this).attr('checked')=='checked');
      });

	    $('input[name=menu_design_auto_reload]').change(function () {
      	auto_reload = $(this).attr('checked')=='checked';
      });

      $('#menu_view_clear_console').click(clearConsole);

      $('#connect_to_dropbox').click(connectToDropbox);

      $('#examples').prepend(examples_insert);

      $('#shareLinkModal').on('shown', function () {
        $("#share_link").select();
      });

      $('#menu_file_share_as_link').click(function(){
        $('#share_link').val(location.href + "?c=" + escape(btoa($('#editor').val())));
        $('#shareLinkModal').modal('show');
      });

      $('#openFile').click(function () {
        $('#fileOpenModal').modal('hide');

        var stat = filetree.get_selected().data("stat");
        if (!stat){
          logMessage("Unable to read Dropbox data from selection.");
          return;
        }
        if (stat.isFile){
          readFile(stat.path);
        }
        
      });

    });

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

  	function setColorScheme (schemeName) {
      var scheme = colorSchemes[schemeName];
      if (scheme === undefined){
        logMessage("Unknown color scheme.");
        return;
      }
      localStorage.setItem("preferencesColorScheme", schemeName);
      viewer.setColorScheme(scheme);
      if (modelIsShown){
        updateSolid();
      }
    }

    function setEditorFontFamily(font){
      $('#editor').css('font-family', font);
    }

    function setEditorFontSize(fontSize){
      $('#editor').css('font-size', fontSize);
      $('#preferencesFontSize option').attr('selected','');
      $('#preferencesFontSize option[value='+fontSize+']').attr('selected','selected');
    }

    function loadExample (filename) {
      var exampleElement = $('#'+filename.replace(/\./g, "_"))

      if (!exampleElement.length){
        logMessage("Unable to find example: " + filename);
        return;
      }

      if (editorIsDirty){
        if (!confirm("Editor has unsaved changes. Continue?")){
          return;
        }
      }
      currentFilename = filename;
      $('#editor').val(exampleElement.text());
      $('#editor').blur();
      
    }

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

    function newEditor () {
        if (editorIsDirty){
          if (!confirm("Editor has unsaved changes. Continue?")){
            return;
          }
        }

        $('#editor').val('');
        currentFilename = '';
        gProcessor.clearViewer();
        modelIsShown = false;
        localStorage.removeItem("lastEdit");

    };

    function saveEditor() {

      bootbox.prompt("File path and name?", "Cancel", "OK", function(filepath) {

        if (!filepath) return;

        writeFile(filepath, $('#editor').val());

      }, currentFilename?currentFilename:"newfile.scad");
    }

    function resizeViewer(x,ui){
      viewerWidth = $(ui).width();
      viewerHeight = $(ui).height();

      if (viewerWidth<=0&&viewerHeight<=0){
        return;
      }

      gProcessor.canvasResize(viewerWidth, viewerHeight);
      $('.viewer').width(viewerWidth);
      $('.viewer').height(viewerHeight);
    }

    function extractLibraryNames (text) {
      var lines = text.split("\n");
        for (var i in lines){
          var line = lines[i];

          var includedLibrary = line.match(/include <([^>]*)>;/);
          if (includedLibrary != null){
            globalLibs[includedLibrary[1]] = undefined;
          }

          var usedLibrary = line.match(/use <([^>]*)>;/);
          if (usedLibrary != null){
            globalLibs[usedLibrary[1]] = undefined;
          }

        }
    }

    var globalLibs = {}

    function collateLibraries(text, cb){

      extractLibraryNames(text);

      _.each(globalLibs, function (value, key, list) {
        if (value == undefined){

          client.readFile(key, null, function(error, content, stat) {
            if (error) {
              return showError(error);
            }

            globalLibs[key] = content;

            collateLibraries(content, cb);

          });
        }
      })

      if (cb){
        var currentGlobalLibContents = _.values(globalLibs);

        if (_.indexOf(currentGlobalLibContents, undefined) == -1){
          cb();
        }
      }
    }


    function updateSolid() {
      if ($('#sourcetype_openscad').attr("checked")== "checked"){

        var openSCADText = $('#editor').val()

        collateLibraries(openSCADText, function(libs){

          var lines = openSCADText.split("\n");
          var libraries = [];

          for (var i in lines){
            var line = lines[i];

            var includedLibrary = line.match(/include <([^>]*)>;/);
            if (includedLibrary != null){
              libraries.push(['include',includedLibrary[1]]);
            }

            var usedLibrary = line.match(/use <([^>]*)>;/);
            if (usedLibrary != null){
              libraries.push(['use',usedLibrary[1]]);
            }

          }
          newParse(lines, libraries, display);
        });
      } else {
        gProcessor.setJsCad($('#editor').val());
        modelIsShown = true;
      }
    }

    function newParse(lines, libraries, cb) {

      if (libraries.length>0){

        var library = libraries[0];
        var isUse = library[0] == 'use';
        var filename = library[1];

        var libContent = globalLibs[filename];

        if (isUse){
          var usedModuleResult = openscadParser.parse(libContent);
          openscadParser.yy.context = usedModuleResult.context;
        } else {
          var fileTextLines = libContent.split("\n");
          lines = _.union(fileTextLines, lines);
        }

        newParse(lines, libraries.slice(1), cb);

      } else {
        var result = openscadParser.parse(lines.join('\n'));
        cb(result);
      }
      
    }

    function display(result) {
      var resultText = result.lines.join('\n');

      console.log(resultText);
      
      gProcessor.setJsCad(resultText);
      modelIsShown = true;
    }


    function onError(e) {
      logMessage('Error' + e.name);
    }

    var showError = function(error) {
      if (window.console) {  // Skip the "if" in node.js code.
        logMessage("Dropbox Error: "+error);
      }

      switch (error.status) {
      case 401:
        // If you're using dropbox.js, the only cause behind this error is that
        // the user token expired.
        // Get the user through the authentication flow again.
        break;

      case 404:
        // The file or folder you tried to access is not in the user's Dropbox.
        // Handling this error is specific to your application.
        break;

      case 507:
        // The user is over their Dropbox quota.
        // Tell them their Dropbox is full. Refreshing the page won't help.
        break;

      case 503:
        // Too many API requests. Tell the user to try again later.
        // Long-term, optimize your code to use fewer API calls.
        break;

      case 400:  // Bad input parameter
      case 403:  // Bad OAuth request.
      case 405:  // Request method not expected
      default:
        // Caused by a bug in dropbox.js, in your application, or in Dropbox.
        // Tell the user an error occurred, ask them to refresh the page.
      }

      return false;
    };

    // Filetree file double click
    $(document).on('dblclick','.dbFile', function (e) {
      var stat = $(this).data("stat");
      if (!stat){
        return;
      }
      if (stat.isFile){
        readFile(stat.path);
      }
    });

    function readDir(path, root) {

      client.readdir(path, function(error, entries, stat, stats) {
        if (error) {
          return showError(error);
        }

        _.each(stats, function (stat) {

          var id = stat.path.replace(/\//g, '_').replace(/\./g, '_')

          if (stat.isFile){
          filetree.create_node(
                root, 'inside', 
                { attr: {id:id, class:"dbFile"}, metadata: {stat: stat}, data: {title:stat.name, icon: "img/led-icons/page_white_text.png"} }
            );
          } else {
            filetree.create_node(
                root, 'inside', 
                { attr: {id:id},  state: "closed", metadata: {stat: stat}, data: stat.name }
            );
          }

        });

        filetree.open_node(root);
        root.data("isloaded", true);

      });
    };

    function readFile(path) {
      client.readFile(path, null, function(error, content, stat) {
        closeFileOpenModal();
        if (error) {
          closeFileOpenModal();
          return showError(error);
        }

        if (editorIsDirty){
          alert("Current editor is not saved.");
          return;
        }

        $('#editor').val(content);
        $('#editor-tabs a[href="#editorTab"]').tab('show');
        editorIsDirty = false;
        currentFilename = stat.path;
        logMessage("Loaded file: " +stat.path);
      });
    };

    function writeFile(filepath, content) {
      client.writeFile(filepath, content, function(error, stat) {
        if (error) {
          return showError(error);
        }

        logMessage("File saved: " +filepath);
        currentFilename = filepath;
        editorIsDirty = false;

        reloadFileTree();

      });
    };

    function closeFileOpenModal() {
      $('#fileOpenModal').modal('hide');
    }

    function reloadFileTree() {
      filetree._get_children($('#root')).each(function(index,child){
        filetree.delete_node(child);
      });
      readDir("/", $('#root'));
    }

    function connectToDropbox(){
      client.authenticate(function(error, client) {
        if (error) {
          return showError(error);
        }
        $('#notificationbar').attr("title", "Connected to Dropbox");
        $('#notificationbar').html("<img src='img/led-icons/connect.png'>&nbsp;Dropbox</li>")
        initFilelist();
      });
    };

    function disconnectFromDropbox(){
      bootbox.confirm("Disconnect from Dropbox?", function(confirmed) {
        if (!confirmed) return;

        client.signOut(function(error) {
          if (error) {
            return showError(error);
          }

          $('#notificationbar').attr("title", "Not Connected to Dropbox");
          $('#notificationbar').html("<img src='img/led-icons/disconnect.png'>&nbsp;Dropbox</li>")
          $('#jstree_container').html("<button class='btn btn-success' type='button' onclick='connectToDropbox();'>Connect to Dropbox</button>");
          
        });
      });
    };

    function initFilelist(){
      $("#jstree_container").bind("loaded.jstree", function (event, data) {
            filetree = $.jstree._reference('#jstree_container');
            readDir("/", $('#root'));
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
              readDir(stat.path, $('#'+id));
            }
      }).jstree({
          ui: {
            select_limit: 1
          },
          core : { animation: 200 },
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

      function showGrid(show){
        show_grid = show;
        updateSolid();
      }

      function showAxis(show){
        show_axis = show;
        updateSolid();
      }

      function hideEditor() {
        if ($('input[name=menu_view_hide_editor]').attr('checked')=='checked'){
          uiLayout.close("west");  
        } else {
          uiLayout.open("west");  
        }
      }
    
      function hideConsole() {
        if ($('input[name=menu_view_hide_console]').attr('checked')=='checked'){
          logLayout.close("south");
        } else {
          logLayout.open("south");
        }
      }

      function clearConsole() {
        $('#log').val("");
      }
});
