
OpenJsCad = function() {
};

var viewer, show_axis, show_grid;
var DEFAULT_COLORSCHEME = { backgroundColor: [0.93, 0.93, 0.93], faceColor: [0.8,0.8,0.8] };

// A viewer is a WebGL canvas that lets the user view a mesh. The user can
// tumble it around by dragging the mouse.
OpenJsCad.Viewer = function(containerelement, width, height, initialdepth, colorScheme) {
  viewer = this;
  var gl = GL.create();
  this.gl = gl;
  this.angleX = 291;
  this.angleY = 0;
  this.angleZ = 337;
  this.colorScheme = colorScheme || DEFAULT_COLORSCHEME;

  this.viewpointX = 0;
  this.viewpointY = 0;
  this.viewpointZ = initialdepth;

  // Set to true so lines don't use the depth buffer
  this.lineOverlay = false;

  // Set up the viewport
  gl.canvas.width = width;
  gl.canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.matrixMode(gl.PROJECTION);
  gl.loadIdentity();
  gl.perspective(45, width / height, 0.5, 4096);
  gl.matrixMode(gl.MODELVIEW);

  // Set up WebGL state

  gl.clearColor(this.colorScheme.backgroundColor[0], this.colorScheme.backgroundColor[1], this.colorScheme.backgroundColor[2], 1);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.enable(gl.CULL_FACE);
  

  // Black shader for wireframe
  this.blackShader = new GL.Shader('\
    void main() {\
      gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
    }\
  ', '\
    void main() {\
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.1);\
    }\
  ');

  // Shader with diffuse and specular lighting
  this.lightingShader = new GL.Shader('\
    varying vec4 color;\
    varying vec3 normal;\
    varying vec3 light;\
    void main() {\
      const vec3 lightDir = vec3(1.0, 2.0, 3.0) / 3.741657386773941;\
      light = lightDir;\
      color.rgb = gl_Color.rgb;\
      color.a = gl_Color.a;\
      normal = gl_NormalMatrix * gl_Normal;\
      gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
    }\
  ', '\
    varying vec4 color;\
    varying vec3 normal;\
    varying vec3 light;\
    void main() {\
      vec3 n = normalize(normal);\
      float diffuse = max(0.0, dot(light, n));\
      float specular = pow(max(0.0, -reflect(light, n).z), 10.0) * sqrt(diffuse);\
      gl_FragColor = vec4(mix(color.rgb * (0.3 + 0.7 * diffuse), vec3(1.0), specular), color.a);\
    }\
  ');

  containerelement.appendChild(gl.canvas);  

  var _this=this;

  $(containerelement).bind('mousewheel', function(e, delta, deltaX, deltaY) {
      if (e.shiftKey){
        if (e.altKey){
          _this.viewpointZ -= delta;
        } else {
          _this.viewpointZ -= delta*5;
        }
      } else {
        _this.viewpointZ -= delta*10;  
      }      
      _this.onDraw();    
      e.preventDefault();
    
  });

  gl.onmousemove = function(e) {
    _this.onMouseMove(e);
  };
  gl.ondraw = function() {
    _this.onDraw();
  };
  this.clear();

};

