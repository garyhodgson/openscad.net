
define("test_recursive_includes",["lib/jquery-latest", "lib/dropbox",  "lib/underscore"], 
  function(jQuery, dropbox, underscore) {
    var client;
    var globalLibs = {}
    var processed = false;

    $(function() {


		client = new Dropbox.Client({
		  key: "HXhDdRlFUUA=|ExW13h6tJ+jTCm96w87G1F3wvtvRRKnOdXuYBn3BIg==", sandbox: true
		});
		client.authDriver(new Dropbox.Drivers.Redirect({rememberUser: true}));

		client.authenticate(function(error, client) {
	        if (error) {
	          return showError(error);
	        }
	        updateSolid();
	      });

		

	  });

	
	function updateSolid() {
    var openSCADText = "include <asd.txt>;\n\nThis is main;";
    var useAndIncludeStatements = [];

    console.log(openSCADText);

    collateLibraries(openSCADText, useAndIncludeStatements, function(useAndIncludeStatements){
      newParse2(openSCADText, useAndIncludeStatements, display);
    });
      
  }

    function collateLibraries(text, useAndIncludeStatements, cb){

      extractLibraryNames(text,useAndIncludeStatements);

      _.each(globalLibs, function (value, key, list) {

        if (value == undefined){

          client.readFile(key, null, function(error, content, stat) {
            if (error) {
              return showError(error);
            }

            globalLibs[key] = {raw:content};

            collateLibraries(content, useAndIncludeStatements, cb);

          });
        }
      })

      if (cb){
        var currentGlobalLibContents = _.values(globalLibs);

        if (_.indexOf(currentGlobalLibContents, undefined) == -1 && !processed){
          processed = true;
          console.log("globalLibs",globalLibs);
          console.log(useAndIncludeStatements);
          cb(useAndIncludeStatements);
        }
      }
    }

    function extractLibraryNames (text, useAndIncludeStatements) {

      var re = /include <([^>]*)>;/gm
      var match;
      while (match = re.exec(text)){
        var filename = match[1];
        var replaceString = match[0];

        if (!_.has(globalLibs,filename)){
          globalLibs[filename] = undefined;
          useAndIncludeStatements.push(["include", filename, replaceString]);
        }

      }
      /*var lines = text.split("\n");
        for (var i in lines){
          var line = lines[i];

          //var includedLibrary = line.match(/include <([^>]*)>;/);
          //if (includedLibrary != null){
          //  
          //  if (!_.has(globalLibs,includedLibrary[1])){
          //    globalLibs[includedLibrary[1]] = undefined;
          //    useAndIncludeStatements.push(["include", includedLibrary[1], includedLibrary[0]]);
          //  }
          //}

          var usedLibrary = line.match(/use <([^>]*)>;/);
          if (usedLibrary != null){
            if (!_.has(globalLibs,usedLibrary[1])){
              globalLibs[usedLibrary[1]] = undefined;
              useAndIncludeStatements.push(["use",usedLibrary[1],usedLibrary[0]]);
            }
          }

        }*/
    }

    function newParse2(text, useAndIncludeStatements, cb) {

      console.log("useAndIncludeStatements = ",useAndIncludeStatements);

      for (var i = useAndIncludeStatements.length - 1; i >= 0; i--) {
        var useAndIncludeStatement = useAndIncludeStatements[i]
        var isUse = useAndIncludeStatement[0] == 'use';
        var filename = useAndIncludeStatement[1];
        var libReplaceKey = useAndIncludeStatement[2];

        console.log("filename = ",filename);

        var libContent = globalLibs[filename].cached ? globalLibs[filename].cached : globalLibs[filename].raw;

        _.each(useAndIncludeStatements, function(val){
          var replacementFilename = val[1];

          var replacementContent = globalLibs[replacementFilename].cached ? globalLibs[replacementFilename].cached : globalLibs[replacementFilename].raw;

          libContent = libContent.replace(val[2], replacementContent)

          if (libContent.indexOf(libReplaceKey) !== -1 ){
            throw Error(_.template("Recursion detected. <%=a%> <- <%=b%> <- <%=a%>", {a:filename, b:replacementFilename}));
          }

          globalLibs[filename].cached = libContent

        })

      }

      _.each(useAndIncludeStatements, function(val){

          var replacementContent = globalLibs[val[1]].cached ? globalLibs[val[1]].cached : globalLibs[val[1]].raw;
          text = text.replace(val[2], replacementContent)

        })

      cb(text);


    }

/*
    function newParse(text, useAndIncludeStatements, cb) {
    	console.log("useAndIncludeStatements",useAndIncludeStatements);

      var singleLineModuleRegex = /(module\s*\w*\([^\)]\)\w*)([^{};]*);/gm;
      var singleLineModuleReplacement = "$1 {$2;};"; 

      if (useAndIncludeStatements.length>0){

        var library = useAndIncludeStatements[0];
        var isUse = library[0] == 'use';
        var filename = library[1];
        var libReplaceKey = library[2];

        var libContent = globalLibs[filename].cached ? globalLibs[filename].cached : globalLibs[filename].raw;

        // the following hack puts single line module definitions into braces
        libContent = libContent.replace(singleLineModuleRegex, singleLineModuleReplacement);

	      if (isUse){
	        var usedModuleResult = openscadParser.parse(libContent);
	          //TODO!!!!!!!!!!!!!!!!!!!!!
	        openscadParser.yy.context = usedModuleResult.context;
				//TODO!!!!!!!!!!!!!!!!!!!!!

	      } else {

	          //var fileTextLines = libContent.split("\n");
	          //lines = _.union(fileTextLines, lines);

            text = text.replace(new RegExp(libReplaceKey, "g"),libContent);
            globalLibs[filename].cached = libContent;          

        }
        

        newParse(text, useAndIncludeStatements.slice(1), cb);

      } else {

        // the following hack puts single line module definitions into braces
        text = text.replace(singleLineModuleRegex, singleLineModuleReplacement);

        cb(text);
      }
      
    }*/

    function display(result) {

      console.log(result);
      
    }


function onError(e) {
      logMessage('Error' + e.name);
    }

    var showError = function(error) {
      logMessage("Dropbox Error: "+error);
      
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






});