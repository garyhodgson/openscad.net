define("Controller", [], function(){

  var globalLibs = {};
  var importCache = {};
  var processed = false;

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
            _controller.ui.filetree.create_node(root, 'inside',
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

    display: function(result){
        this.ui.display(result);
        this.modelIsShown = true;
    },

    updateSolid: function(text, isOpenSCADSyntax, rootFilePath) {
      var _controller = this;

      if (_.isEmpty(text)){
        return;
      }

      processed = false;

      if (isOpenSCADSyntax){
        var useAndIncludeStatements = [];

        _controller.collateLibraries(text, useAndIncludeStatements, rootFilePath,
          function(useAndIncludeStatements){
              _controller.newParse(text, useAndIncludeStatements,
                $.proxy(_controller.display, _controller));
        });
      } else {
        this.display(text);
      }

    },

    collateLibraries: function(text, useAndIncludeStatements, rootFilePath, callback){

//console.log("collateLibraries rootFilePath = ", rootFilePath);

      var _controller = this;

      _controller.extractLibraryNames(text, rootFilePath, useAndIncludeStatements);
      _.each(globalLibs, function (value, key, list) {
        if (value.loading == false){
          globalLibs[key].loading = true;

          var isBinary = /.*\.stl$/.test(key); // default to reading all stl files as binary

//console.log("Persistence fullPath", key);

          _controller.persistence.readFile(key, isBinary, function(content) {

            globalLibs[key].raw = content;

            filePath = key.replace(/[^\/]*$/, "");

            _controller.collateLibraries(isBinary?"":content, useAndIncludeStatements, filePath, callback);

          });
        }
      })

      if (callback){
        var globalLibIndexes = _.countBy(globalLibs, function(lib){
          return lib.raw == undefined ? 'unprocessed' : 'processed';
        });

        console.log("globalLibIndexes = ",globalLibIndexes);

        if (globalLibIndexes.unprocessed == undefined && !processed){
          processed = true;
          callback(useAndIncludeStatements);
        }
      }
    },

    newParse: function(text, useAndIncludeStatements, callback) {

      var _controller = this;

      var parser = openscadOpenJscadParser.parser;

      for (var i = useAndIncludeStatements.length - 1; i >= 0; i--) {
        var useAndIncludeStatement = useAndIncludeStatements[i];
        var filename = useAndIncludeStatement[1];
        var libReplaceKey = useAndIncludeStatement[2];

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

      _.each(useAndIncludeStatements, function(useAndIncludeStatement){
        var libReplaceKey = useAndIncludeStatement[2];

        var libContent = globalLibs[useAndIncludeStatement[1]].cached ?
                            globalLibs[useAndIncludeStatement[1]].cached :
                            globalLibs[useAndIncludeStatement[1]].raw;

        switch (useAndIncludeStatement[0]) {
            case 'use':
                var usedModuleResult = parser.parse(libContent);
                parser.yy.context = usedModuleResult.context;
                break
            case 'import':
                importCache[filename] = libContent;
                parser.yy.importCache = importCache;
                break
            case 'include':
                text = text.replace(libReplaceKey, libContent);
                break
            default:
                throw Error("Unknown parse replacement command: " + library[0]);
        }

      });

      try {

          console.log(text);

          var result = parser.parse(text);
          callback(result.lines.join('\n'));
      } catch (e) {
          console.error(e.message);
          console.error(e.stack);
          this.ui.logMessage("Error: " + e);
      }
    },

    extractLibraryNames: function(text, rootFilePath, useAndIncludeStatements) {

      var importedObjectRegex = /import\([^\"]*\"([^\)]*)\"[,]?.*\);?/gm;
      var usedLibraryRegex = /use <([^>]*)>;?/gm;
      var includedLibraryRegex = /include <([^>]*)>;?/gm;

      var match;
      var re = includedLibraryRegex;
      while (match = re.exec(text)){
        var filename = rootFilePath+match[1];
        var replaceString = match[0];

        if (!_.has(globalLibs,filename)){
            globalLibs[filename] = {loading:false};
        }
        useAndIncludeStatements.push(["include", filename, replaceString]);

      }
      re = usedLibraryRegex;
      while (match = re.exec(text)){
        var filename = rootFilePath+match[1];
        var replaceString = match[0];

        if (!_.has(globalLibs,filename)){
            globalLibs[filename] = {loading:false};
        }
        useAndIncludeStatements.push(["use", filename, replaceString]);
      }

      re = importedObjectRegex;
      while (match = re.exec(text)){
        var filename = rootFilePath+match[1];
        var replaceString = match[0];

        if (!_.has(globalLibs,filename)){
            globalLibs[filename] = {loading:false};
        }
        useAndIncludeStatements.push(["import", filename, replaceString]);
      }
    },

    attemptFilesystemConnection: function(){
      if (this.persistence.shouldConnect()){
        this.connect(this.ui.whenConnectedToFilesystem);
      }
    },
  }

  return Controller;

})