OpenJsCad.Viewer.prototype = {
  setCsg: function(csg) {
    this.mesh = OpenJsCad.Viewer.csgToMesh(csg);
    this.onDraw();    
  },

  setColorScheme: function (scheme) {
    this.colorScheme = scheme;
    this.gl.clearColor(this.colorScheme.backgroundColor[0], this.colorScheme.backgroundColor[1], this.colorScheme.backgroundColor[2], 1);
    this.clear();
  },

  cameraAngle: function(X,Y,Z){
    this.angleX = X;
    this.angleY = Y;
    this.angleZ = Z;
    this.onDraw();
  },

  cameraPosition: function(X,Y){
    this.viewpointX = X;
    this.viewpointY = Y;
    this.onDraw();
  },

  clear: function() {
    // empty mesh:
    this.mesh = new GL.Mesh();
    this.onDraw();    
  },

  supported: function() {
    return !!this.gl; 
  },
  
  onMouseMove: function(e) {
    if (e.dragging) {
      e.preventDefault();
      if(e.altKey)
      {
        var factor = 1e-2;
        this.viewpointZ *= Math.pow(2,factor * e.deltaY);
      }
      else if(e.shiftKey)
      {
        var factor = 5e-3;
        this.viewpointX += factor * e.deltaX * this.viewpointZ; 
        this.viewpointY -= factor * e.deltaY * this.viewpointZ; 
      }
      else
      {        
        this.angleZ += e.deltaX * 2;
        this.angleX += e.deltaY * 2;
      }
      this.onDraw();    
    }
  },

  onDraw: function(e) {
    var gl = this.gl;
    gl.makeCurrent();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.translate(this.viewpointX, this.viewpointY, -this.viewpointZ);
    gl.rotate(this.angleX, 1, 0, 0);
    gl.rotate(this.angleY, 0, 1, 0);
    gl.rotate(this.angleZ, 0, 0, 1);

    if (!this.lineOverlay) gl.enable(gl.POLYGON_OFFSET_FILL);
    this.lightingShader.draw(this.mesh, gl.TRIANGLES);
    if (!this.lineOverlay) gl.disable(gl.POLYGON_OFFSET_FILL);

    var gridMin = -100;
    var gridMax = 100;

    if (show_grid){
      gl.lineWidth(1);
      gl.begin(gl.LINES);
      gl.color(0.7,0.7,0.7); 
      for (var i = gridMin; i <= gridMax; i++) {
        gl.vertex(i,gridMin,0);
        gl.vertex(i,gridMax,0);
        gl.vertex(gridMin,i,0);
        gl.vertex(gridMax,i,0);
      };
      gl.end();
    }

    if (show_axis){
      var axisZoffset = 0.001;
      gl.begin(gl.LINES);
      gl.lineWidth(5.0);
      gl.color(1,0,0); 
      gl.vertex(gridMin,0,axisZoffset);
      gl.vertex(gridMax,0,axisZoffset);
      gl.vertex(gridMax-0.25,-0.25,axisZoffset);
      gl.vertex(gridMax-0.25,0.25,axisZoffset);
      for (var i = gridMin; i < gridMax; i++){
        gl.vertex(i,-0.1,axisZoffset);
        gl.vertex(i,0.1,axisZoffset);
      }
      gl.color(0,1.0,0); 
      gl.vertex(0,gridMin,axisZoffset);
      gl.vertex(0,gridMax,axisZoffset);
      gl.vertex(-0.25,gridMax-0.25,axisZoffset);
      gl.vertex(0.25,gridMax-0.25,axisZoffset);
      for (var i = gridMin; i < gridMax; i++){
        gl.vertex(-0.1,i,axisZoffset);
        gl.vertex(0.1,i,axisZoffset);
      }
      gl.color(0,0,1.0); 
      gl.vertex(0,0,gridMin);
      gl.vertex(0,0,gridMax);
      gl.vertex(-0.25,0,gridMax-0.25);
      gl.vertex(0.25,0,gridMax-0.25);
      for (var i = gridMin; i < gridMax; i++){
        gl.vertex(-0.1,0,i);
        gl.vertex(0.1,0,i);
      }
      gl.end();
    }
  },  
  canvasResize: function(width,height){
    var gl = this.gl;
    gl.canvas.width = width;
    gl.canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.matrixMode(gl.PROJECTION);
    gl.loadIdentity();
    gl.perspective(45, width / height, 0.5, 1000);
    gl.matrixMode(gl.MODELVIEW);
    gl.ondraw();
  }
}

