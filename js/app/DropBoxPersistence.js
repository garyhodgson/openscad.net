define("DropBoxPersistence", ["lib/dropbox"], function(){

	var showError = function(error) {
      logMessage(_.template("An error occurred: [<%=name%>] <%=message%>", {name: error.status, message: error.responseText}));
      
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

	function Persistence(){
		this.client = new Dropbox.Client({
			key: "HXhDdRlFUUA=|ExW13h6tJ+jTCm96w87G1F3wvtvRRKnOdXuYBn3BIg==", sandbox: true
		});
		this.client.authDriver(new Dropbox.Drivers.Redirect({rememberUser: true}));
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
