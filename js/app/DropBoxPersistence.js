define("DropBoxPersistence", ["lib/dropbox"], function(){

	var showError = function(error) {
    console.log(_.template("An error occurred: [<%=name%>] <%=message%>", {name: error.status, message: error.responseText}));
    return false;
  };

  function Persistence(){
    this.client = new Dropbox.Client({ key: "1m7xd37519455ad", sandbox: true   });
    this.client.authDriver(new Dropbox.AuthDriver.Redirect({rememberUser: true}));

  };

  Persistence.prototype.connect = function(callback){
    this.client.authenticate(function(error, client) {
     if (error) {
        return showError(error);
      }

      callback();
    });

  };

  Persistence.prototype.disconnect = function(callback){

    this.client.signOut(function(error) {
      connectedToDropbox = false;
      if (error) {
        return showError(error);
      }

      callback();
    });

  };

  Persistence.prototype.readFile = function(filepath, isBinary, callback) {

    this.client.readFile(filepath, {binary:isBinary}, function(error, content, stat) {
      if (error) {
        return showError(error);
      }
      callback(isBinary?btoa(content):content);
    });
  };

  Persistence.prototype.readDir = function(filepath, callback) {

    this.client.readdir(filepath, function(error, entries, stat, stats) {
     if (error) {
       return showError(error);
     }

     callback(stats);

   });
  };

  Persistence.prototype.openFile = function(filepath, callback){

   this.client.readFile(filepath, null, function(error, content, stat) {

     if (error) {
       return showError(error);
     }

     callback(content, stat);

   });
 };


 Persistence.prototype.writeFile = function(filepath, content, callback){
  this.client.writeFile(filepath, content, function(error, stat) {
    if (error) {
      return showError(error);
    }
    callback();
  });
};

Persistence.prototype.getFilesystemName = function(){
 return "Dropbox";
}

Persistence.prototype.shouldConnect = function(){
  if (getUrlParam("not_approved") !== undefined
    && getUrlParam("not_approved") == 'true'){
    return false;
  }
  if (getUrlParam("oauth_token") !== undefined){
    return true;
  }
  for (var key in localStorage){
    if (key.match(/^dropbox-auth.*/)) {
      return true;
    }
  }
  return false;
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


return Persistence;

})