// Convert from CSG solid to GL.Mesh object
OpenJsCad.Viewer.csgToMesh = function(csg) {
  var csg = csg.canonicalized();
  var mesh = new GL.Mesh({ normals: true, colors: true });
  var vertexTag2Index = {};
  var vertices = [];
  var colors = [];
  var triangles = [];
  // set to true if we want to use interpolated vertex normals
  // this creates nice round spheres but does not represent the shape of
  // the actual model
  var smoothlighting = false;   
  var polygons = csg.toPolygons();
  var numpolygons = polygons.length;
  for(var polygonindex = 0; polygonindex < numpolygons; polygonindex++)
  {
    var polygon = polygons[polygonindex];
    var color = (viewer.colorScheme)? viewer.colorScheme.faceColor : [0.8,0.8,0.8, 1.0];
    
    if(polygon.shared && polygon.shared.color)
    {
      color = polygon.shared.color;
    }
    var indices = polygon.vertices.map(function(vertex) {
      var vertextag = vertex.getTag();
      var vertexindex;
      if(smoothlighting && (vertextag in vertexTag2Index))
      {
        vertexindex = vertexTag2Index[vertextag];
      }
      else
      {
        vertexindex = vertices.length;
        vertexTag2Index[vertextag] = vertexindex;
        vertices.push([vertex.pos.x, vertex.pos.y, vertex.pos.z]);
        colors.push(color);
      }
      return vertexindex;
    });
    for (var i = 2; i < indices.length; i++) {
      triangles.push([indices[0], indices[i - 1], indices[i]]);
    }
  }
  mesh.triangles = triangles;
  mesh.vertices = vertices;
  mesh.colors = colors;
  mesh.computeWireframe();
  mesh.computeNormals();
  return mesh;
};

// this is a bit of a hack; doesn't properly supports urls that start with '/'
// but does handle relative urls containing ../
OpenJsCad.makeAbsoluteUrl = function(url, baseurl) {
  if(!url.match(/^[a-z]+\:/i))
  {
    var basecomps = baseurl.split("/");
    if(basecomps.length > 0)
    {
      basecomps.splice(basecomps.length - 1, 1);
    }
    var urlcomps = url.split("/");
    var comps = basecomps.concat(urlcomps);
    var comps2 = [];
    comps.map(function(c) {
      if(c == "..")
      {
        if(comps2.length > 0)
        {
          comps2.splice(comps2.length - 1, 1);
        }
      }
      else
      {
        comps2.push(c);
      }
    });  
    url = "";
    for(var i = 0; i < comps2.length; i++)
    {
      if(i > 0) url += "/";
      url += comps2[i];
    }
  }
  return url;
};

OpenJsCad.isChrome = function()
{
  return (navigator.userAgent.search("Chrome") >= 0);
};

// This is called from within the web worker. Execute the main() function of the supplied script
// and post a message to the calling thread when finished
OpenJsCad.runMainInWorker = function(mainParameters)
{
  try
  {
    if(typeof(main) != 'function') throw new Error('Your jscad file should contain a function main() which returns a CSG solid or a CAG area.'); 
    var result = main(mainParameters);
    if( (typeof(result) != "object") || ((!(result instanceof CSG)) && (!(result instanceof CAG))))
    {
      throw new Error("Your main() function should return a CSG solid or a CAG area.");
    }
    var result_compact = result.toCompactBinary();
    result = null; // not needed anymore
    self.postMessage({cmd: 'rendered', result: result_compact});
  }
  catch(e)
  {
    var errtxt = e.stack;
    if(!errtxt)
    {
      errtxt = e.toString();
    } 
    self.postMessage({cmd: 'error', err: errtxt});
  }
};

OpenJsCad.parseJsCadScriptSync = function(script, mainParameters, debugging) {
  var workerscript = "";
  workerscript += script;
  if(debugging)
  {
    workerscript += "\n\n\n\n\n\n\n/* -------------------------------------------------------------------------\n";
    workerscript += "OpenJsCad debugging\n\nAssuming you are running Chrome:\nF10 steps over an instruction\nF11 steps into an instruction\n";
    workerscript += "F8  continues running\nPress the (||) button at the bottom to enable pausing whenever an error occurs\n";
    workerscript += "Click on a line number to set or clear a breakpoint\n";
    workerscript += "For more information see: http://code.google.com/chrome/devtools/docs/overview.html\n\n";
    workerscript += "------------------------------------------------------------------------- */\n"; 
    workerscript += "\n\n// Now press F11 twice to enter your main() function:\n\n";
    workerscript += "debugger;\n";
  }
  workerscript += "return main("+JSON.stringify(mainParameters)+");";  
  var f = new Function(workerscript);
  var result = f();
  return result;
};

