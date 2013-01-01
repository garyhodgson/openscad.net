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
        'lib/garlic': ['lib/jquery-latest']
      }
});

define("main",["lib/jquery-latest", "openscad-parser", "text!../../examples.insert.html", "Globals", "Context", "lib/jquery-ui-latest", "lib/jquery.layout-latest","lib/jquery.fontselector","lib/modernizr", "lib/dropbox", 
  "lib/jquery.jstree", "lib/bootstrap", "lib/jquery.textarea", "lib/jquery.mousewheel", "lib/underscore", "lib/garlic", "lib/shortcut", "lib/bootbox",  
  "lib/lightgl", "openjscad"], function(jQuery, openscadParser, examples_insert, Globals, Context) {

    var uiLayout, logLayout;
    var filetree;
    var gProcessor=null;
    var auto_reload;
    var lastEditorContent = '';
    var editorIsDirty = false;
    var modelIsShown = false;
    var connectedToDropbox = false;
    var client;
    var colorSchemes = {
      "cornfield": { backgroundColor: [255/255, 255/255, 229/255], faceColor: [249/255, 215/255, 44/255, 1.0] },
      "metallic": { backgroundColor: [170/255, 170/255, 255/255], faceColor: [221/255, 221/255, 225/255, 1.0] },
      "sunset": { backgroundColor: [170/255, 68/255, 68/255], faceColor: [255/255, 170/255, 170/255, 1.0] },
      "sunrise": { backgroundColor: [196/255, 207/255, 210/255], faceColor: [255/255, 245/255, 184/255, 1.0] }
    };
    var globalLibs = {};

    $(function() {

    	if (!Modernizr.webgl){
        logMessage("This app needs webGL - Google Chrome would be a good choice of browser.")
        return 
      }

      client = new Dropbox.Client({
          key: "HXhDdRlFUUA=|ExW13h6tJ+jTCm96w87G1F3wvtvRRKnOdXuYBn3BIg==", sandbox: true
      });
      client.authDriver(new Dropbox.Drivers.Redirect({rememberUser: true}));

      uiLayout = $('#container').layout({
                    minSize: 100, 
                    center__paneSelector: ".outer-center",
                    west__onresize_end: resizeEditor,
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
        setEditorContent(localStorage.getItem("lastEdit"));
        editorIsDirty = true;
      } else {
        setEditorContent("// Example script. Press F4, or choose Reload and Compile from the Design menu, to render.\n\nsize = 50;\nhole = 25;\n\nfunction r_from_dia(d) = d / 2;\n\ncy_r = r_from_dia(hole);\ncy_h = r_from_dia(size * 2.5);\n\nmodule rotcy(rot, r, h) {\n    rotate(90, rot)\n      cylinder(r = r, h = h, center = true);\n}\n\ndifference() {\n    sphere(r = r_from_dia(size));\n    rotcy([0, 0, 0], cy_r, cy_h);\n    rotcy([1, 0, 0], cy_r, cy_h);\n    rotcy([0, 1, 0], cy_r, cy_h);\n}");
      }

      if (getUrlParam('c') !== undefined){
        if (localStorage.getItem("lastEdit") !== undefined && confirm("Overwrite existing editor contents with URL parameter content?")){
          setEditorContent(atob(unescape(getUrlParam('c'))));
          localStorage.setItem("lastEdit", $('#editor').val());
          setCurrentFilename('');
        }
      }
      resizeEditor(); // needed to take into account any scrollbars

      var font = (localStorage.getItem("preferencesFontFamily") != undefined)? localStorage.getItem("preferencesFontFamily") : "Courier New,Courier New,Courier,monospace";
      setEditorFontFamily(font);

      var fontSize = (localStorage.getItem("preferencesFontSize") != undefined)? Number(localStorage.getItem("preferencesFontSize")) : 12;
      setEditorFontSize(fontSize);

      var colorSchemeName = (localStorage.getItem("preferencesColorScheme") != undefined)? localStorage.getItem("preferencesColorScheme") : 'cornfield';
      var colorScheme = colorSchemes[colorSchemeName];
      setColorScheme(colorSchemeName);

      $('#editor').live('keyup', function(){
        if ($(this).val() != lastEditorContent){
            editorIsDirty = true;
            localStorage.setItem("lastEdit", $(this).val());
            lastEditorContent = $(this).val();
          }
      });

      $("#editor").keypress(function(e) {
        if (e.keyCode == 10 && e.ctrlKey == true){
            updateSolid();
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
        var schemeName = $("#colorScheme option:selected").val();

        setColorScheme(schemeName);
        localStorage.setItem("preferencesColorScheme", schemeName);
      });

      $('#menu_design_reload_compile').click(updateSolid);

      $('#menu_design_export_stl').click(function(){
        if (modelIsShown){
          gProcessor.generateOutputFile();
        } else {
          logMessage("Please render the model before attempting to export.");
        }
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

      if (auto_reload){
        updateSolid();
      }

    });


    function setEditorContent(content){
      lastEditorContent = content;
      $('#editor').val(content);
      editorIsDirty = false;
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

    function setCurrentFilename(filename) {
      $('#currentFilename').val(filename);
    }

    function getCurrentFilename() {
      return $('#currentFilename').val();
    }

  	function setColorScheme (schemeName) {
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
      setCurrentFilename(filename);
      setEditorContent(exampleElement.text());
      setCurrentFilename('');
      gProcessor.clearViewer();
      modelIsShown = false;
      localStorage.setItem("lastEdit", exampleElement.text());
      
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
        setCurrentFilename('');
        gProcessor.clearViewer();
        modelIsShown = false;
        localStorage.setItem("lastEdit", "");

    };

    function saveEditor() {

      if (!connectedToDropbox){
        bootbox.alert("Not connected to Dropbox. Please connect and attempt to save again.");
        return;
      }

      var filename = getCurrentFilename() != ''?getCurrentFilename():'newfile.scad';

      bootbox.prompt("File path and name?", "Cancel", "OK", function(filepath) {

        if (!filepath) return;

        writeFile(filepath, $('#editor').val());

      }, filename);
    }

    function resizeEditor(){
      $('#editor').width(uiLayout.state.west.layoutWidth-20)
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

            var includedLibrary = line.match(/include <([^>]*)>;?/);
            if (includedLibrary != null){
              libraries.push(['include',includedLibrary[1]]);
            }

            var usedLibrary = line.match(/use <([^>]*)>;?/);
            if (usedLibrary != null){
              libraries.push(['use',usedLibrary[1]]);
            }

          }
          newParse(lines, libraries, display);
        });
      } else {
        gProcessor.setJsCad($('#editor').val(), getOutputFilename());
        modelIsShown = true;
      }
    }

    function newParse(lines, libraries, cb) {

      if (libraries.length>0){

        var library = libraries[0];
        var isUse = library[0] == 'use';
        var filename = library[1];

        var libContent = globalLibs[filename];

        // the following hack puts single line module definitions into braces
        libContent = Globals.preParse(libContent);

        if (isUse){
          var usedModuleResult = openscadParser.parse(libContent);
          console.log("usedModuleResult = ",usedModuleResult);
          openscadParser.yy.context = usedModuleResult.context;
        } else {
          var fileTextLines = libContent.split("\n");
          lines = _.union(fileTextLines, lines);
        }

        newParse(lines, libraries.slice(1), cb);

      } else {
        var joinedLines = lines.join('\n');

        // the following hack puts single line module definitions into braces
        joinedLines = Globals.preParse(joinedLines);

        console.log(joinedLines);

        try {
          var result = openscadParser.parse(joinedLines);
          cb(result);
        } catch (e) {
          onError(e);
          console.error(e.stack);
        }
      }
      
    }

    function display(result) {
      var resultText = result.lines.join('\n');
      
      console.log(resultText);
      
      gProcessor.setJsCad(resultText, getOutputFilename());
      modelIsShown = true;
    }

    function getOutputFilename(){
      var currentFilename = getCurrentFilename();
      if (currentFilename == ''){
        return "output";
      }

      var y = currentFilename.substring(currentFilename.lastIndexOf("/") + 1); 
      var q = y.lastIndexOf("."); 
      return y.substring(0,q==-1?y.length:q);
    }


    function onError(e) {
      logMessage(_.template("An error occurred: [<%=name%>] <%=message%>", e));
    }

    var showError = function(error) {
      onError(error);
      
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
          return showError(error);
        }

        if (editorIsDirty){
          if(!confirm("Current editor is not saved, continue?")){
            return;
          }
        }

        $('#editor').val(content);
        editorIsDirty = false;
        setCurrentFilename(stat.path);
        logMessage("Loaded file: " +stat.path);
      });
    };

    function writeFile(filepath, content) {
      client.writeFile(filepath, content, function(error, stat) {
        if (error) {
          return showError(error);
        }

        logMessage("File saved: " +filepath);
        setCurrentFilename(filepath);
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
        connectedToDropbox = true;
      });
    };

    function disconnectFromDropbox(){
      bootbox.confirm("Disconnect from Dropbox?", function(confirmed) {
        if (!confirmed) return;

        client.signOut(function(error) {
          connectedToDropbox = false;
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

      function showGrid(show){
        show_grid = show;
        if (modelIsShown){
          updateSolid();
        }
      }

      function showAxis(show){
        show_axis = show;
        if (modelIsShown){
          updateSolid();
        }
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
