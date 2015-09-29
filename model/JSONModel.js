jQuery.sap.declare("bluefin.shared.model.JSONModel");
jQuery.sap.require("sap.ui.model.json.JSONModel");

sap.ui.model.json.JSONModel.extend("bluefin.shared.model.JSONModel", {

	mError : {},

	constructor : function(sServiceUrl){
		sap.ui.model.json.JSONModel.apply(this, []);

		if(sServiceUrl){
			// determine the service base url and strip off any parameters
			if (sServiceUrl.indexOf("?") == -1) {
				this.sServiceUrl = sServiceUrl;
			} else {
				var aUrlParts = sServiceUrl.split("?");
				this.sServiceUrl = aUrlParts[0];
			}

			// Remove trailing slash (if any)
			this.sServiceUrl = this.sServiceUrl.replace(/\/$/, "");
		}
	},

	/**
	 * Load JSON-encoded data from the server using a GET HTTP request and
	 * store the resulting JSON data in the model against the sModelPath node
	 * of the model.
	 * 
	 * @param {string} sPath A string containing the Path to be appended to
	 * 		the Service Url, e.g. "/Bookings"
	 * @param {map/object} mAdditional is an object of additional parameters
	 * 	@param {string} sModelPath the path of the JSON model on which to
	 * 		bind the results. If null, set to sPath
	 * 	@param {array} aResponseProperty if the return structure has a/some
	 * 		property(s) we want to read, rather than the whole response, send this
	 * 		in an array of strings
	 * 	@param {boolean} bReturnArray if set to true the return should be an
	 * 		array, if false/null return type does not need to be an array
	 * 	@param {array} aSorter an array of sap.ui.model.Sorter to be applied to
	 * 		the return set
	 * @param {object | string} [oParameters] A map or string that is sent to
	 * 		the server with the request.
	 * 		Data that is sent to the server is appended to the URL as a query string.
	 * 		If the value of the data parameter is an object (map), it is converted
	 * 		to a string and url-encoded before it is appended to the URL.
	 * @param {boolean} [bAsync=true] By default, all requests are sent
	 * 		asynchronous (i.e. this is set to true by default). If you need
	 * 		synchronous requests, set this option to false. Cross-domain requests
	 * 		do not support synchronous operation. Note that synchronous requests may
	 * 		temporarily lock the browser, disabling any actions while the request
	 * 		is active.
	 * @param {string} [sType=GET] The type of request to make ("POST" or
	 * 		"GET"), default is "GET". Note: Other HTTP request methods, such as
	 * 		PUT and DELETE, can also be used here, but they are not supported by
	 * 		all browsers.
	 * @param {boolean} [bMerge=false] whether the data should be merged
	 * 		instead of replaced
	 * @param {string} [bCache=false] force no caching if false.
	 * 		Default is false
	 * @param {object} [mHeaders] An object of additional header key/value
	 * 		pairs to send along with the request
	**/
	loadDataFromPath : function(sPath, mAdditional, oParameters, bAsync, sType, bMerge, bCache, mHeaders){
		var that = this;

		var sModelPath = mAdditional.sModelPath;
		var aResponseProperty = mAdditional.aResponseProperty;
		var bReturnArray = mAdditional.bReturnArray;
		var aSorter = mAdditional.aSorter;

		// If the path doesn't have a leading slash, add one
		sPath = sPath.charAt(0) !== "/" ? "/" + sPath : sPath; 
		var sURL = this.sServiceUrl + sPath; //the root URL plus the path

		sModelPath = sModelPath || sPath;
		bAsync = (bAsync !== false);
		sType = sType || "GET";
		bCache = bCache === undefined ? this.bCache : bCache;

		this.fireRequestSent({
			url : sURL, 
			type : sType, 
			async : bAsync, 
			headers: mHeaders,
			info : "cache="+bCache+";bMerge=" + bMerge, 
			infoObject: {cache : bCache, merge : bMerge}
		});

		// Make an AJAX request on the path + the serviceUrl
		this._ajax({
			url: sURL,
			async: bAsync,
			dataType: 'json',
			cache: bCache,
			data: oParameters,
			headers: mHeaders,
			type: sType,
			success: function(oData, sResult, response) {
				that.mError = {};
				if (!oData) {
					jQuery.sap.log.fatal("The following problem occurred: No data was retrieved by service: " + sURL);
				}

				// If we've been requested to only read a specific response property, do this
				try{
					for(var a in aResponseProperty){
						oData = oData[aResponseProperty[a]];
					}
				}catch(err){

					// If we cannot get these bits out of the oData object then the structure of the return is not right for us
					jQuery.sap.log.fatal("The following problem occurred: Unrecognisable data was retrieved by service: " + sURL);
				}

				// If the response is required to be an Array and is it NOT already an array
				if(!!oData && bReturnArray === true && !(oData instanceof Array)){

					//Put the non-array data into an array
					oData = [ oData ];
				}

				// Sort the results
				try{
					if(aSorter.length >= 1){
						oData = that._sortObjectArray(oData, aSorter);
					}
				}catch(err){
					//aSorter is not an array, therefore do not sort!
				}

				// If CSRF token was requested, store it on the model
				try{
					var x_csrf_token = response.getResponseHeader("x-csrf-token") || response.getResponseHeader("X-CSRF-Token");
					if(x_csrf_token){ // If we have a csrf token, store it on “this”
						that["x-csrf-token"] = x_csrf_token;
						if(mHeaders.hasOwnProperty("X-CSRF-Token")){ 

							// If it was requested, store it on the JSON model
							that.setProperty("/CSRF", x_csrf_token);
						}
					}
				}catch(err){

					// No CSRF token found....or requested
				}

				// Loop through the modelPath parts, and create any sub-routes first
				var aPathParts = sModelPath.split("/");
				for(var p = 0; p < aPathParts.length-1; p++){

					// If the path is NOT initial, and the path doesn't already have something assigned, create it
					if(aPathParts[p] !== "" && !that.getProperty("/"+aPathParts[p])){
						that.setProperty("/"+aPathParts[p], {});
					}
				}

				// Set the response JSON on the model, at the model path provided
				that.setProperty(sModelPath, oData);
				that.fireRequestCompleted({
					url : sURL,
					type : sType,
					async : bAsync,
					headers: mHeaders,
					info : "cache="+bCache+";bMerge=" + bMerge,
					infoObject: {cache : bCache, merge : bMerge},
					success: true
				});
			},
			error: function(XMLHttpRequest, textStatus, errorThrown){

				// Use standard OData model error handling code
				var oError = { message : textStatus, statusCode : XMLHttpRequest.status, statusText : XMLHttpRequest.statusText, responseText : XMLHttpRequest.responseText};
				//store the error locally on the JSON model
				that.mError = oError;

				jQuery.sap.log.fatal("The following problem occurred: " + textStatus, XMLHttpRequest.responseText + ","
														 + XMLHttpRequest.status + "," + XMLHttpRequest.statusText);

				that.fireRequestCompleted({url : sURL, type : sType, async : bAsync, headers: mHeaders,
					 info : "cache=" + bCache + ";bMerge=" + bMerge, infoObject: {cache : bCache, merge : bMerge}, success: false, errorobject: oError});
				that.fireRequestFailed(oError);
			}
		});

	},

	/**
	 * Trigger a POST request to the odata service that was specified
	 * in the model constructor.
	 *
	 * @param {string} sPath A string containing the path to the collection
	 * where an entry should be created. The path is concatenated to the
	 * sServiceUrl which was specified in the model constructor.
	 * @param {object} oData data of the entry that should be created.
	 * @param {map} [mParameters] Optional parameter map containing any of
	 * the following properties:
	 * @param {function} [mParameters.success] a callback function which is
	 * called when the data has been successfully retrieved. The handler can
	 * have the following parameters: oData and response.
	 * @param {function} [mParameters.error] a callback function which is
	 * called when the request failed. The handler can have the parameter
	 * <code>oError</code> which contains additional error information.
	 * @param {boolean} [mParameters.async=false] Whether the request should
	 * be done asynchronously. Default: false. Please be advised that this
	 * feature is officially unsupported as using asynchronous
	 * requests can lead to data inconsistencies if the application does not
	 * make sure that the request was completed before continuing to work
	 * with the data.
	 * @param {object} [mParameters.context] context to pass into the functions
	 
	 * @public
	 */
	create : function(sPath, oData, mParameters, mHeaders){
		this._genericWriteRequest(sPath, oData, mParameters, "POST", mHeaders);
	},

	/**
	 * Trigger a PUT/MERGE request to the odata service that was specified
	 * in the model constructor. Please note that deep updates are not supported
	 * and may not work. These should be done separate on the entry directly.
	 *
	 * @param {string} sPath A string containing the path to the data that
	 * should be updated. The path is concatenated to the sServiceUrl which
	 * was specified in the model constructor. e.g. /Bookings("12345")
	 * @param {object} oData data of the entry that should be updated.
	 * @param {map} [mParameters] Optional, can contain the following attributes:
	 * @param {object} [mParameters.context] context to pass into the functions
	 * @param {function} [mParameters.success] a callback function which is
	 * called when the data has been successfully updated.
	 * @param {function} [mParameters.error] a callback function which is
	 * called when the request failed. The handler can have the parameter
	 * <code>oError</code> which contains additional error information.
	 * @param {boolean} [mParameters.async=false] Whether the request should
	 * be done asynchronously. Please be advised that this feature is
	 * officially unsupported as using asynchronous requests can lead to data
	 * inconsistencies if the application does not make sure that the request
	 * was completed before continuing to work with the data.
	 *
	 * @public
	 */
	update : function(sPath, oData, mParameters, mHeaders){
		this._genericWriteRequest(sPath, oData, mParameters, "PUT", mHeaders);
	},

	remove : function(sPath, oData, mParameters, mHeaders){
		this._genericWriteRequest(sPath, oData, mParameters, "DELETE", mHeaders);
	},

	/*
	 * COMBINE the functionality of CREATE, UPDATE and REMOVE
	 */
	_genericWriteRequest : function(sPath, oData, mParameters, sType, mHeaders){
		var fnSuccess,
		fnError,
		bAsync = false,
			that = this,
			body = "";

		// If there is no CSRF token in the header already, and we have one stored locally on the JSON model, add it to the header
		if(!mHeaders){
			mHeaders = {};
		}
		if((!mHeaders || !mHeaders.hasOwnProperty("X-CSRF-Token")) && this["x-csrf-token"]){
			mHeaders["X-CSRF-Token"] = this["x-csrf-token"];
		}

		if (mParameters && typeof (mParameters) == "object") {
			// The object parameter syntax has been used.
			fnSuccess	= mParameters.success;
			fnError		= mParameters.error;
			bAsync		= mParameters.async === true;
			that 		= mParameters.context;
		}

		if(oData){
			body = JSON.stringify(oData);
		}

		var sPath = sPath.charAt(0) !== "/" ? "/" + sPath : sPath; // If the path doesn't have a leading slash, add one
		var sURL = this.sServiceUrl + sPath; // The root URL plus the path

		this.fireRequestSent({
			url : sURL,
			type : sType,
			async : bAsync,
			headers: mHeaders,
		});

		this._ajax({
			type: sType,
			contentType : "application/json",
			url: sURL,
			dataType: 'json',
			async: bAsync,
			data: body,
			headers: mHeaders,
			success: fnSuccess.bind(that),
			error: fnError.bind(that)
		});
	},

	// Sort an array of data, using an Array of Sorter objects, usually used on an OData model
	_sortObjectArray : function(oData, aSorter){

		// Code taken from http://stackoverflow.com/questions/1129216/sort-array-of-objects-by-property-value-in-javascript

		// Sort object array by ONE property
		function dynamicSort(property) {
			var sortOrder = 1;
			if(property[0] === "-") {
				sortOrder = -1;
				property = property.substr(1);
			}
			return function (a,b) {
				var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
				return result * sortOrder;
			}
		}

		// Sort object array by MANY properties
		function dynamicSortMultiple() {
			/*
			 * save the arguments object as it will be overwritten
			 * note that arguments object is an array-like object
			 * consisting of the names of the properties to sort by
			 */
			var props = arguments;
			return function (obj1, obj2) {
				var i = 0, result = 0, numberOfProperties = props.length;
				/* try getting a different result from 0 (equal)
				 * as long as we have extra properties to compare
				 */
				while(result === 0 && i < numberOfProperties) {
					result = dynamicSort(props[i])(obj1, obj2);
					i++;
				}
				return result;
			}
		}

		if(aSorter.length === 1){
			return oData.sort(dynamicSort( aSorter[0].bDescending !== "desc" ? aSorter[0].sPath : "-"+aSorter[0].sPath ));
		}else{
			var arr = [];
			for(var s in aSorter){
				arr.push(aSorter[s].bDescending !== "desc" ? aSorter[s].sPath : "-"+aSorter[s].sPath);
			}
			return oData.sort(dynamicSortMultiple.apply(this, arr));
		}
	}
});