// callback: should be function(error, csg)
OpenJsCad.parseJsCadScriptASync = function(script, mainParameters, callback) {
  var baselibraries = [
    "js/lib/csg.js",
    "js/app/openjscad.js"
  ];
  var baseurl = document.location + "";
  var workerscript = "";
  workerscript += script;
  workerscript += "\n\n\n\n//// The following code is added by OpenJsCad:\n";
  workerscript += "var _csg_libraries=" + JSON.stringify(baselibraries)+";\n";
  workerscript += "var _csg_baseurl=" + JSON.stringify(baseurl)+";\n";
  workerscript += "var _csg_makeAbsoluteURL=" + OpenJsCad.makeAbsoluteUrl.toString()+";\n";
//  workerscript += "if(typeof(libs) == 'function') _csg_libraries = _csg_libraries.concat(libs());\n";
  workerscript += "_csg_libraries = _csg_libraries.map(function(l){return _csg_makeAbsoluteURL(l,_csg_baseurl);});\n";
  workerscript += "_csg_libraries.map(function(l){importScripts(l)});\n";
  workerscript += "self.addEventListener('message', function(e) {if(e.data && e.data.cmd == 'render'){";
  workerscript += "  OpenJsCad.runMainInWorker("+JSON.stringify(mainParameters)+");";
//  workerscript += "  if(typeof(main) != 'function') throw new Error('Your jscad file should contain a function main() which returns a CSG solid.');\n";
//  workerscript += "  var csg; try {csg = main("+JSON.stringify(mainParameters)+"); self.postMessage({cmd: 'rendered', csg: csg});}";
//  workerscript += "  catch(e) {var errtxt = e.stack; self.postMessage({cmd: 'error', err: errtxt});}";
  workerscript += "}},false);\n";
    
  var blobURL = OpenJsCad.textToBlobUrl(workerscript);
  
  if(!window.Worker) throw new Error("Your browser doesn't support Web Workers. Please try the Chrome browser instead.");
  var worker = new Worker(blobURL);
  worker.onmessage = function(e) {
    if(e.data)
    { 
      if(e.data.cmd == 'rendered')
      {
        var resulttype = e.data.result.class;
        var result;
        if(resulttype == "CSG")
        {
          result = CSG.fromCompactBinary(e.data.result);
        }
        else if(resulttype == "CAG")
        {
          result = CAG.fromCompactBinary(e.data.result);
        }
        else
        {
          throw new Error("Cannot parse result");
        }
        callback(null, result);
      }
      else if(e.data.cmd == "error")
      {
        callback(e.data.err, null);
      }
      else if(e.data.cmd == "log")
      {
        console.log(e.data.txt);
      }
    }
  };
  worker.onerror = function(e) {
    var errtxt = "Error in line "+e.lineno+": "+e.message;
    callback(errtxt, null);
  };
  worker.postMessage({
    cmd: "render"
  }); // Start the worker.
  return worker;
};

OpenJsCad.getWindowURL = function() {
  if(window.URL) return window.URL;
  else if(window.webkitURL) return window.webkitURL;
  else throw new Error("Your browser doesn't support window.URL");
};

OpenJsCad.textToBlobUrl = function(txt) {
  var windowURL=OpenJsCad.getWindowURL();

  var blob = new Blob(txt);
  var blobURL = windowURL.createObjectURL(blob)
  if(!blobURL) throw new Error("createObjectURL() failed"); 
  return blobURL;
};

OpenJsCad.revokeBlobUrl = function(url) {
  if(window.URL) window.URL.revokeObjectURL(url)
  else if(window.webkitURL) window.webkitURL.revokeObjectURL(url)
  else throw new Error("Your browser doesn't support window.URL");
};

OpenJsCad.FileSystemApiErrorHandler = function(fileError, operation) {
  var errormap = {
    1: 'NOT_FOUND_ERR',
    2: 'SECURITY_ERR',
    3: 'ABORT_ERR',
    4: 'NOT_READABLE_ERR',
    5: 'ENCODING_ERR',
    6: 'NO_MODIFICATION_ALLOWED_ERR',
    7: 'INVALID_STATE_ERR',
    8: 'SYNTAX_ERR',
    9: 'INVALID_MODIFICATION_ERR',
    10: 'QUOTA_EXCEEDED_ERR',
    11: 'TYPE_MISMATCH_ERR',
    12: 'PATH_EXISTS_ERR',
  };
  var errname;
  if(fileError.code in errormap)
  {
    errname = errormap[fileError.code];
  }
  else
  {
    errname = "Error #"+fileError.code;
  }
  var errtxt = "FileSystem API error: "+operation+" returned error "+errname;
  throw new Error(errtxt);
};

OpenJsCad.AlertUserOfUncaughtExceptions = function() {
  window.onerror = function(message, url, line) {
    message = message.replace(/^Uncaught /i, "");
    alert(message+"\n\n("+url+" line "+line+")");
  };
};

// parse the jscad script to get the parameter definitions
OpenJsCad.getParamDefinitions = function(script) {
  var scriptisvalid = true;
  try
  {
    // first try to execute the script itself
    // this will catch any syntax errors
    var f = new Function(script);
    f();
  }
  catch(e) {
    scriptisvalid = false;
  }
  var params = [];
  if(scriptisvalid)
  {
    var script1 = "if(typeof(getParameterDefinitions) == 'function') {return getParameterDefinitions();} else {return [];} ";
    script1 += script;
    var f = new Function(script1);
    params = f();
    if( (typeof(params) != "object") || (typeof(params.length) != "number") )
    {
      throw new Error("The getParameterDefinitions() function should return an array with the parameter definitions");
    }
  }
  return params;
};

OpenJsCad.Processor = function(width, height, containerdiv, onchange, logMessageFunction, colorScheme) {
  this.containerdiv = containerdiv;
  this.onchange = onchange;
  this.viewerdiv = null;
  this.viewer = null;
  this.viewerwidth = width;
  this.viewerheight = height;
  this.colorScheme = colorScheme || DEFAULT_COLORSCHEME;
  this.initialViewerDistance = 50;
  this.processing = false;
  this.currentObject = null;
  this.hasValidCurrentObject = false;
  this.hasOutputFile = false;
  this.worker = null;
  this.paramDefinitions = [];
  this.paramControls = [];
  this.script = null;
  this.hasError = false;
  this.debugging = false;
  this.logMessage = logMessageFunction;
  

  this.createElements();
};

OpenJsCad.Processor.convertToSolid = function(obj) {
  if( (typeof(obj) == "object") && ((obj instanceof CAG)) )
  {
    // convert a 2D shape to a thin solid:
    obj=obj.extrude({offset: [0,0,0.1]});
  }
  else if( (typeof(obj) == "object") && ((obj instanceof CSG)) )
  {
    // obj already is a solid
  }
  else
  {
    throw new Error("Cannot convert to solid");
  }
  return obj;
};

OpenJsCad.Processor.prototype = {
  canvasResize: function(w,h){
    this.viewer.canvasResize(w,h);
  },
  createElements: function() {
    while(this.containerdiv.children.length > 0)
    {
      this.containerdiv.removeChild(0);
    }
    if(!OpenJsCad.isChrome() )
    {
      this.logMessage("Please note: OpenJsCad currently only runs reliably on Google Chrome!");
    }

    var viewerdiv = document.createElement("div");
    viewerdiv.className = "viewer";
    viewerdiv.style.width = this.viewerwidth + "px";
    viewerdiv.style.height = this.viewerheight + "px";
    viewerdiv.style.backgroundColor = "rgb(200,200,200)";
    this.containerdiv.appendChild(viewerdiv);
    this.viewerdiv = viewerdiv;
    try
    {
      this.viewer = new OpenJsCad.Viewer(this.viewerdiv, this.viewerwidth, this.viewerheight, this.initialViewerDistance, this.colorScheme);
    } catch (e) {
      this.logMessage("Error: " + e.toString() + ".  OpenJsCad currently requires Google Chrome with WebGL enabled")
    } 
    this.clearViewer();
  },
  
  setCurrentObject: function(obj) {
    this.currentObject = obj;
    if(this.viewer)
    {
      var csg = OpenJsCad.Processor.convertToSolid(obj); 
      this.viewer.setCsg(csg);
    }
    this.hasValidCurrentObject = true;
  },
  
  clearViewer: function() {
    this.clearOutputFile();
    this.setCurrentObject(new CSG());
    this.hasValidCurrentObject = false;
  },

  abort: function() {
    if(this.processing)
    {
      //todo: abort
      this.processing=false;
      logMessage("Aborted.");
      this.worker.terminate();
      if(this.onchange) this.onchange();
    }
  },
    
  setError: function(txt) {
    if (txt != "") {
      this.hasError = true;
      this.logMessage(txt);
    } else {
      this.hasError = false;
    }

  },
  
  setDebugging: function(debugging) {
    this.debugging = debugging;
  },
  
  // script: javascript code
  // filename: optional, the name of the .jscad file
  setJsCad: function(script, filename) {
    if(!filename) filename = "openjscad.jscad";
    filename = filename.replace(/\.jscad$/i, "");
    this.abort();
    this.clearViewer();
    this.script = null;
    this.setError("");
    var scripthaserrors = false;

    if(!scripthaserrors)
    {
      this.script = script;
      this.filename = filename;
      this.rebuildSolid();
    }
    else
    {
      if(this.onchange) this.onchange();
    }
  },
  
  getParamValues: function()
  {
    var paramValues = {};
    for(var i = 0; i < this.paramDefinitions.length; i++)
    {
      var paramdef = this.paramDefinitions[i];
      var type = "text";
      if('type' in paramdef)
      {
        type = paramdef.type;
      }
      var control = this.paramControls[i];
      var value;
      if( (type == "text") || (type == "float") || (type == "int") )
      {
        value = control.value;
        if( (type == "float") || (type == "int") )
        {
          var isnumber = !isNaN(parseFloat(value)) && isFinite(value);
          if(!isnumber)
          {
            throw new Error("Not a number: "+value);
          }
          if(type == "int")
          {
            value = parseInt(value);
          }
          else
          {
            value = parseFloat(value);
          }
        }
      }
      else if(type == "choice")
      {
        value = control.options[control.selectedIndex].value;
      }
      paramValues[paramdef.name] = value;
    }
    return paramValues;
  },
    
  rebuildSolid: function()
  {
    this.abort();
    this.setError("");
    this.clearViewer();
    this.processing = true;
    this.logMessage("Processing, please wait...");
    var that = this;
    var paramValues = this.getParamValues();
    var useSync = this.debugging;
    if(!useSync)
    {
      try
      {
        this.worker = OpenJsCad.parseJsCadScriptASync(this.script, paramValues, function(err, obj) {
          that.processing = false;
          that.worker = null;
          if(err)
          {
            that.logMessage("Error.");
            that.setError(err);
            
          }
          else
          {
            that.setCurrentObject(obj);
            that.logMessage("Ready.");
          }
          if(that.onchange) that.onchange();
        });
      }
      catch(e)
      {
        useSync = true;
      }
    }
    
    if(useSync)
    {
      try
      {
        var obj = OpenJsCad.parseJsCadScriptSync(this.script, paramValues, this.debugging);
        that.setCurrentObject(obj);
        that.processing = false;
        that.logMessage("Ready.");
      }
      catch(e)
      {
        that.processing = false;
        var errtxt = e.stack;
        if(!errtxt)
        {
          errtxt = e.toString();
        }
        that.setError(errtxt);
        that.logMessage("Error.");
      }
      if(that.onchange) that.onchange();
    }
  },
  
  hasSolid: function() {
    return this.hasValidCurrentObject;
  },

  isProcessing: function() {
    return this.processing;
  },
   
  clearOutputFile: function() {
    if(this.hasOutputFile)
    {
      this.hasOutputFile = false;
      if(this.outputFileDirEntry)
      {
        this.outputFileDirEntry.removeRecursively(function(){});
        this.outputFileDirEntry=null;
      }
      if(this.outputFileBlobUrl)
      {
        OpenJsCad.revokeBlobUrl(this.outputFileBlobUrl);
        this.outputFileBlobUrl = null;
      }
      if(this.onchange) this.onchange();
    }
  },

  generateOutputFile: function() {
    this.clearOutputFile();
    if(this.hasValidCurrentObject)
    {
      try
      {
        this.generateOutputFileFileSystem();
      }
      catch(e)
      {
        console.error(e);
        this.generateOutputFileBlobUrl();
      }
    }
  },

  currentObjectToBlob: function() {
    var arraybuffers = [];
    var mimetype;
    if(this.currentObject instanceof CSG)
    {      
      arraybuffers = this.currentObject.fixTJunctions().toStlBinary();
      mimetype = "application\/sla";
    }
    else if(this.currentObject instanceof CAG)
    {
      arraybuffers = this.currentObject.toDxf();
      mimetype = "application\/dxf";
    }
    else
    {
      throw new Error("Not supported");
    }    

    return new Blob(arraybuffers, { "type" : mimetype });
  },

  extensionForCurrentObject: function() {
    var extension;
    if(this.currentObject instanceof CSG)
    {
      extension = "stl";
    }
    else if(this.currentObject instanceof CAG)
    {
      extension = "dxf";
    }
    else
    {
      throw new Error("Not supported");
    }
    return extension;    
  },

  generateOutputFileBlobUrl: function() {
    var blob = this.currentObjectToBlob();
    var windowURL=OpenJsCad.getWindowURL();
    this.outputFileBlobUrl = windowURL.createObjectURL(blob)
    if(!this.outputFileBlobUrl) throw new Error("createObjectURL() failed"); 
    this.hasOutputFile = true;
    window.location = this.outputFileBlobUrl;
    if(this.onchange) this.onchange();
  },

  generateOutputFileFileSystem: function() {
    window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
    if(!window.requestFileSystem)
    {
      throw new Error("Your browser does not support the HTML5 FileSystem API. Please try the Chrome browser instead.");
    }
    // create a random directory name:
    var extension = this.extensionForCurrentObject();
    var dirname = "OpenJsCadOutput1_"+parseInt(Math.random()*1000000000, 10)+"."+extension;
    var filename = this.filename+"."+extension;
    var that = this;
    window.requestFileSystem(TEMPORARY, 20*1024*1024, function(fs){
        fs.root.getDirectory(dirname, {create: true, exclusive: true}, function(dirEntry) {
            that.outputFileDirEntry = dirEntry;
            dirEntry.getFile(filename, {create: true, exclusive: true}, function(fileEntry) {
                 fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwriteend = function(e) {
                      that.hasOutputFile = true;
                      window.location = fileEntry.toURL();
                      
                      if(that.onchange) that.onchange();
                    };
                    fileWriter.onerror = function(e) {
                      throw new Error('Write failed: ' + e.toString());
                    };
                    var blob = that.currentObjectToBlob();
                    fileWriter.write(blob);                
                  }, 
                  function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "createWriter");} 
                );
              },
              function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "getFile('"+filename+"')");} 
            );
          },
          function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "getDirectory('"+dirname+"')");} 
        );         
      }, 
      function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "requestFileSystem");}
    );
  },
  
  
};
