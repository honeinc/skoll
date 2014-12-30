(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

'use strict';

var merge = require( 'merge' ),
    eventEmitter = require( 'event-emitter' ),
    UploadEvent = require( './src/upload-event'),
    utils = require( './src/utils' ),
    uploadPlugin = require( './src/plugins/upload' );

/*
### FileUploader - Constructor

This is a basic Constructor that will just initialize some basic data structures needed to change the state of the fileUpload this should not due much due to the fact that this will happen initially inside of the module for the singleton. This should also be accessable via an export.

```javascript
var FileUploader = require( 'file-uploader' ).FileUploader,
    fileUploader = new FileUploader();
```
*/

function FileUploader() {

    eventEmitter( this );

    this.el = document.createElement( 'div' );
    this.state = {
        view: 0
    };
    this.plugins = { };
    this.defaults = {
        plugin : 'upload',
        closeOnUpload: true
    };

    setTimeout( this._init.bind( this ), 0 );
}

FileUploader.prototype = {
    get pluginList ( ) {
        var plugins = Object.keys( this.plugins );
        return plugins.map( FileUploader.mapPlugins( this.plugins ) )
            .filter( FileUploader.pluginVisible )
            .map( FileUploader.pluginListEl );
    }
};

/*
### FileUploader::open

This will just apply a class, `show`, to the uploader modal container to show the modal. Since only example CSS is provided either the example css needs to be intergrated into the code or you will need to provide that functionality. This will also set the view state of the `fileUploader` object to `1` to indicate that the modal is open.

```javascript
var fileUploader = require( 'file-uploader' );

fileUploader.open();

if ( fileUploader.state.view === 1 ) {
    console.log( 'fileUploader is open' );
}

```

__params__

- options { Object } - An object that will store some information that pertains to the view once being opened.
    - options.meta { Object } - An object that holds data about current state of app that is opening view cetain plugins, or tabs, take differnt types of information in this area to function properly. _See specific plugin_ `Plugin::open -> options` for more specific details since `options.meta` is generaly just passed to the plugin as that object.
    - options.plugin { String } - this is the name of the plugin to have open when calling the open fn. This will also trigger a `Plugin::open`. Since most of the basic functionality is written as a plugin this can be used to open default views. Also if no name is given then it defaults to the main `upload-photo` plugin.

__returns__

- Plugin { Object } - plugin that is opened

```javascript
var fileUploader = require( 'file-uploader' );

fileUploader.open( {
    meta: {
        description: 'Awesome cats and pizza\'s in space'
    },
    plugin: 'giphy-search'  
} ); 

```
*/

FileUploader.prototype.open = function( options ) {

    options = options || {};

    var defaultPlugin = this.defaults.plugin,
        pluginName =  options.plugin || defaultPlugin,
        plugin = this.plugins[ pluginName ] || this.plugins[ defaultPlugin ];

    options.plugin = pluginName;
    this.currentPlugin = plugin;

    // update links
    this.listEl.innerHTML = '';
    this.pluginList.forEach( this.listEl.appendChild.bind( this.listEl ) );

    this.el.classList.add( 'show' );
    this.state.view = 1;
    // open plugin
    if ( !plugin ) {
        this.emit( 'error', new Error( 'No Plugin is found with the name ' + pluginName ) );
        return;
    }
    plugin.open( options.meta || {}, this, this._handlePluginOpen.bind( this, options ) );

    this.emit( 'open', plugin ); 

};


/*
### FileUploader::close

This will remove the `show` from the uploader modal container. This will also trigger `Plugin::teardown` to the currect active plugin.

```javascript
var fileUploader = require( 'file-uploader' );

fileUploader.open();
fileUplader.close();

if ( !fileUploader.state.view ) {
    console.log( 'fileUploader is closed' );
}

```
*/

FileUploader.prototype.close = function() {

    this.el.classList.remove( 'show' );
    this.state.view = 0;

    this.contentEl.innerHTML = '';
    if ( this.currentPlugin && typeof this.currentPlugin.teardown === 'function' ) {
        this.currentPlugin.teardown();
        this.currentPlugin = null;
    }

    this.emit( 'close' );

};

/*
### FileUploader::upload

Upload method is a proxy to the Upload adapter that should be provided. This is used mainly to normalize some of the event data allowing it to be in a common format that uploader adapters can easily deal with. This is mainly to be used inside of plugins

__params__

- target { Object } - This is a object that will have the key Files in it. It is something similiar to the `event.target` object you would get on a change event of a file type input.
    - target.files { Array } - This can be a `Blob` or an object with the key `url` inside of it. eg. `[{ url: https://pbs.twimg.com/profile_images/544039728463351808/NkoRdBBL_bigger.png }]`. When creating an event this will attempt to convert this url into a blob if it is an image, otherwise it will just pass the object to the upload adapter.
*/

FileUploader.prototype.upload = function( target ) { 

    if ( typeof target.files !== 'object' ) { // default upload events are not a true array
        this.emit( 'error', new Error( 'target passed to FileUploader::upload does not have files array' ) );
        return;
    }

    if ( typeof this.uploadFn !== 'function' ) {
        // error
        this.emit( 'error', new Error( 'No upload function added using FileUploader::useToUpload' ) );
        return;
    }

    var _event = {},
        close = this.close.bind( this ),
        uploadFn = this.uploadFn,
        closeOnUpload = this.defaults.closeOnUpload,
        error = this.emit.bind( this, 'error' );

    _event.files = target.files;
    _event.originalEvent = target;

    // ways to give feedback to FileUploader
    _event.done = this.emit.bind( this, 'done' );
    _event.error = error;

    new UploadEvent( _event, function( err, uploadEvent ) {
        if ( err ) {
            error( err );
            return;
        }

        uploadFn( uploadEvent || _event );
        if ( closeOnUpload ) { // this should be changable
            close();
            return;
        }
    } )


};

/*
### FileUploader::addPlugin

This will add a plugin to the list of available plugins. Meaning that it will also add the plugin name to the list of _tabable_ plugins, and targets to open when opening the `FileUploader`.

__params__

- plugin { Object } - A `Plugin` object that has a number of differnt attributes on the plugin to allow the `FileUploader` to read and interact with the plugin. If some required methods are not provided the plugin will not be added and an `error` event will be emitted from the FileUploader.

- options { Object } - _Optional_ A optional object that can specify the behavior in which the `FileUploader` behaves with plugin. 
  - options.menuItem { Boolean } - _Optional_ A flag to specify if the plugin should be linked to in a list of plugins.

__returns__

- plugin { Object } - A copy of the `Plugin` object back with the `isAdded` property set to true if successfull added to the `FileUploader`

```javascript
var fileUploader = require( 'file-uploader' ),
    foo = {
        open: function(){}
    },
    bar = {
        open: function(){},
        teardown: function(){},
        attributes: {
            name: 'Bar'
        }
    },
    pluginFoo = fileUploader.addPlugin( foo ),
    pluginBar = fileUploader.addPlugin( bar );

pluginFoo.isAdded // false - missing some required methods
pluginBar.isAdded // true
```
*/

FileUploader.prototype.addPlugin = function( plugin, options ) {
    
    var _plugin = merge( true, {}, plugin || {} );
    options = options || {};

    if ( !FileUploader.isPlugin( plugin ) ){
        _plugin.isAdded = false;
        return _plugin;
    }  

    this.plugins[ _plugin.attributes.name ] = _plugin;
    _plugin.isAdded = true;
    return _plugin;

};

/*
### FileUploader::useToUpload

This is a way to extend the file uploader to allow for custom ways to upload files to your server. 

__params__

- uploadFn { Function } - a function that will be called when ever an asset is attempted to be uploaded. Due to the pluggablity of this modal this can be a number of things depending on the nature of the plugin. This can also be used to save information to you database about the data being uploaded.

uploadFn is passed an UploadEvent object that has a number of hooks that you can tie your uploader into to allow for an interactive experience while uploading photos. See `UploadEvent` object specification to see how to hook into this functionality

```javascript
var fileUploader = require( 'file-uploader' );

fileUploader.useToUpload( function( <UploadEvent> ) {
    var files = event.files; // this is commiting from a input file event
    // blah blah upload
    feedbackFns.done({
        files[{ url: 'http://foo.bar/baz.png' }]
    })
} );
```
*/

FileUploader.prototype.useToUpload = function( fn ) {
    
    if ( typeof fn === 'function' ) {
        this.uploadFn = fn;
        return;
    }

    this.emit( 'error', new Error( 'useToUpload needs to be passed a function as the first parameter, ' + typeof fn + ' given.' ) );
};

FileUploader.isPlugin = function( plugin ) {

    if ( !plugin || typeof plugin !== 'object' ) {
        return false;
    }

    if ( typeof plugin.open !== 'function' || typeof plugin.teardown !== 'function' ) {
        return false;
    }

    if ( !plugin.attributes ) {
        return false;
    }

    if ( typeof plugin.attributes.name !== 'string' ) {
        return false;
    }

    return true;
};

FileUploader.pluginVisible = function( plugin ) {
    return !plugin.attributes.hide;
};

FileUploader.mapPlugins = function( plugins ) {
    return function( pluginName ) {
        return plugins[ pluginName ];
    }
};

FileUploader.pluginListEl = function( plugin ) {
    var el = document.createElement( 'li' ),
        span = document.createElement( 'span' );

    // consider some way to use icons
    span.innerText = plugin.attributes.name;
    // need a way to bind events
    el.appendChild( span );

    return el;
};

FileUploader.prototype._init = function( ) {

    // this.el is built in the constructor
    var div = document.createElement.bind( document, 'div' ); 

    this.tableEl = div();
    this.cellEl = div();
    this.modalEl = div();
    this.contentEl = div();
    this.listEl = document.createElement( 'ul' );
    // classing structure
    this.el.classList.add( 'FileUploader-modal-overlay' );
    this.tableEl.classList.add( 'FileUploader-modal-table' ); // this is here to allow vertical centering
    this.cellEl.classList.add( 'FileUploader-modal-cell' );
    this.modalEl.classList.add( 'FileUploader-modal' );
    this.contentEl.classList.add( 'FileUploader-modal-content' );
    this.listEl.classList.add( 'FileUploader-modal-list' );
    // adding them all together
    this.el.appendChild( this.tableEl );
    this.tableEl.appendChild( this.cellEl );
    this.cellEl.appendChild( this.modalEl );
    this.modalEl.appendChild( this.listEl );
    this.modalEl.appendChild( this.contentEl );

    /* HTML repesentation
    
    <div class="FileUploader-modal-overlay" >
        <div class="FileUploader-modal-table" >
            <div class="FileUploader-modal-cell" >
                <div class="FileUploader-modal" >
                    <ul class="FileUploader-modal-list"></ul>
                    <div class="FileUploader-modal-content"></div>
                </div>
            </div>
        </div>
    </div>

    */

    // attach default plugin
    this.addPlugin( uploadPlugin );
};

FileUploader.prototype._handlePluginOpen = function( options, err, el ) {

    var defaultPlugin = this.defaults.plugin,
        openDefault = this.open.bind( this, merge( options, { 
            plugin: defaultPlugin
        } ) );

    if ( err ) {
        this.emit( 'error', err );
        if ( options.plugin !== defaultPlugin ) {
            openDefault();
        }
        return;
    }

    if ( typeof el === 'string' ) {
        this.contentEl.innerHTML = el;
        return;
    }

    if ( typeof el === 'object' && el.tagName ) {
        this.contentEl.innerHTML = '';
        this.contentEl.appendChild( el );
        return;
    }

    openDefault(); // just try to open default when no content is given
};

module.exports = new FileUploader();
module.exports.FileUploader = FileUploader;
module.exports.UploadEvent = UploadEvent;
module.exports.imageToBlob = require( 'image-to-blob' );

},{"./src/plugins/upload":20,"./src/upload-event":21,"./src/utils":22,"event-emitter":2,"image-to-blob":17,"merge":19}],2:[function(require,module,exports){
'use strict';

var d        = require('d')
  , callable = require('es5-ext/object/valid-callable')

  , apply = Function.prototype.apply, call = Function.prototype.call
  , create = Object.create, defineProperty = Object.defineProperty
  , defineProperties = Object.defineProperties
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , descriptor = { configurable: true, enumerable: false, writable: true }

  , on, once, off, emit, methods, descriptors, base;

on = function (type, listener) {
	var data;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) {
		data = descriptor.value = create(null);
		defineProperty(this, '__ee__', descriptor);
		descriptor.value = null;
	} else {
		data = this.__ee__;
	}
	if (!data[type]) data[type] = listener;
	else if (typeof data[type] === 'object') data[type].push(listener);
	else data[type] = [data[type], listener];

	return this;
};

once = function (type, listener) {
	var once, self;

	callable(listener);
	self = this;
	on.call(this, type, once = function () {
		off.call(self, type, once);
		apply.call(listener, this, arguments);
	});

	once.__eeOnceListener__ = listener;
	return this;
};

off = function (type, listener) {
	var data, listeners, candidate, i;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) return this;
	data = this.__ee__;
	if (!data[type]) return this;
	listeners = data[type];

	if (typeof listeners === 'object') {
		for (i = 0; (candidate = listeners[i]); ++i) {
			if ((candidate === listener) ||
					(candidate.__eeOnceListener__ === listener)) {
				if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
				else listeners.splice(i, 1);
			}
		}
	} else {
		if ((listeners === listener) ||
				(listeners.__eeOnceListener__ === listener)) {
			delete data[type];
		}
	}

	return this;
};

emit = function (type) {
	var i, l, listener, listeners, args;

	if (!hasOwnProperty.call(this, '__ee__')) return;
	listeners = this.__ee__[type];
	if (!listeners) return;

	if (typeof listeners === 'object') {
		l = arguments.length;
		args = new Array(l - 1);
		for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

		listeners = listeners.slice();
		for (i = 0; (listener = listeners[i]); ++i) {
			apply.call(listener, this, args);
		}
	} else {
		switch (arguments.length) {
		case 1:
			call.call(listeners, this);
			break;
		case 2:
			call.call(listeners, this, arguments[1]);
			break;
		case 3:
			call.call(listeners, this, arguments[1], arguments[2]);
			break;
		default:
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) {
				args[i - 1] = arguments[i];
			}
			apply.call(listeners, this, args);
		}
	}
};

methods = {
	on: on,
	once: once,
	off: off,
	emit: emit
};

descriptors = {
	on: d(on),
	once: d(once),
	off: d(off),
	emit: d(emit)
};

base = defineProperties({}, descriptors);

module.exports = exports = function (o) {
	return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
};
exports.methods = methods;

},{"d":3,"es5-ext/object/valid-callable":12}],3:[function(require,module,exports){
'use strict';

var assign        = require('es5-ext/object/assign')
  , normalizeOpts = require('es5-ext/object/normalize-options')
  , isCallable    = require('es5-ext/object/is-callable')
  , contains      = require('es5-ext/string/#/contains')

  , d;

d = module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if ((arguments.length < 2) || (typeof dscr !== 'string')) {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (dscr == null) {
		c = w = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
		w = contains.call(dscr, 'w');
	}

	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== 'string') {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (get == null) {
		get = undefined;
	} else if (!isCallable(get)) {
		options = get;
		get = set = undefined;
	} else if (set == null) {
		set = undefined;
	} else if (!isCallable(set)) {
		options = set;
		set = undefined;
	}
	if (dscr == null) {
		c = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
	}

	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

},{"es5-ext/object/assign":4,"es5-ext/object/is-callable":7,"es5-ext/object/normalize-options":11,"es5-ext/string/#/contains":14}],4:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.assign
	: require('./shim');

},{"./is-implemented":5,"./shim":6}],5:[function(require,module,exports){
'use strict';

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};

},{}],6:[function(require,module,exports){
'use strict';

var keys  = require('../keys')
  , value = require('../valid-value')

  , max = Math.max;

module.exports = function (dest, src/*, …srcn*/) {
	var error, i, l = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try { dest[key] = src[key]; } catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < l; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};

},{"../keys":8,"../valid-value":13}],7:[function(require,module,exports){
// Deprecated

'use strict';

module.exports = function (obj) { return typeof obj === 'function'; };

},{}],8:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.keys
	: require('./shim');

},{"./is-implemented":9,"./shim":10}],9:[function(require,module,exports){
'use strict';

module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};

},{}],10:[function(require,module,exports){
'use strict';

var keys = Object.keys;

module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};

},{}],11:[function(require,module,exports){
'use strict';

var assign = require('./assign')

  , forEach = Array.prototype.forEach
  , create = Object.create, getPrototypeOf = Object.getPrototypeOf

  , process;

process = function (src, obj) {
	var proto = getPrototypeOf(src);
	return assign(proto ? process(proto, obj) : obj, src);
};

module.exports = function (options/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (options == null) return;
		process(Object(options), result);
	});
	return result;
};

},{"./assign":4}],12:[function(require,module,exports){
'use strict';

module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],13:[function(require,module,exports){
'use strict';

module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{}],14:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? String.prototype.contains
	: require('./shim');

},{"./is-implemented":15,"./shim":16}],15:[function(require,module,exports){
'use strict';

var str = 'razdwatrzy';

module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};

},{}],16:[function(require,module,exports){
'use strict';

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],17:[function(require,module,exports){

/* global unescape */

'use strict';

var imageToUri = require( 'image-to-data-uri' );

/*
## Image to blob
----------------------------------------------------------------------
Converts remote image urls to blobs via canvas. 

```javascript
var imageToBlob = require( 'image-to-blob' );

imageToBlob( 'http://foo.bar/baz.png', function( err, uri ) { 
    console.log( uri ); 
} );
imageToBlob( document.getElementsByTagName( 'img' )[ 0 ], function( err, uri ) { 
    console.log( uri ); 
} );
```
*/

var types = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml' // this gets converted to png
};

module.exports = imageToBlob;
module.exports.dataURItoBlob = dataURItoBlob;
module.exports._handleImageToURI = handleImageToURI;
module.exports.getMimeTypeFromUrl = getType;

/*
    imageToBlob - main function that gets exposed, converts either dom node or url of image into blob data

    params
        img { Object | String } - either can be an IMG DOM node or a url string that will load the image
        options { Object } - optional, a set of options that you can pass to the imagetoblob to change the behavior
        callback { Function } - a function to be called after the conversion is completed. The callback will get passed an error ( if one occures ) and the blob.

*/

function imageToBlob( img, options, callback ) {
    
    var src;

    if ( typeof options === 'function' ) {
        callback = options;
        options = {};
    }

    options = options || {};

    if ( !img ) {
        return callback( new Error( 'Pass in a IMG DOM node or a url as first param' ) );
    }

    if ( typeof img === 'object' && img.tagName.toLowerCase() === 'img' ) {
        src = img.src;
    }

    if ( typeof img === 'string' ) {
        src = img;
    }

    if ( /^data:/.test( src ) ) { // check to see if its a data uri
        callback( null, dataURItoBlob( src ) ); // script to datauri conversion
        return;
    }

    options.type = types[ options.type ] || getType( src );
    options.src = src;
    options.callback = callback;
    if ( !options.type ) {

        callback( new Error( 'Image type is not supported' ) );
        return;
    }

    imageToUri( src, options.type, handleImageToURI.bind( null, options ) ); // attempt if we have a 
}

/*
    dataURItoBlob - takes a datauri and converts it into a blob

    params
        uri { String } - a valid datauri

    returns
        blob { Blob Object } - generated blob object

*/


function dataURItoBlob( uri ) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString,
        mimeString,
        ia;

    if ( uri.split( ',' )[0].indexOf( 'base64' ) >= 0 ) {

        byteString = atob( uri.split(',')[1] );
    }
    else {

        byteString = unescape( uri.split(',')[1] );
    }

    // separate out the mime component
    mimeString = uri.split( ',' )[ 0 ].split( ':' )[ 1 ].split( ';' )[ 0 ];

    // write the bytes of the string to a typed array
    ia = new Uint8Array( byteString.length );

    for ( var i = 0; i < byteString.length; i++ ) {
        
        ia[ i ] = byteString.charCodeAt( i );
    }

    return new Blob( [ ia ], {
        type: mimeString
    } );
}

/*
    handleImageToURI - handles a callback from imageToURI and glues together dataURItoBlob

    params
        options { Object } - the options object passed to the main fn with the callback attached to it
        err { Error Object } - an error if one occurs in the imageToURI method 
        uri { String } - a valid data url

*/

function handleImageToURI( options, err, uri ) {

    if ( err ) {
        options.callback( err );
        return;
    }

    options.callback( null, dataURItoBlob( uri ) );

}

/*
    getType - small util to get type from url if one is present in types list

    params
        url { String } - a url to parse the file extension from

    returns
        type { String } - a mime type if type is supported, if not undefined is returned

*/

function getType( url ) {
    return url ? types[ url.split( '?' ).shift( ).split( '.' ).pop( ) ] : null ;
}

},{"image-to-data-uri":18}],18:[function(require,module,exports){
// converts a URL of an image into a dataURI
module.exports = function (url, mimeType, cb) {
    // Create an empty canvas and image elements
    var canvas = document.createElement('canvas'),
        img = document.createElement('img');

    if ( typeof mimeType === 'function' ) {
        cb = mimeType;
        mimeType = null;
    }

    mimeType = mimeType || 'image/png';

    // allow for cross origin that has correct headers
    img.crossOrigin = "Anonymous"; 

    img.onload = function () {
        var ctx = canvas.getContext('2d');
        // match size of image
        canvas.width = img.width;
        canvas.height = img.height;

        // Copy the image contents to the canvas
        ctx.drawImage(img, 0, 0);

        // Get the data-URI formatted image
        cb( null, canvas.toDataURL( mimeType ) );
    };

    img.onerror = function () {
        cb(new Error('FailedToLoadImage'));
    };

    // canvas is not supported
    if (!canvas.getContext) {
        cb(new Error('CanvasIsNotSupported'));
    } else {
        img.src = url;
    }
};

},{}],19:[function(require,module,exports){
/*!
 * @name JavaScript/NodeJS Merge v1.2.0
 * @author yeikos
 * @repository https://github.com/yeikos/js.merge

 * Copyright 2014 yeikos - MIT license
 * https://raw.github.com/yeikos/js.merge/master/LICENSE
 */

;(function(isNode) {

	/**
	 * Merge one or more objects 
	 * @param bool? clone
	 * @param mixed,... arguments
	 * @return object
	 */

	var Public = function(clone) {

		return merge(clone === true, false, arguments);

	}, publicName = 'merge';

	/**
	 * Merge two or more objects recursively 
	 * @param bool? clone
	 * @param mixed,... arguments
	 * @return object
	 */

	Public.recursive = function(clone) {

		return merge(clone === true, true, arguments);

	};

	/**
	 * Clone the input removing any reference
	 * @param mixed input
	 * @return mixed
	 */

	Public.clone = function(input) {

		var output = input,
			type = typeOf(input),
			index, size;

		if (type === 'array') {

			output = [];
			size = input.length;

			for (index=0;index<size;++index)

				output[index] = Public.clone(input[index]);

		} else if (type === 'object') {

			output = {};

			for (index in input)

				output[index] = Public.clone(input[index]);

		}

		return output;

	};

	/**
	 * Merge two objects recursively
	 * @param mixed input
	 * @param mixed extend
	 * @return mixed
	 */

	function merge_recursive(base, extend) {

		if (typeOf(base) !== 'object')

			return extend;

		for (var key in extend) {

			if (typeOf(base[key]) === 'object' && typeOf(extend[key]) === 'object') {

				base[key] = merge_recursive(base[key], extend[key]);

			} else {

				base[key] = extend[key];

			}

		}

		return base;

	}

	/**
	 * Merge two or more objects
	 * @param bool clone
	 * @param bool recursive
	 * @param array argv
	 * @return object
	 */

	function merge(clone, recursive, argv) {

		var result = argv[0],
			size = argv.length;

		if (clone || typeOf(result) !== 'object')

			result = {};

		for (var index=0;index<size;++index) {

			var item = argv[index],

				type = typeOf(item);

			if (type !== 'object') continue;

			for (var key in item) {

				var sitem = clone ? Public.clone(item[key]) : item[key];

				if (recursive) {

					result[key] = merge_recursive(result[key], sitem);

				} else {

					result[key] = sitem;

				}

			}

		}

		return result;

	}

	/**
	 * Get type of variable
	 * @param mixed input
	 * @return string
	 *
	 * @see http://jsperf.com/typeofvar
	 */

	function typeOf(input) {

		return ({}).toString.call(input).slice(8, -1).toLowerCase();

	}

	if (isNode) {

		module.exports = Public;

	} else {

		window[publicName] = Public;

	}

})(typeof module === 'object' && module && typeof module.exports === 'object' && module.exports);
},{}],20:[function(require,module,exports){

var plugin = module.exports = {
    open: function( meta, fileUploader, done ) {
        var container = document.createElement( 'form' ),
            button = document.createElement( 'button' );
        
        plugin.upload = document.createElement( 'input' );
        plugin.upload.type = 'file';

        plugin.input = document.createElement( 'input' );
        plugin.input.type = 'url';

        button.innerHTML = 'Submit';

        container.appendChild( plugin.upload );
        container.appendChild( plugin.input );
        container.appendChild( button );

        container.addEventListener( 'submit', onEventSubmit.bind( null, fileUploader ) );
        plugin.upload.addEventListener( 'change', onEventChange.bind( null, fileUploader ) );
        done( null, container );
    },
    teardown: function() {
        container.removeEventListener( 'submit' )        
        plugin.upload.removeEventListener( 'change' );
    },
    attributes: {
        'name' : 'upload'
    }
}


function onEventChange( fileUploader, event ) {
    fileUploader.upload( event.target );
}

function onEventSubmit( fileUploader ) {
    var input = plugin.input,
        value = input.value,
        event = {
            files: [{
                url: value
            }]
        };

    fileUploader.upload( event );
}
},{}],21:[function(require,module,exports){

'use strict';

var imageToBlob = require( 'image-to-blob' ),
    utils = require( './utils' );

module.exports = createUploadEvent;

function createUploadEvent ( eventdata, callback ) {
    _getBlobData( eventdata, function( err, files ) { 
        if ( err ) return callback( err );
        eventdata.files = files;

        callback( null, eventdata );
    } );    
}
 
function _getBlobData ( eventdata, callback ) {
    var files = utils.makeArray( eventdata.files ),
        size = files.length,
        count = 0;

    function done ( ) {
        count ++;
        if ( count === size ) {
            callback( null, files );
        }
    }

    function getBlobData( file, index ) {
        if ( file instanceof Blob ) {
            done(); // if its already a blob no need to do anything
            return;
        }

        if ( file.url || file.data ) { // if the file url is set of the file data meaning a datauri
            imageToBlob( file.url || file.data, function( err, blob ) {
                if ( err ) return done(); // unable to convert so send in raw form
                files[ index ] = blob;
                done( );
            } );
            return;
        }
        done( );
    }

    files.forEach( getBlobData );
}

},{"./utils":22,"image-to-blob":17}],22:[function(require,module,exports){

'use strict';

module.exports.makeArray = function ( arr ) {
    return Array.prototype.slice.call( arr, 0 );
};
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvZmFrZV81ZGI1ZWE3LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL2luZGV4LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL25vZGVfbW9kdWxlcy9kL2luZGV4LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9hc3NpZ24vaW5kZXguanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvbm9kZV9tb2R1bGVzL2V2ZW50LWVtaXR0ZXIvbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2Fzc2lnbi9pcy1pbXBsZW1lbnRlZC5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9ub2RlX21vZHVsZXMvZXZlbnQtZW1pdHRlci9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvYXNzaWduL3NoaW0uanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvbm9kZV9tb2R1bGVzL2V2ZW50LWVtaXR0ZXIvbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlLmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL2luZGV4LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL2lzLWltcGxlbWVudGVkLmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL3NoaW0uanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvbm9kZV9tb2R1bGVzL2V2ZW50LWVtaXR0ZXIvbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L25vcm1hbGl6ZS1vcHRpb25zLmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC92YWxpZC1jYWxsYWJsZS5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9ub2RlX21vZHVsZXMvZXZlbnQtZW1pdHRlci9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtdmFsdWUuanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvbm9kZV9tb2R1bGVzL2V2ZW50LWVtaXR0ZXIvbm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvaW5kZXguanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvbm9kZV9tb2R1bGVzL2V2ZW50LWVtaXR0ZXIvbm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvaXMtaW1wbGVtZW50ZWQuanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvbm9kZV9tb2R1bGVzL2V2ZW50LWVtaXR0ZXIvbm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvc2hpbS5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9ub2RlX21vZHVsZXMvaW1hZ2UtdG8tYmxvYi9pbmRleC5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9ub2RlX21vZHVsZXMvaW1hZ2UtdG8tYmxvYi9ub2RlX21vZHVsZXMvaW1hZ2UtdG8tZGF0YS11cmkvaW1hZ2UtdG8tZGF0YS11cmkuanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvbm9kZV9tb2R1bGVzL21lcmdlL21lcmdlLmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL3NyYy9wbHVnaW5zL3VwbG9hZC5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9zcmMvdXBsb2FkLWV2ZW50LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL3NyYy91dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbWVyZ2UgPSByZXF1aXJlKCAnbWVyZ2UnICksXG4gICAgZXZlbnRFbWl0dGVyID0gcmVxdWlyZSggJ2V2ZW50LWVtaXR0ZXInICksXG4gICAgVXBsb2FkRXZlbnQgPSByZXF1aXJlKCAnLi9zcmMvdXBsb2FkLWV2ZW50JyksXG4gICAgdXRpbHMgPSByZXF1aXJlKCAnLi9zcmMvdXRpbHMnICksXG4gICAgdXBsb2FkUGx1Z2luID0gcmVxdWlyZSggJy4vc3JjL3BsdWdpbnMvdXBsb2FkJyApO1xuXG4vKlxuIyMjIEZpbGVVcGxvYWRlciAtIENvbnN0cnVjdG9yXG5cblRoaXMgaXMgYSBiYXNpYyBDb25zdHJ1Y3RvciB0aGF0IHdpbGwganVzdCBpbml0aWFsaXplIHNvbWUgYmFzaWMgZGF0YSBzdHJ1Y3R1cmVzIG5lZWRlZCB0byBjaGFuZ2UgdGhlIHN0YXRlIG9mIHRoZSBmaWxlVXBsb2FkIHRoaXMgc2hvdWxkIG5vdCBkdWUgbXVjaCBkdWUgdG8gdGhlIGZhY3QgdGhhdCB0aGlzIHdpbGwgaGFwcGVuIGluaXRpYWxseSBpbnNpZGUgb2YgdGhlIG1vZHVsZSBmb3IgdGhlIHNpbmdsZXRvbi4gVGhpcyBzaG91bGQgYWxzbyBiZSBhY2Nlc3NhYmxlIHZpYSBhbiBleHBvcnQuXG5cbmBgYGphdmFzY3JpcHRcbnZhciBGaWxlVXBsb2FkZXIgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKS5GaWxlVXBsb2FkZXIsXG4gICAgZmlsZVVwbG9hZGVyID0gbmV3IEZpbGVVcGxvYWRlcigpO1xuYGBgXG4qL1xuXG5mdW5jdGlvbiBGaWxlVXBsb2FkZXIoKSB7XG5cbiAgICBldmVudEVtaXR0ZXIoIHRoaXMgKTtcblxuICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgIHZpZXc6IDBcbiAgICB9O1xuICAgIHRoaXMucGx1Z2lucyA9IHsgfTtcbiAgICB0aGlzLmRlZmF1bHRzID0ge1xuICAgICAgICBwbHVnaW4gOiAndXBsb2FkJyxcbiAgICAgICAgY2xvc2VPblVwbG9hZDogdHJ1ZVxuICAgIH07XG5cbiAgICBzZXRUaW1lb3V0KCB0aGlzLl9pbml0LmJpbmQoIHRoaXMgKSwgMCApO1xufVxuXG5GaWxlVXBsb2FkZXIucHJvdG90eXBlID0ge1xuICAgIGdldCBwbHVnaW5MaXN0ICggKSB7XG4gICAgICAgIHZhciBwbHVnaW5zID0gT2JqZWN0LmtleXMoIHRoaXMucGx1Z2lucyApO1xuICAgICAgICByZXR1cm4gcGx1Z2lucy5tYXAoIEZpbGVVcGxvYWRlci5tYXBQbHVnaW5zKCB0aGlzLnBsdWdpbnMgKSApXG4gICAgICAgICAgICAuZmlsdGVyKCBGaWxlVXBsb2FkZXIucGx1Z2luVmlzaWJsZSApXG4gICAgICAgICAgICAubWFwKCBGaWxlVXBsb2FkZXIucGx1Z2luTGlzdEVsICk7XG4gICAgfVxufTtcblxuLypcbiMjIyBGaWxlVXBsb2FkZXI6Om9wZW5cblxuVGhpcyB3aWxsIGp1c3QgYXBwbHkgYSBjbGFzcywgYHNob3dgLCB0byB0aGUgdXBsb2FkZXIgbW9kYWwgY29udGFpbmVyIHRvIHNob3cgdGhlIG1vZGFsLiBTaW5jZSBvbmx5IGV4YW1wbGUgQ1NTIGlzIHByb3ZpZGVkIGVpdGhlciB0aGUgZXhhbXBsZSBjc3MgbmVlZHMgdG8gYmUgaW50ZXJncmF0ZWQgaW50byB0aGUgY29kZSBvciB5b3Ugd2lsbCBuZWVkIHRvIHByb3ZpZGUgdGhhdCBmdW5jdGlvbmFsaXR5LiBUaGlzIHdpbGwgYWxzbyBzZXQgdGhlIHZpZXcgc3RhdGUgb2YgdGhlIGBmaWxlVXBsb2FkZXJgIG9iamVjdCB0byBgMWAgdG8gaW5kaWNhdGUgdGhhdCB0aGUgbW9kYWwgaXMgb3Blbi5cblxuYGBgamF2YXNjcmlwdFxudmFyIGZpbGVVcGxvYWRlciA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5maWxlVXBsb2FkZXIub3BlbigpO1xuXG5pZiAoIGZpbGVVcGxvYWRlci5zdGF0ZS52aWV3ID09PSAxICkge1xuICAgIGNvbnNvbGUubG9nKCAnZmlsZVVwbG9hZGVyIGlzIG9wZW4nICk7XG59XG5cbmBgYFxuXG5fX3BhcmFtc19fXG5cbi0gb3B0aW9ucyB7IE9iamVjdCB9IC0gQW4gb2JqZWN0IHRoYXQgd2lsbCBzdG9yZSBzb21lIGluZm9ybWF0aW9uIHRoYXQgcGVydGFpbnMgdG8gdGhlIHZpZXcgb25jZSBiZWluZyBvcGVuZWQuXG4gICAgLSBvcHRpb25zLm1ldGEgeyBPYmplY3QgfSAtIEFuIG9iamVjdCB0aGF0IGhvbGRzIGRhdGEgYWJvdXQgY3VycmVudCBzdGF0ZSBvZiBhcHAgdGhhdCBpcyBvcGVuaW5nIHZpZXcgY2V0YWluIHBsdWdpbnMsIG9yIHRhYnMsIHRha2UgZGlmZmVybnQgdHlwZXMgb2YgaW5mb3JtYXRpb24gaW4gdGhpcyBhcmVhIHRvIGZ1bmN0aW9uIHByb3Blcmx5LiBfU2VlIHNwZWNpZmljIHBsdWdpbl8gYFBsdWdpbjo6b3BlbiAtPiBvcHRpb25zYCBmb3IgbW9yZSBzcGVjaWZpYyBkZXRhaWxzIHNpbmNlIGBvcHRpb25zLm1ldGFgIGlzIGdlbmVyYWx5IGp1c3QgcGFzc2VkIHRvIHRoZSBwbHVnaW4gYXMgdGhhdCBvYmplY3QuXG4gICAgLSBvcHRpb25zLnBsdWdpbiB7IFN0cmluZyB9IC0gdGhpcyBpcyB0aGUgbmFtZSBvZiB0aGUgcGx1Z2luIHRvIGhhdmUgb3BlbiB3aGVuIGNhbGxpbmcgdGhlIG9wZW4gZm4uIFRoaXMgd2lsbCBhbHNvIHRyaWdnZXIgYSBgUGx1Z2luOjpvcGVuYC4gU2luY2UgbW9zdCBvZiB0aGUgYmFzaWMgZnVuY3Rpb25hbGl0eSBpcyB3cml0dGVuIGFzIGEgcGx1Z2luIHRoaXMgY2FuIGJlIHVzZWQgdG8gb3BlbiBkZWZhdWx0IHZpZXdzLiBBbHNvIGlmIG5vIG5hbWUgaXMgZ2l2ZW4gdGhlbiBpdCBkZWZhdWx0cyB0byB0aGUgbWFpbiBgdXBsb2FkLXBob3RvYCBwbHVnaW4uXG5cbl9fcmV0dXJuc19fXG5cbi0gUGx1Z2luIHsgT2JqZWN0IH0gLSBwbHVnaW4gdGhhdCBpcyBvcGVuZWRcblxuYGBgamF2YXNjcmlwdFxudmFyIGZpbGVVcGxvYWRlciA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5maWxlVXBsb2FkZXIub3Blbigge1xuICAgIG1ldGE6IHtcbiAgICAgICAgZGVzY3JpcHRpb246ICdBd2Vzb21lIGNhdHMgYW5kIHBpenphXFwncyBpbiBzcGFjZSdcbiAgICB9LFxuICAgIHBsdWdpbjogJ2dpcGh5LXNlYXJjaCcgIFxufSApOyBcblxuYGBgXG4qL1xuXG5GaWxlVXBsb2FkZXIucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIGRlZmF1bHRQbHVnaW4gPSB0aGlzLmRlZmF1bHRzLnBsdWdpbixcbiAgICAgICAgcGx1Z2luTmFtZSA9ICBvcHRpb25zLnBsdWdpbiB8fCBkZWZhdWx0UGx1Z2luLFxuICAgICAgICBwbHVnaW4gPSB0aGlzLnBsdWdpbnNbIHBsdWdpbk5hbWUgXSB8fCB0aGlzLnBsdWdpbnNbIGRlZmF1bHRQbHVnaW4gXTtcblxuICAgIG9wdGlvbnMucGx1Z2luID0gcGx1Z2luTmFtZTtcbiAgICB0aGlzLmN1cnJlbnRQbHVnaW4gPSBwbHVnaW47XG5cbiAgICAvLyB1cGRhdGUgbGlua3NcbiAgICB0aGlzLmxpc3RFbC5pbm5lckhUTUwgPSAnJztcbiAgICB0aGlzLnBsdWdpbkxpc3QuZm9yRWFjaCggdGhpcy5saXN0RWwuYXBwZW5kQ2hpbGQuYmluZCggdGhpcy5saXN0RWwgKSApO1xuXG4gICAgdGhpcy5lbC5jbGFzc0xpc3QuYWRkKCAnc2hvdycgKTtcbiAgICB0aGlzLnN0YXRlLnZpZXcgPSAxO1xuICAgIC8vIG9wZW4gcGx1Z2luXG4gICAgaWYgKCAhcGx1Z2luICkge1xuICAgICAgICB0aGlzLmVtaXQoICdlcnJvcicsIG5ldyBFcnJvciggJ05vIFBsdWdpbiBpcyBmb3VuZCB3aXRoIHRoZSBuYW1lICcgKyBwbHVnaW5OYW1lICkgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBwbHVnaW4ub3Blbiggb3B0aW9ucy5tZXRhIHx8IHt9LCB0aGlzLCB0aGlzLl9oYW5kbGVQbHVnaW5PcGVuLmJpbmQoIHRoaXMsIG9wdGlvbnMgKSApO1xuXG4gICAgdGhpcy5lbWl0KCAnb3BlbicsIHBsdWdpbiApOyBcblxufTtcblxuXG4vKlxuIyMjIEZpbGVVcGxvYWRlcjo6Y2xvc2VcblxuVGhpcyB3aWxsIHJlbW92ZSB0aGUgYHNob3dgIGZyb20gdGhlIHVwbG9hZGVyIG1vZGFsIGNvbnRhaW5lci4gVGhpcyB3aWxsIGFsc28gdHJpZ2dlciBgUGx1Z2luOjp0ZWFyZG93bmAgdG8gdGhlIGN1cnJlY3QgYWN0aXZlIHBsdWdpbi5cblxuYGBgamF2YXNjcmlwdFxudmFyIGZpbGVVcGxvYWRlciA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5maWxlVXBsb2FkZXIub3BlbigpO1xuZmlsZVVwbGFkZXIuY2xvc2UoKTtcblxuaWYgKCAhZmlsZVVwbG9hZGVyLnN0YXRlLnZpZXcgKSB7XG4gICAgY29uc29sZS5sb2coICdmaWxlVXBsb2FkZXIgaXMgY2xvc2VkJyApO1xufVxuXG5gYGBcbiovXG5cbkZpbGVVcGxvYWRlci5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcblxuICAgIHRoaXMuZWwuY2xhc3NMaXN0LnJlbW92ZSggJ3Nob3cnICk7XG4gICAgdGhpcy5zdGF0ZS52aWV3ID0gMDtcblxuICAgIHRoaXMuY29udGVudEVsLmlubmVySFRNTCA9ICcnO1xuICAgIGlmICggdGhpcy5jdXJyZW50UGx1Z2luICYmIHR5cGVvZiB0aGlzLmN1cnJlbnRQbHVnaW4udGVhcmRvd24gPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFBsdWdpbi50ZWFyZG93bigpO1xuICAgICAgICB0aGlzLmN1cnJlbnRQbHVnaW4gPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuZW1pdCggJ2Nsb3NlJyApO1xuXG59O1xuXG4vKlxuIyMjIEZpbGVVcGxvYWRlcjo6dXBsb2FkXG5cblVwbG9hZCBtZXRob2QgaXMgYSBwcm94eSB0byB0aGUgVXBsb2FkIGFkYXB0ZXIgdGhhdCBzaG91bGQgYmUgcHJvdmlkZWQuIFRoaXMgaXMgdXNlZCBtYWlubHkgdG8gbm9ybWFsaXplIHNvbWUgb2YgdGhlIGV2ZW50IGRhdGEgYWxsb3dpbmcgaXQgdG8gYmUgaW4gYSBjb21tb24gZm9ybWF0IHRoYXQgdXBsb2FkZXIgYWRhcHRlcnMgY2FuIGVhc2lseSBkZWFsIHdpdGguIFRoaXMgaXMgbWFpbmx5IHRvIGJlIHVzZWQgaW5zaWRlIG9mIHBsdWdpbnNcblxuX19wYXJhbXNfX1xuXG4tIHRhcmdldCB7IE9iamVjdCB9IC0gVGhpcyBpcyBhIG9iamVjdCB0aGF0IHdpbGwgaGF2ZSB0aGUga2V5IEZpbGVzIGluIGl0LiBJdCBpcyBzb21ldGhpbmcgc2ltaWxpYXIgdG8gdGhlIGBldmVudC50YXJnZXRgIG9iamVjdCB5b3Ugd291bGQgZ2V0IG9uIGEgY2hhbmdlIGV2ZW50IG9mIGEgZmlsZSB0eXBlIGlucHV0LlxuICAgIC0gdGFyZ2V0LmZpbGVzIHsgQXJyYXkgfSAtIFRoaXMgY2FuIGJlIGEgYEJsb2JgIG9yIGFuIG9iamVjdCB3aXRoIHRoZSBrZXkgYHVybGAgaW5zaWRlIG9mIGl0LiBlZy4gYFt7IHVybDogaHR0cHM6Ly9wYnMudHdpbWcuY29tL3Byb2ZpbGVfaW1hZ2VzLzU0NDAzOTcyODQ2MzM1MTgwOC9Oa29SZEJCTF9iaWdnZXIucG5nIH1dYC4gV2hlbiBjcmVhdGluZyBhbiBldmVudCB0aGlzIHdpbGwgYXR0ZW1wdCB0byBjb252ZXJ0IHRoaXMgdXJsIGludG8gYSBibG9iIGlmIGl0IGlzIGFuIGltYWdlLCBvdGhlcndpc2UgaXQgd2lsbCBqdXN0IHBhc3MgdGhlIG9iamVjdCB0byB0aGUgdXBsb2FkIGFkYXB0ZXIuXG4qL1xuXG5GaWxlVXBsb2FkZXIucHJvdG90eXBlLnVwbG9hZCA9IGZ1bmN0aW9uKCB0YXJnZXQgKSB7IFxuXG4gICAgaWYgKCB0eXBlb2YgdGFyZ2V0LmZpbGVzICE9PSAnb2JqZWN0JyApIHsgLy8gZGVmYXVsdCB1cGxvYWQgZXZlbnRzIGFyZSBub3QgYSB0cnVlIGFycmF5XG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAndGFyZ2V0IHBhc3NlZCB0byBGaWxlVXBsb2FkZXI6OnVwbG9hZCBkb2VzIG5vdCBoYXZlIGZpbGVzIGFycmF5JyApICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiB0aGlzLnVwbG9hZEZuICE9PSAnZnVuY3Rpb24nICkge1xuICAgICAgICAvLyBlcnJvclxuICAgICAgICB0aGlzLmVtaXQoICdlcnJvcicsIG5ldyBFcnJvciggJ05vIHVwbG9hZCBmdW5jdGlvbiBhZGRlZCB1c2luZyBGaWxlVXBsb2FkZXI6OnVzZVRvVXBsb2FkJyApICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgX2V2ZW50ID0ge30sXG4gICAgICAgIGNsb3NlID0gdGhpcy5jbG9zZS5iaW5kKCB0aGlzICksXG4gICAgICAgIHVwbG9hZEZuID0gdGhpcy51cGxvYWRGbixcbiAgICAgICAgY2xvc2VPblVwbG9hZCA9IHRoaXMuZGVmYXVsdHMuY2xvc2VPblVwbG9hZCxcbiAgICAgICAgZXJyb3IgPSB0aGlzLmVtaXQuYmluZCggdGhpcywgJ2Vycm9yJyApO1xuXG4gICAgX2V2ZW50LmZpbGVzID0gdGFyZ2V0LmZpbGVzO1xuICAgIF9ldmVudC5vcmlnaW5hbEV2ZW50ID0gdGFyZ2V0O1xuXG4gICAgLy8gd2F5cyB0byBnaXZlIGZlZWRiYWNrIHRvIEZpbGVVcGxvYWRlclxuICAgIF9ldmVudC5kb25lID0gdGhpcy5lbWl0LmJpbmQoIHRoaXMsICdkb25lJyApO1xuICAgIF9ldmVudC5lcnJvciA9IGVycm9yO1xuXG4gICAgbmV3IFVwbG9hZEV2ZW50KCBfZXZlbnQsIGZ1bmN0aW9uKCBlcnIsIHVwbG9hZEV2ZW50ICkge1xuICAgICAgICBpZiAoIGVyciApIHtcbiAgICAgICAgICAgIGVycm9yKCBlcnIgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVwbG9hZEZuKCB1cGxvYWRFdmVudCB8fCBfZXZlbnQgKTtcbiAgICAgICAgaWYgKCBjbG9zZU9uVXBsb2FkICkgeyAvLyB0aGlzIHNob3VsZCBiZSBjaGFuZ2FibGVcbiAgICAgICAgICAgIGNsb3NlKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9IClcblxuXG59O1xuXG4vKlxuIyMjIEZpbGVVcGxvYWRlcjo6YWRkUGx1Z2luXG5cblRoaXMgd2lsbCBhZGQgYSBwbHVnaW4gdG8gdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIHBsdWdpbnMuIE1lYW5pbmcgdGhhdCBpdCB3aWxsIGFsc28gYWRkIHRoZSBwbHVnaW4gbmFtZSB0byB0aGUgbGlzdCBvZiBfdGFiYWJsZV8gcGx1Z2lucywgYW5kIHRhcmdldHMgdG8gb3BlbiB3aGVuIG9wZW5pbmcgdGhlIGBGaWxlVXBsb2FkZXJgLlxuXG5fX3BhcmFtc19fXG5cbi0gcGx1Z2luIHsgT2JqZWN0IH0gLSBBIGBQbHVnaW5gIG9iamVjdCB0aGF0IGhhcyBhIG51bWJlciBvZiBkaWZmZXJudCBhdHRyaWJ1dGVzIG9uIHRoZSBwbHVnaW4gdG8gYWxsb3cgdGhlIGBGaWxlVXBsb2FkZXJgIHRvIHJlYWQgYW5kIGludGVyYWN0IHdpdGggdGhlIHBsdWdpbi4gSWYgc29tZSByZXF1aXJlZCBtZXRob2RzIGFyZSBub3QgcHJvdmlkZWQgdGhlIHBsdWdpbiB3aWxsIG5vdCBiZSBhZGRlZCBhbmQgYW4gYGVycm9yYCBldmVudCB3aWxsIGJlIGVtaXR0ZWQgZnJvbSB0aGUgRmlsZVVwbG9hZGVyLlxuXG4tIG9wdGlvbnMgeyBPYmplY3QgfSAtIF9PcHRpb25hbF8gQSBvcHRpb25hbCBvYmplY3QgdGhhdCBjYW4gc3BlY2lmeSB0aGUgYmVoYXZpb3IgaW4gd2hpY2ggdGhlIGBGaWxlVXBsb2FkZXJgIGJlaGF2ZXMgd2l0aCBwbHVnaW4uIFxuICAtIG9wdGlvbnMubWVudUl0ZW0geyBCb29sZWFuIH0gLSBfT3B0aW9uYWxfIEEgZmxhZyB0byBzcGVjaWZ5IGlmIHRoZSBwbHVnaW4gc2hvdWxkIGJlIGxpbmtlZCB0byBpbiBhIGxpc3Qgb2YgcGx1Z2lucy5cblxuX19yZXR1cm5zX19cblxuLSBwbHVnaW4geyBPYmplY3QgfSAtIEEgY29weSBvZiB0aGUgYFBsdWdpbmAgb2JqZWN0IGJhY2sgd2l0aCB0aGUgYGlzQWRkZWRgIHByb3BlcnR5IHNldCB0byB0cnVlIGlmIHN1Y2Nlc3NmdWxsIGFkZGVkIHRvIHRoZSBgRmlsZVVwbG9hZGVyYFxuXG5gYGBqYXZhc2NyaXB0XG52YXIgZmlsZVVwbG9hZGVyID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICksXG4gICAgZm9vID0ge1xuICAgICAgICBvcGVuOiBmdW5jdGlvbigpe31cbiAgICB9LFxuICAgIGJhciA9IHtcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKXt9LFxuICAgICAgICB0ZWFyZG93bjogZnVuY3Rpb24oKXt9LFxuICAgICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICAgICAgICBuYW1lOiAnQmFyJ1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwbHVnaW5Gb28gPSBmaWxlVXBsb2FkZXIuYWRkUGx1Z2luKCBmb28gKSxcbiAgICBwbHVnaW5CYXIgPSBmaWxlVXBsb2FkZXIuYWRkUGx1Z2luKCBiYXIgKTtcblxucGx1Z2luRm9vLmlzQWRkZWQgLy8gZmFsc2UgLSBtaXNzaW5nIHNvbWUgcmVxdWlyZWQgbWV0aG9kc1xucGx1Z2luQmFyLmlzQWRkZWQgLy8gdHJ1ZVxuYGBgXG4qL1xuXG5GaWxlVXBsb2FkZXIucHJvdG90eXBlLmFkZFBsdWdpbiA9IGZ1bmN0aW9uKCBwbHVnaW4sIG9wdGlvbnMgKSB7XG4gICAgXG4gICAgdmFyIF9wbHVnaW4gPSBtZXJnZSggdHJ1ZSwge30sIHBsdWdpbiB8fCB7fSApO1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYgKCAhRmlsZVVwbG9hZGVyLmlzUGx1Z2luKCBwbHVnaW4gKSApe1xuICAgICAgICBfcGx1Z2luLmlzQWRkZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIF9wbHVnaW47XG4gICAgfSAgXG5cbiAgICB0aGlzLnBsdWdpbnNbIF9wbHVnaW4uYXR0cmlidXRlcy5uYW1lIF0gPSBfcGx1Z2luO1xuICAgIF9wbHVnaW4uaXNBZGRlZCA9IHRydWU7XG4gICAgcmV0dXJuIF9wbHVnaW47XG5cbn07XG5cbi8qXG4jIyMgRmlsZVVwbG9hZGVyOjp1c2VUb1VwbG9hZFxuXG5UaGlzIGlzIGEgd2F5IHRvIGV4dGVuZCB0aGUgZmlsZSB1cGxvYWRlciB0byBhbGxvdyBmb3IgY3VzdG9tIHdheXMgdG8gdXBsb2FkIGZpbGVzIHRvIHlvdXIgc2VydmVyLiBcblxuX19wYXJhbXNfX1xuXG4tIHVwbG9hZEZuIHsgRnVuY3Rpb24gfSAtIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIGV2ZXIgYW4gYXNzZXQgaXMgYXR0ZW1wdGVkIHRvIGJlIHVwbG9hZGVkLiBEdWUgdG8gdGhlIHBsdWdnYWJsaXR5IG9mIHRoaXMgbW9kYWwgdGhpcyBjYW4gYmUgYSBudW1iZXIgb2YgdGhpbmdzIGRlcGVuZGluZyBvbiB0aGUgbmF0dXJlIG9mIHRoZSBwbHVnaW4uIFRoaXMgY2FuIGFsc28gYmUgdXNlZCB0byBzYXZlIGluZm9ybWF0aW9uIHRvIHlvdSBkYXRhYmFzZSBhYm91dCB0aGUgZGF0YSBiZWluZyB1cGxvYWRlZC5cblxudXBsb2FkRm4gaXMgcGFzc2VkIGFuIFVwbG9hZEV2ZW50IG9iamVjdCB0aGF0IGhhcyBhIG51bWJlciBvZiBob29rcyB0aGF0IHlvdSBjYW4gdGllIHlvdXIgdXBsb2FkZXIgaW50byB0byBhbGxvdyBmb3IgYW4gaW50ZXJhY3RpdmUgZXhwZXJpZW5jZSB3aGlsZSB1cGxvYWRpbmcgcGhvdG9zLiBTZWUgYFVwbG9hZEV2ZW50YCBvYmplY3Qgc3BlY2lmaWNhdGlvbiB0byBzZWUgaG93IHRvIGhvb2sgaW50byB0aGlzIGZ1bmN0aW9uYWxpdHlcblxuYGBgamF2YXNjcmlwdFxudmFyIGZpbGVVcGxvYWRlciA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5maWxlVXBsb2FkZXIudXNlVG9VcGxvYWQoIGZ1bmN0aW9uKCA8VXBsb2FkRXZlbnQ+ICkge1xuICAgIHZhciBmaWxlcyA9IGV2ZW50LmZpbGVzOyAvLyB0aGlzIGlzIGNvbW1pdGluZyBmcm9tIGEgaW5wdXQgZmlsZSBldmVudFxuICAgIC8vIGJsYWggYmxhaCB1cGxvYWRcbiAgICBmZWVkYmFja0Zucy5kb25lKHtcbiAgICAgICAgZmlsZXNbeyB1cmw6ICdodHRwOi8vZm9vLmJhci9iYXoucG5nJyB9XVxuICAgIH0pXG59ICk7XG5gYGBcbiovXG5cbkZpbGVVcGxvYWRlci5wcm90b3R5cGUudXNlVG9VcGxvYWQgPSBmdW5jdGlvbiggZm4gKSB7XG4gICAgXG4gICAgaWYgKCB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIHRoaXMudXBsb2FkRm4gPSBmbjtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAndXNlVG9VcGxvYWQgbmVlZHMgdG8gYmUgcGFzc2VkIGEgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IHBhcmFtZXRlciwgJyArIHR5cGVvZiBmbiArICcgZ2l2ZW4uJyApICk7XG59O1xuXG5GaWxlVXBsb2FkZXIuaXNQbHVnaW4gPSBmdW5jdGlvbiggcGx1Z2luICkge1xuXG4gICAgaWYgKCAhcGx1Z2luIHx8IHR5cGVvZiBwbHVnaW4gIT09ICdvYmplY3QnICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgcGx1Z2luLm9wZW4gIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHBsdWdpbi50ZWFyZG93biAhPT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICggIXBsdWdpbi5hdHRyaWJ1dGVzICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgcGx1Z2luLmF0dHJpYnV0ZXMubmFtZSAhPT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkZpbGVVcGxvYWRlci5wbHVnaW5WaXNpYmxlID0gZnVuY3Rpb24oIHBsdWdpbiApIHtcbiAgICByZXR1cm4gIXBsdWdpbi5hdHRyaWJ1dGVzLmhpZGU7XG59O1xuXG5GaWxlVXBsb2FkZXIubWFwUGx1Z2lucyA9IGZ1bmN0aW9uKCBwbHVnaW5zICkge1xuICAgIHJldHVybiBmdW5jdGlvbiggcGx1Z2luTmFtZSApIHtcbiAgICAgICAgcmV0dXJuIHBsdWdpbnNbIHBsdWdpbk5hbWUgXTtcbiAgICB9XG59O1xuXG5GaWxlVXBsb2FkZXIucGx1Z2luTGlzdEVsID0gZnVuY3Rpb24oIHBsdWdpbiApIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGknICksXG4gICAgICAgIHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblxuICAgIC8vIGNvbnNpZGVyIHNvbWUgd2F5IHRvIHVzZSBpY29uc1xuICAgIHNwYW4uaW5uZXJUZXh0ID0gcGx1Z2luLmF0dHJpYnV0ZXMubmFtZTtcbiAgICAvLyBuZWVkIGEgd2F5IHRvIGJpbmQgZXZlbnRzXG4gICAgZWwuYXBwZW5kQ2hpbGQoIHNwYW4gKTtcblxuICAgIHJldHVybiBlbDtcbn07XG5cbkZpbGVVcGxvYWRlci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiggKSB7XG5cbiAgICAvLyB0aGlzLmVsIGlzIGJ1aWx0IGluIHRoZSBjb25zdHJ1Y3RvclxuICAgIHZhciBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50LmJpbmQoIGRvY3VtZW50LCAnZGl2JyApOyBcblxuICAgIHRoaXMudGFibGVFbCA9IGRpdigpO1xuICAgIHRoaXMuY2VsbEVsID0gZGl2KCk7XG4gICAgdGhpcy5tb2RhbEVsID0gZGl2KCk7XG4gICAgdGhpcy5jb250ZW50RWwgPSBkaXYoKTtcbiAgICB0aGlzLmxpc3RFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICd1bCcgKTtcbiAgICAvLyBjbGFzc2luZyBzdHJ1Y3R1cmVcbiAgICB0aGlzLmVsLmNsYXNzTGlzdC5hZGQoICdGaWxlVXBsb2FkZXItbW9kYWwtb3ZlcmxheScgKTtcbiAgICB0aGlzLnRhYmxlRWwuY2xhc3NMaXN0LmFkZCggJ0ZpbGVVcGxvYWRlci1tb2RhbC10YWJsZScgKTsgLy8gdGhpcyBpcyBoZXJlIHRvIGFsbG93IHZlcnRpY2FsIGNlbnRlcmluZ1xuICAgIHRoaXMuY2VsbEVsLmNsYXNzTGlzdC5hZGQoICdGaWxlVXBsb2FkZXItbW9kYWwtY2VsbCcgKTtcbiAgICB0aGlzLm1vZGFsRWwuY2xhc3NMaXN0LmFkZCggJ0ZpbGVVcGxvYWRlci1tb2RhbCcgKTtcbiAgICB0aGlzLmNvbnRlbnRFbC5jbGFzc0xpc3QuYWRkKCAnRmlsZVVwbG9hZGVyLW1vZGFsLWNvbnRlbnQnICk7XG4gICAgdGhpcy5saXN0RWwuY2xhc3NMaXN0LmFkZCggJ0ZpbGVVcGxvYWRlci1tb2RhbC1saXN0JyApO1xuICAgIC8vIGFkZGluZyB0aGVtIGFsbCB0b2dldGhlclxuICAgIHRoaXMuZWwuYXBwZW5kQ2hpbGQoIHRoaXMudGFibGVFbCApO1xuICAgIHRoaXMudGFibGVFbC5hcHBlbmRDaGlsZCggdGhpcy5jZWxsRWwgKTtcbiAgICB0aGlzLmNlbGxFbC5hcHBlbmRDaGlsZCggdGhpcy5tb2RhbEVsICk7XG4gICAgdGhpcy5tb2RhbEVsLmFwcGVuZENoaWxkKCB0aGlzLmxpc3RFbCApO1xuICAgIHRoaXMubW9kYWxFbC5hcHBlbmRDaGlsZCggdGhpcy5jb250ZW50RWwgKTtcblxuICAgIC8qIEhUTUwgcmVwZXNlbnRhdGlvblxuICAgIFxuICAgIDxkaXYgY2xhc3M9XCJGaWxlVXBsb2FkZXItbW9kYWwtb3ZlcmxheVwiID5cbiAgICAgICAgPGRpdiBjbGFzcz1cIkZpbGVVcGxvYWRlci1tb2RhbC10YWJsZVwiID5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJGaWxlVXBsb2FkZXItbW9kYWwtY2VsbFwiID5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiRmlsZVVwbG9hZGVyLW1vZGFsXCIgPlxuICAgICAgICAgICAgICAgICAgICA8dWwgY2xhc3M9XCJGaWxlVXBsb2FkZXItbW9kYWwtbGlzdFwiPjwvdWw+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJGaWxlVXBsb2FkZXItbW9kYWwtY29udGVudFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgKi9cblxuICAgIC8vIGF0dGFjaCBkZWZhdWx0IHBsdWdpblxuICAgIHRoaXMuYWRkUGx1Z2luKCB1cGxvYWRQbHVnaW4gKTtcbn07XG5cbkZpbGVVcGxvYWRlci5wcm90b3R5cGUuX2hhbmRsZVBsdWdpbk9wZW4gPSBmdW5jdGlvbiggb3B0aW9ucywgZXJyLCBlbCApIHtcblxuICAgIHZhciBkZWZhdWx0UGx1Z2luID0gdGhpcy5kZWZhdWx0cy5wbHVnaW4sXG4gICAgICAgIG9wZW5EZWZhdWx0ID0gdGhpcy5vcGVuLmJpbmQoIHRoaXMsIG1lcmdlKCBvcHRpb25zLCB7IFxuICAgICAgICAgICAgcGx1Z2luOiBkZWZhdWx0UGx1Z2luXG4gICAgICAgIH0gKSApO1xuXG4gICAgaWYgKCBlcnIgKSB7XG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgZXJyICk7XG4gICAgICAgIGlmICggb3B0aW9ucy5wbHVnaW4gIT09IGRlZmF1bHRQbHVnaW4gKSB7XG4gICAgICAgICAgICBvcGVuRGVmYXVsdCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmlubmVySFRNTCA9IGVsO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgZWwgPT09ICdvYmplY3QnICYmIGVsLnRhZ05hbWUgKSB7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmlubmVySFRNTCA9ICcnO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hcHBlbmRDaGlsZCggZWwgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG9wZW5EZWZhdWx0KCk7IC8vIGp1c3QgdHJ5IHRvIG9wZW4gZGVmYXVsdCB3aGVuIG5vIGNvbnRlbnQgaXMgZ2l2ZW5cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IEZpbGVVcGxvYWRlcigpO1xubW9kdWxlLmV4cG9ydHMuRmlsZVVwbG9hZGVyID0gRmlsZVVwbG9hZGVyO1xubW9kdWxlLmV4cG9ydHMuVXBsb2FkRXZlbnQgPSBVcGxvYWRFdmVudDtcbm1vZHVsZS5leHBvcnRzLmltYWdlVG9CbG9iID0gcmVxdWlyZSggJ2ltYWdlLXRvLWJsb2InICk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkICAgICAgICA9IHJlcXVpcmUoJ2QnKVxuICAsIGNhbGxhYmxlID0gcmVxdWlyZSgnZXM1LWV4dC9vYmplY3QvdmFsaWQtY2FsbGFibGUnKVxuXG4gICwgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHksIGNhbGwgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbFxuICAsIGNyZWF0ZSA9IE9iamVjdC5jcmVhdGUsIGRlZmluZVByb3BlcnR5ID0gT2JqZWN0LmRlZmluZVByb3BlcnR5XG4gICwgZGVmaW5lUHJvcGVydGllcyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzXG4gICwgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG4gICwgZGVzY3JpcHRvciA9IHsgY29uZmlndXJhYmxlOiB0cnVlLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUgfVxuXG4gICwgb24sIG9uY2UsIG9mZiwgZW1pdCwgbWV0aG9kcywgZGVzY3JpcHRvcnMsIGJhc2U7XG5cbm9uID0gZnVuY3Rpb24gKHR5cGUsIGxpc3RlbmVyKSB7XG5cdHZhciBkYXRhO1xuXG5cdGNhbGxhYmxlKGxpc3RlbmVyKTtcblxuXHRpZiAoIWhhc093blByb3BlcnR5LmNhbGwodGhpcywgJ19fZWVfXycpKSB7XG5cdFx0ZGF0YSA9IGRlc2NyaXB0b3IudmFsdWUgPSBjcmVhdGUobnVsbCk7XG5cdFx0ZGVmaW5lUHJvcGVydHkodGhpcywgJ19fZWVfXycsIGRlc2NyaXB0b3IpO1xuXHRcdGRlc2NyaXB0b3IudmFsdWUgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdGRhdGEgPSB0aGlzLl9fZWVfXztcblx0fVxuXHRpZiAoIWRhdGFbdHlwZV0pIGRhdGFbdHlwZV0gPSBsaXN0ZW5lcjtcblx0ZWxzZSBpZiAodHlwZW9mIGRhdGFbdHlwZV0gPT09ICdvYmplY3QnKSBkYXRhW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuXHRlbHNlIGRhdGFbdHlwZV0gPSBbZGF0YVt0eXBlXSwgbGlzdGVuZXJdO1xuXG5cdHJldHVybiB0aGlzO1xufTtcblxub25jZSA9IGZ1bmN0aW9uICh0eXBlLCBsaXN0ZW5lcikge1xuXHR2YXIgb25jZSwgc2VsZjtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cdHNlbGYgPSB0aGlzO1xuXHRvbi5jYWxsKHRoaXMsIHR5cGUsIG9uY2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0b2ZmLmNhbGwoc2VsZiwgdHlwZSwgb25jZSk7XG5cdFx0YXBwbHkuY2FsbChsaXN0ZW5lciwgdGhpcywgYXJndW1lbnRzKTtcblx0fSk7XG5cblx0b25jZS5fX2VlT25jZUxpc3RlbmVyX18gPSBsaXN0ZW5lcjtcblx0cmV0dXJuIHRoaXM7XG59O1xuXG5vZmYgPSBmdW5jdGlvbiAodHlwZSwgbGlzdGVuZXIpIHtcblx0dmFyIGRhdGEsIGxpc3RlbmVycywgY2FuZGlkYXRlLCBpO1xuXG5cdGNhbGxhYmxlKGxpc3RlbmVyKTtcblxuXHRpZiAoIWhhc093blByb3BlcnR5LmNhbGwodGhpcywgJ19fZWVfXycpKSByZXR1cm4gdGhpcztcblx0ZGF0YSA9IHRoaXMuX19lZV9fO1xuXHRpZiAoIWRhdGFbdHlwZV0pIHJldHVybiB0aGlzO1xuXHRsaXN0ZW5lcnMgPSBkYXRhW3R5cGVdO1xuXG5cdGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnb2JqZWN0Jykge1xuXHRcdGZvciAoaSA9IDA7IChjYW5kaWRhdGUgPSBsaXN0ZW5lcnNbaV0pOyArK2kpIHtcblx0XHRcdGlmICgoY2FuZGlkYXRlID09PSBsaXN0ZW5lcikgfHxcblx0XHRcdFx0XHQoY2FuZGlkYXRlLl9fZWVPbmNlTGlzdGVuZXJfXyA9PT0gbGlzdGVuZXIpKSB7XG5cdFx0XHRcdGlmIChsaXN0ZW5lcnMubGVuZ3RoID09PSAyKSBkYXRhW3R5cGVdID0gbGlzdGVuZXJzW2kgPyAwIDogMV07XG5cdFx0XHRcdGVsc2UgbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0aWYgKChsaXN0ZW5lcnMgPT09IGxpc3RlbmVyKSB8fFxuXHRcdFx0XHQobGlzdGVuZXJzLl9fZWVPbmNlTGlzdGVuZXJfXyA9PT0gbGlzdGVuZXIpKSB7XG5cdFx0XHRkZWxldGUgZGF0YVt0eXBlXTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdGhpcztcbn07XG5cbmVtaXQgPSBmdW5jdGlvbiAodHlwZSkge1xuXHR2YXIgaSwgbCwgbGlzdGVuZXIsIGxpc3RlbmVycywgYXJncztcblxuXHRpZiAoIWhhc093blByb3BlcnR5LmNhbGwodGhpcywgJ19fZWVfXycpKSByZXR1cm47XG5cdGxpc3RlbmVycyA9IHRoaXMuX19lZV9fW3R5cGVdO1xuXHRpZiAoIWxpc3RlbmVycykgcmV0dXJuO1xuXG5cdGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnb2JqZWN0Jykge1xuXHRcdGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuXHRcdGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuXHRcdGZvciAoaSA9IDE7IGkgPCBsOyArK2kpIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG5cdFx0bGlzdGVuZXJzID0gbGlzdGVuZXJzLnNsaWNlKCk7XG5cdFx0Zm9yIChpID0gMDsgKGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldKTsgKytpKSB7XG5cdFx0XHRhcHBseS5jYWxsKGxpc3RlbmVyLCB0aGlzLCBhcmdzKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0Y2FzZSAxOlxuXHRcdFx0Y2FsbC5jYWxsKGxpc3RlbmVycywgdGhpcyk7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlIDI6XG5cdFx0XHRjYWxsLmNhbGwobGlzdGVuZXJzLCB0aGlzLCBhcmd1bWVudHNbMV0pO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAzOlxuXHRcdFx0Y2FsbC5jYWxsKGxpc3RlbmVycywgdGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuXHRcdFx0YnJlYWs7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuXHRcdFx0YXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG5cdFx0XHRmb3IgKGkgPSAxOyBpIDwgbDsgKytpKSB7XG5cdFx0XHRcdGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXHRcdFx0fVxuXHRcdFx0YXBwbHkuY2FsbChsaXN0ZW5lcnMsIHRoaXMsIGFyZ3MpO1xuXHRcdH1cblx0fVxufTtcblxubWV0aG9kcyA9IHtcblx0b246IG9uLFxuXHRvbmNlOiBvbmNlLFxuXHRvZmY6IG9mZixcblx0ZW1pdDogZW1pdFxufTtcblxuZGVzY3JpcHRvcnMgPSB7XG5cdG9uOiBkKG9uKSxcblx0b25jZTogZChvbmNlKSxcblx0b2ZmOiBkKG9mZiksXG5cdGVtaXQ6IGQoZW1pdClcbn07XG5cbmJhc2UgPSBkZWZpbmVQcm9wZXJ0aWVzKHt9LCBkZXNjcmlwdG9ycyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IGZ1bmN0aW9uIChvKSB7XG5cdHJldHVybiAobyA9PSBudWxsKSA/IGNyZWF0ZShiYXNlKSA6IGRlZmluZVByb3BlcnRpZXMoT2JqZWN0KG8pLCBkZXNjcmlwdG9ycyk7XG59O1xuZXhwb3J0cy5tZXRob2RzID0gbWV0aG9kcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGFzc2lnbiAgICAgICAgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9hc3NpZ24nKVxuICAsIG5vcm1hbGl6ZU9wdHMgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9ub3JtYWxpemUtb3B0aW9ucycpXG4gICwgaXNDYWxsYWJsZSAgICA9IHJlcXVpcmUoJ2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlJylcbiAgLCBjb250YWlucyAgICAgID0gcmVxdWlyZSgnZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucycpXG5cbiAgLCBkO1xuXG5kID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZHNjciwgdmFsdWUvKiwgb3B0aW9ucyovKSB7XG5cdHZhciBjLCBlLCB3LCBvcHRpb25zLCBkZXNjO1xuXHRpZiAoKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB8fCAodHlwZW9mIGRzY3IgIT09ICdzdHJpbmcnKSkge1xuXHRcdG9wdGlvbnMgPSB2YWx1ZTtcblx0XHR2YWx1ZSA9IGRzY3I7XG5cdFx0ZHNjciA9IG51bGw7XG5cdH0gZWxzZSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1syXTtcblx0fVxuXHRpZiAoZHNjciA9PSBudWxsKSB7XG5cdFx0YyA9IHcgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdFx0dyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ3cnKTtcblx0fVxuXG5cdGRlc2MgPSB7IHZhbHVlOiB2YWx1ZSwgY29uZmlndXJhYmxlOiBjLCBlbnVtZXJhYmxlOiBlLCB3cml0YWJsZTogdyB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcblxuZC5ncyA9IGZ1bmN0aW9uIChkc2NyLCBnZXQsIHNldC8qLCBvcHRpb25zKi8pIHtcblx0dmFyIGMsIGUsIG9wdGlvbnMsIGRlc2M7XG5cdGlmICh0eXBlb2YgZHNjciAhPT0gJ3N0cmluZycpIHtcblx0XHRvcHRpb25zID0gc2V0O1xuXHRcdHNldCA9IGdldDtcblx0XHRnZXQgPSBkc2NyO1xuXHRcdGRzY3IgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbM107XG5cdH1cblx0aWYgKGdldCA9PSBudWxsKSB7XG5cdFx0Z2V0ID0gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKCFpc0NhbGxhYmxlKGdldCkpIHtcblx0XHRvcHRpb25zID0gZ2V0O1xuXHRcdGdldCA9IHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmIChzZXQgPT0gbnVsbCkge1xuXHRcdHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICghaXNDYWxsYWJsZShzZXQpKSB7XG5cdFx0b3B0aW9ucyA9IHNldDtcblx0XHRzZXQgPSB1bmRlZmluZWQ7XG5cdH1cblx0aWYgKGRzY3IgPT0gbnVsbCkge1xuXHRcdGMgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdH1cblxuXHRkZXNjID0geyBnZXQ6IGdldCwgc2V0OiBzZXQsIGNvbmZpZ3VyYWJsZTogYywgZW51bWVyYWJsZTogZSB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2lzLWltcGxlbWVudGVkJykoKVxuXHQ/IE9iamVjdC5hc3NpZ25cblx0OiByZXF1aXJlKCcuL3NoaW0nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBhc3NpZ24gPSBPYmplY3QuYXNzaWduLCBvYmo7XG5cdGlmICh0eXBlb2YgYXNzaWduICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG5cdG9iaiA9IHsgZm9vOiAncmF6JyB9O1xuXHRhc3NpZ24ob2JqLCB7IGJhcjogJ2R3YScgfSwgeyB0cnp5OiAndHJ6eScgfSk7XG5cdHJldHVybiAob2JqLmZvbyArIG9iai5iYXIgKyBvYmoudHJ6eSkgPT09ICdyYXpkd2F0cnp5Jztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBrZXlzICA9IHJlcXVpcmUoJy4uL2tleXMnKVxuICAsIHZhbHVlID0gcmVxdWlyZSgnLi4vdmFsaWQtdmFsdWUnKVxuXG4gICwgbWF4ID0gTWF0aC5tYXg7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRlc3QsIHNyYy8qLCDigKZzcmNuKi8pIHtcblx0dmFyIGVycm9yLCBpLCBsID0gbWF4KGFyZ3VtZW50cy5sZW5ndGgsIDIpLCBhc3NpZ247XG5cdGRlc3QgPSBPYmplY3QodmFsdWUoZGVzdCkpO1xuXHRhc3NpZ24gPSBmdW5jdGlvbiAoa2V5KSB7XG5cdFx0dHJ5IHsgZGVzdFtrZXldID0gc3JjW2tleV07IH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmICghZXJyb3IpIGVycm9yID0gZTtcblx0XHR9XG5cdH07XG5cdGZvciAoaSA9IDE7IGkgPCBsOyArK2kpIHtcblx0XHRzcmMgPSBhcmd1bWVudHNbaV07XG5cdFx0a2V5cyhzcmMpLmZvckVhY2goYXNzaWduKTtcblx0fVxuXHRpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkgdGhyb3cgZXJyb3I7XG5cdHJldHVybiBkZXN0O1xufTtcbiIsIi8vIERlcHJlY2F0ZWRcblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7IH07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9pcy1pbXBsZW1lbnRlZCcpKClcblx0PyBPYmplY3Qua2V5c1xuXHQ6IHJlcXVpcmUoJy4vc2hpbScpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcblx0dHJ5IHtcblx0XHRPYmplY3Qua2V5cygncHJpbWl0aXZlJyk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gY2F0Y2ggKGUpIHsgcmV0dXJuIGZhbHNlOyB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIga2V5cyA9IE9iamVjdC5rZXlzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcblx0cmV0dXJuIGtleXMob2JqZWN0ID09IG51bGwgPyBvYmplY3QgOiBPYmplY3Qob2JqZWN0KSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXNzaWduID0gcmVxdWlyZSgnLi9hc3NpZ24nKVxuXG4gICwgZm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoXG4gICwgY3JlYXRlID0gT2JqZWN0LmNyZWF0ZSwgZ2V0UHJvdG90eXBlT2YgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2ZcblxuICAsIHByb2Nlc3M7XG5cbnByb2Nlc3MgPSBmdW5jdGlvbiAoc3JjLCBvYmopIHtcblx0dmFyIHByb3RvID0gZ2V0UHJvdG90eXBlT2Yoc3JjKTtcblx0cmV0dXJuIGFzc2lnbihwcm90byA/IHByb2Nlc3MocHJvdG8sIG9iaikgOiBvYmosIHNyYyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zLyosIOKApm9wdGlvbnMqLykge1xuXHR2YXIgcmVzdWx0ID0gY3JlYXRlKG51bGwpO1xuXHRmb3JFYWNoLmNhbGwoYXJndW1lbnRzLCBmdW5jdGlvbiAob3B0aW9ucykge1xuXHRcdGlmIChvcHRpb25zID09IG51bGwpIHJldHVybjtcblx0XHRwcm9jZXNzKE9iamVjdChvcHRpb25zKSwgcmVzdWx0KTtcblx0fSk7XG5cdHJldHVybiByZXN1bHQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuXHRpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBuZXcgVHlwZUVycm9yKGZuICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG5cdHJldHVybiBmbjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHZhbHVlKSB7XG5cdGlmICh2YWx1ZSA9PSBudWxsKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSBudWxsIG9yIHVuZGVmaW5lZFwiKTtcblx0cmV0dXJuIHZhbHVlO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2lzLWltcGxlbWVudGVkJykoKVxuXHQ/IFN0cmluZy5wcm90b3R5cGUuY29udGFpbnNcblx0OiByZXF1aXJlKCcuL3NoaW0nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0ciA9ICdyYXpkd2F0cnp5JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdGlmICh0eXBlb2Ygc3RyLmNvbnRhaW5zICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG5cdHJldHVybiAoKHN0ci5jb250YWlucygnZHdhJykgPT09IHRydWUpICYmIChzdHIuY29udGFpbnMoJ2ZvbycpID09PSBmYWxzZSkpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGluZGV4T2YgPSBTdHJpbmcucHJvdG90eXBlLmluZGV4T2Y7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHNlYXJjaFN0cmluZy8qLCBwb3NpdGlvbiovKSB7XG5cdHJldHVybiBpbmRleE9mLmNhbGwodGhpcywgc2VhcmNoU3RyaW5nLCBhcmd1bWVudHNbMV0pID4gLTE7XG59O1xuIiwiXG4vKiBnbG9iYWwgdW5lc2NhcGUgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1hZ2VUb1VyaSA9IHJlcXVpcmUoICdpbWFnZS10by1kYXRhLXVyaScgKTtcblxuLypcbiMjIEltYWdlIHRvIGJsb2Jcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbkNvbnZlcnRzIHJlbW90ZSBpbWFnZSB1cmxzIHRvIGJsb2JzIHZpYSBjYW52YXMuIFxuXG5gYGBqYXZhc2NyaXB0XG52YXIgaW1hZ2VUb0Jsb2IgPSByZXF1aXJlKCAnaW1hZ2UtdG8tYmxvYicgKTtcblxuaW1hZ2VUb0Jsb2IoICdodHRwOi8vZm9vLmJhci9iYXoucG5nJywgZnVuY3Rpb24oIGVyciwgdXJpICkgeyBcbiAgICBjb25zb2xlLmxvZyggdXJpICk7IFxufSApO1xuaW1hZ2VUb0Jsb2IoIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCAnaW1nJyApWyAwIF0sIGZ1bmN0aW9uKCBlcnIsIHVyaSApIHsgXG4gICAgY29uc29sZS5sb2coIHVyaSApOyBcbn0gKTtcbmBgYFxuKi9cblxudmFyIHR5cGVzID0ge1xuICAgICdwbmcnOiAnaW1hZ2UvcG5nJyxcbiAgICAnanBnJzogJ2ltYWdlL2pwZWcnLFxuICAgICdqcGVnJzogJ2ltYWdlL2pwZWcnLFxuICAgICdzdmcnOiAnaW1hZ2Uvc3ZnK3htbCcgLy8gdGhpcyBnZXRzIGNvbnZlcnRlZCB0byBwbmdcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW1hZ2VUb0Jsb2I7XG5tb2R1bGUuZXhwb3J0cy5kYXRhVVJJdG9CbG9iID0gZGF0YVVSSXRvQmxvYjtcbm1vZHVsZS5leHBvcnRzLl9oYW5kbGVJbWFnZVRvVVJJID0gaGFuZGxlSW1hZ2VUb1VSSTtcbm1vZHVsZS5leHBvcnRzLmdldE1pbWVUeXBlRnJvbVVybCA9IGdldFR5cGU7XG5cbi8qXG4gICAgaW1hZ2VUb0Jsb2IgLSBtYWluIGZ1bmN0aW9uIHRoYXQgZ2V0cyBleHBvc2VkLCBjb252ZXJ0cyBlaXRoZXIgZG9tIG5vZGUgb3IgdXJsIG9mIGltYWdlIGludG8gYmxvYiBkYXRhXG5cbiAgICBwYXJhbXNcbiAgICAgICAgaW1nIHsgT2JqZWN0IHwgU3RyaW5nIH0gLSBlaXRoZXIgY2FuIGJlIGFuIElNRyBET00gbm9kZSBvciBhIHVybCBzdHJpbmcgdGhhdCB3aWxsIGxvYWQgdGhlIGltYWdlXG4gICAgICAgIG9wdGlvbnMgeyBPYmplY3QgfSAtIG9wdGlvbmFsLCBhIHNldCBvZiBvcHRpb25zIHRoYXQgeW91IGNhbiBwYXNzIHRvIHRoZSBpbWFnZXRvYmxvYiB0byBjaGFuZ2UgdGhlIGJlaGF2aW9yXG4gICAgICAgIGNhbGxiYWNrIHsgRnVuY3Rpb24gfSAtIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBjb252ZXJzaW9uIGlzIGNvbXBsZXRlZC4gVGhlIGNhbGxiYWNrIHdpbGwgZ2V0IHBhc3NlZCBhbiBlcnJvciAoIGlmIG9uZSBvY2N1cmVzICkgYW5kIHRoZSBibG9iLlxuXG4qL1xuXG5mdW5jdGlvbiBpbWFnZVRvQmxvYiggaW1nLCBvcHRpb25zLCBjYWxsYmFjayApIHtcbiAgICBcbiAgICB2YXIgc3JjO1xuXG4gICAgaWYgKCB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICBpZiAoICFpbWcgKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayggbmV3IEVycm9yKCAnUGFzcyBpbiBhIElNRyBET00gbm9kZSBvciBhIHVybCBhcyBmaXJzdCBwYXJhbScgKSApO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIGltZyA9PT0gJ29iamVjdCcgJiYgaW1nLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2ltZycgKSB7XG4gICAgICAgIHNyYyA9IGltZy5zcmM7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgaW1nID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgc3JjID0gaW1nO1xuICAgIH1cblxuICAgIGlmICggL15kYXRhOi8udGVzdCggc3JjICkgKSB7IC8vIGNoZWNrIHRvIHNlZSBpZiBpdHMgYSBkYXRhIHVyaVxuICAgICAgICBjYWxsYmFjayggbnVsbCwgZGF0YVVSSXRvQmxvYiggc3JjICkgKTsgLy8gc2NyaXB0IHRvIGRhdGF1cmkgY29udmVyc2lvblxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgb3B0aW9ucy50eXBlID0gdHlwZXNbIG9wdGlvbnMudHlwZSBdIHx8IGdldFR5cGUoIHNyYyApO1xuICAgIG9wdGlvbnMuc3JjID0gc3JjO1xuICAgIG9wdGlvbnMuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICBpZiAoICFvcHRpb25zLnR5cGUgKSB7XG5cbiAgICAgICAgY2FsbGJhY2soIG5ldyBFcnJvciggJ0ltYWdlIHR5cGUgaXMgbm90IHN1cHBvcnRlZCcgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaW1hZ2VUb1VyaSggc3JjLCBvcHRpb25zLnR5cGUsIGhhbmRsZUltYWdlVG9VUkkuYmluZCggbnVsbCwgb3B0aW9ucyApICk7IC8vIGF0dGVtcHQgaWYgd2UgaGF2ZSBhIFxufVxuXG4vKlxuICAgIGRhdGFVUkl0b0Jsb2IgLSB0YWtlcyBhIGRhdGF1cmkgYW5kIGNvbnZlcnRzIGl0IGludG8gYSBibG9iXG5cbiAgICBwYXJhbXNcbiAgICAgICAgdXJpIHsgU3RyaW5nIH0gLSBhIHZhbGlkIGRhdGF1cmlcblxuICAgIHJldHVybnNcbiAgICAgICAgYmxvYiB7IEJsb2IgT2JqZWN0IH0gLSBnZW5lcmF0ZWQgYmxvYiBvYmplY3RcblxuKi9cblxuXG5mdW5jdGlvbiBkYXRhVVJJdG9CbG9iKCB1cmkgKSB7XG4gICAgLy8gY29udmVydCBiYXNlNjQvVVJMRW5jb2RlZCBkYXRhIGNvbXBvbmVudCB0byByYXcgYmluYXJ5IGRhdGEgaGVsZCBpbiBhIHN0cmluZ1xuICAgIHZhciBieXRlU3RyaW5nLFxuICAgICAgICBtaW1lU3RyaW5nLFxuICAgICAgICBpYTtcblxuICAgIGlmICggdXJpLnNwbGl0KCAnLCcgKVswXS5pbmRleE9mKCAnYmFzZTY0JyApID49IDAgKSB7XG5cbiAgICAgICAgYnl0ZVN0cmluZyA9IGF0b2IoIHVyaS5zcGxpdCgnLCcpWzFdICk7XG4gICAgfVxuICAgIGVsc2Uge1xuXG4gICAgICAgIGJ5dGVTdHJpbmcgPSB1bmVzY2FwZSggdXJpLnNwbGl0KCcsJylbMV0gKTtcbiAgICB9XG5cbiAgICAvLyBzZXBhcmF0ZSBvdXQgdGhlIG1pbWUgY29tcG9uZW50XG4gICAgbWltZVN0cmluZyA9IHVyaS5zcGxpdCggJywnIClbIDAgXS5zcGxpdCggJzonIClbIDEgXS5zcGxpdCggJzsnIClbIDAgXTtcblxuICAgIC8vIHdyaXRlIHRoZSBieXRlcyBvZiB0aGUgc3RyaW5nIHRvIGEgdHlwZWQgYXJyYXlcbiAgICBpYSA9IG5ldyBVaW50OEFycmF5KCBieXRlU3RyaW5nLmxlbmd0aCApO1xuXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgYnl0ZVN0cmluZy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgXG4gICAgICAgIGlhWyBpIF0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoIGkgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJsb2IoIFsgaWEgXSwge1xuICAgICAgICB0eXBlOiBtaW1lU3RyaW5nXG4gICAgfSApO1xufVxuXG4vKlxuICAgIGhhbmRsZUltYWdlVG9VUkkgLSBoYW5kbGVzIGEgY2FsbGJhY2sgZnJvbSBpbWFnZVRvVVJJIGFuZCBnbHVlcyB0b2dldGhlciBkYXRhVVJJdG9CbG9iXG5cbiAgICBwYXJhbXNcbiAgICAgICAgb3B0aW9ucyB7IE9iamVjdCB9IC0gdGhlIG9wdGlvbnMgb2JqZWN0IHBhc3NlZCB0byB0aGUgbWFpbiBmbiB3aXRoIHRoZSBjYWxsYmFjayBhdHRhY2hlZCB0byBpdFxuICAgICAgICBlcnIgeyBFcnJvciBPYmplY3QgfSAtIGFuIGVycm9yIGlmIG9uZSBvY2N1cnMgaW4gdGhlIGltYWdlVG9VUkkgbWV0aG9kIFxuICAgICAgICB1cmkgeyBTdHJpbmcgfSAtIGEgdmFsaWQgZGF0YSB1cmxcblxuKi9cblxuZnVuY3Rpb24gaGFuZGxlSW1hZ2VUb1VSSSggb3B0aW9ucywgZXJyLCB1cmkgKSB7XG5cbiAgICBpZiAoIGVyciApIHtcbiAgICAgICAgb3B0aW9ucy5jYWxsYmFjayggZXJyICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvcHRpb25zLmNhbGxiYWNrKCBudWxsLCBkYXRhVVJJdG9CbG9iKCB1cmkgKSApO1xuXG59XG5cbi8qXG4gICAgZ2V0VHlwZSAtIHNtYWxsIHV0aWwgdG8gZ2V0IHR5cGUgZnJvbSB1cmwgaWYgb25lIGlzIHByZXNlbnQgaW4gdHlwZXMgbGlzdFxuXG4gICAgcGFyYW1zXG4gICAgICAgIHVybCB7IFN0cmluZyB9IC0gYSB1cmwgdG8gcGFyc2UgdGhlIGZpbGUgZXh0ZW5zaW9uIGZyb21cblxuICAgIHJldHVybnNcbiAgICAgICAgdHlwZSB7IFN0cmluZyB9IC0gYSBtaW1lIHR5cGUgaWYgdHlwZSBpcyBzdXBwb3J0ZWQsIGlmIG5vdCB1bmRlZmluZWQgaXMgcmV0dXJuZWRcblxuKi9cblxuZnVuY3Rpb24gZ2V0VHlwZSggdXJsICkge1xuICAgIHJldHVybiB1cmwgPyB0eXBlc1sgdXJsLnNwbGl0KCAnPycgKS5zaGlmdCggKS5zcGxpdCggJy4nICkucG9wKCApIF0gOiBudWxsIDtcbn1cbiIsIi8vIGNvbnZlcnRzIGEgVVJMIG9mIGFuIGltYWdlIGludG8gYSBkYXRhVVJJXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh1cmwsIG1pbWVUeXBlLCBjYikge1xuICAgIC8vIENyZWF0ZSBhbiBlbXB0eSBjYW52YXMgYW5kIGltYWdlIGVsZW1lbnRzXG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpLFxuICAgICAgICBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcblxuICAgIGlmICggdHlwZW9mIG1pbWVUeXBlID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICBjYiA9IG1pbWVUeXBlO1xuICAgICAgICBtaW1lVHlwZSA9IG51bGw7XG4gICAgfVxuXG4gICAgbWltZVR5cGUgPSBtaW1lVHlwZSB8fCAnaW1hZ2UvcG5nJztcblxuICAgIC8vIGFsbG93IGZvciBjcm9zcyBvcmlnaW4gdGhhdCBoYXMgY29ycmVjdCBoZWFkZXJzXG4gICAgaW1nLmNyb3NzT3JpZ2luID0gXCJBbm9ueW1vdXNcIjsgXG5cbiAgICBpbWcub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIC8vIG1hdGNoIHNpemUgb2YgaW1hZ2VcbiAgICAgICAgY2FudmFzLndpZHRoID0gaW1nLndpZHRoO1xuICAgICAgICBjYW52YXMuaGVpZ2h0ID0gaW1nLmhlaWdodDtcblxuICAgICAgICAvLyBDb3B5IHRoZSBpbWFnZSBjb250ZW50cyB0byB0aGUgY2FudmFzXG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoaW1nLCAwLCAwKTtcblxuICAgICAgICAvLyBHZXQgdGhlIGRhdGEtVVJJIGZvcm1hdHRlZCBpbWFnZVxuICAgICAgICBjYiggbnVsbCwgY2FudmFzLnRvRGF0YVVSTCggbWltZVR5cGUgKSApO1xuICAgIH07XG5cbiAgICBpbWcub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2IobmV3IEVycm9yKCdGYWlsZWRUb0xvYWRJbWFnZScpKTtcbiAgICB9O1xuXG4gICAgLy8gY2FudmFzIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICBpZiAoIWNhbnZhcy5nZXRDb250ZXh0KSB7XG4gICAgICAgIGNiKG5ldyBFcnJvcignQ2FudmFzSXNOb3RTdXBwb3J0ZWQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW1nLnNyYyA9IHVybDtcbiAgICB9XG59O1xuIiwiLyohXHJcbiAqIEBuYW1lIEphdmFTY3JpcHQvTm9kZUpTIE1lcmdlIHYxLjIuMFxyXG4gKiBAYXV0aG9yIHllaWtvc1xyXG4gKiBAcmVwb3NpdG9yeSBodHRwczovL2dpdGh1Yi5jb20veWVpa29zL2pzLm1lcmdlXHJcblxyXG4gKiBDb3B5cmlnaHQgMjAxNCB5ZWlrb3MgLSBNSVQgbGljZW5zZVxyXG4gKiBodHRwczovL3Jhdy5naXRodWIuY29tL3llaWtvcy9qcy5tZXJnZS9tYXN0ZXIvTElDRU5TRVxyXG4gKi9cclxuXHJcbjsoZnVuY3Rpb24oaXNOb2RlKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIG9uZSBvciBtb3JlIG9iamVjdHMgXHJcblx0ICogQHBhcmFtIGJvb2w/IGNsb25lXHJcblx0ICogQHBhcmFtIG1peGVkLC4uLiBhcmd1bWVudHNcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHR2YXIgUHVibGljID0gZnVuY3Rpb24oY2xvbmUpIHtcclxuXHJcblx0XHRyZXR1cm4gbWVyZ2UoY2xvbmUgPT09IHRydWUsIGZhbHNlLCBhcmd1bWVudHMpO1xyXG5cclxuXHR9LCBwdWJsaWNOYW1lID0gJ21lcmdlJztcclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9yIG1vcmUgb2JqZWN0cyByZWN1cnNpdmVseSBcclxuXHQgKiBAcGFyYW0gYm9vbD8gY2xvbmVcclxuXHQgKiBAcGFyYW0gbWl4ZWQsLi4uIGFyZ3VtZW50c1xyXG5cdCAqIEByZXR1cm4gb2JqZWN0XHJcblx0ICovXHJcblxyXG5cdFB1YmxpYy5yZWN1cnNpdmUgPSBmdW5jdGlvbihjbG9uZSkge1xyXG5cclxuXHRcdHJldHVybiBtZXJnZShjbG9uZSA9PT0gdHJ1ZSwgdHJ1ZSwgYXJndW1lbnRzKTtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2xvbmUgdGhlIGlucHV0IHJlbW92aW5nIGFueSByZWZlcmVuY2VcclxuXHQgKiBAcGFyYW0gbWl4ZWQgaW5wdXRcclxuXHQgKiBAcmV0dXJuIG1peGVkXHJcblx0ICovXHJcblxyXG5cdFB1YmxpYy5jbG9uZSA9IGZ1bmN0aW9uKGlucHV0KSB7XHJcblxyXG5cdFx0dmFyIG91dHB1dCA9IGlucHV0LFxyXG5cdFx0XHR0eXBlID0gdHlwZU9mKGlucHV0KSxcclxuXHRcdFx0aW5kZXgsIHNpemU7XHJcblxyXG5cdFx0aWYgKHR5cGUgPT09ICdhcnJheScpIHtcclxuXHJcblx0XHRcdG91dHB1dCA9IFtdO1xyXG5cdFx0XHRzaXplID0gaW5wdXQubGVuZ3RoO1xyXG5cclxuXHRcdFx0Zm9yIChpbmRleD0wO2luZGV4PHNpemU7KytpbmRleClcclxuXHJcblx0XHRcdFx0b3V0cHV0W2luZGV4XSA9IFB1YmxpYy5jbG9uZShpbnB1dFtpbmRleF0pO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpIHtcclxuXHJcblx0XHRcdG91dHB1dCA9IHt9O1xyXG5cclxuXHRcdFx0Zm9yIChpbmRleCBpbiBpbnB1dClcclxuXHJcblx0XHRcdFx0b3V0cHV0W2luZGV4XSA9IFB1YmxpYy5jbG9uZShpbnB1dFtpbmRleF0pO1xyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gb3V0cHV0O1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSB0d28gb2JqZWN0cyByZWN1cnNpdmVseVxyXG5cdCAqIEBwYXJhbSBtaXhlZCBpbnB1dFxyXG5cdCAqIEBwYXJhbSBtaXhlZCBleHRlbmRcclxuXHQgKiBAcmV0dXJuIG1peGVkXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIG1lcmdlX3JlY3Vyc2l2ZShiYXNlLCBleHRlbmQpIHtcclxuXHJcblx0XHRpZiAodHlwZU9mKGJhc2UpICE9PSAnb2JqZWN0JylcclxuXHJcblx0XHRcdHJldHVybiBleHRlbmQ7XHJcblxyXG5cdFx0Zm9yICh2YXIga2V5IGluIGV4dGVuZCkge1xyXG5cclxuXHRcdFx0aWYgKHR5cGVPZihiYXNlW2tleV0pID09PSAnb2JqZWN0JyAmJiB0eXBlT2YoZXh0ZW5kW2tleV0pID09PSAnb2JqZWN0Jykge1xyXG5cclxuXHRcdFx0XHRiYXNlW2tleV0gPSBtZXJnZV9yZWN1cnNpdmUoYmFzZVtrZXldLCBleHRlbmRba2V5XSk7XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRiYXNlW2tleV0gPSBleHRlbmRba2V5XTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGJhc2U7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9yIG1vcmUgb2JqZWN0c1xyXG5cdCAqIEBwYXJhbSBib29sIGNsb25lXHJcblx0ICogQHBhcmFtIGJvb2wgcmVjdXJzaXZlXHJcblx0ICogQHBhcmFtIGFycmF5IGFyZ3ZcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiBtZXJnZShjbG9uZSwgcmVjdXJzaXZlLCBhcmd2KSB7XHJcblxyXG5cdFx0dmFyIHJlc3VsdCA9IGFyZ3ZbMF0sXHJcblx0XHRcdHNpemUgPSBhcmd2Lmxlbmd0aDtcclxuXHJcblx0XHRpZiAoY2xvbmUgfHwgdHlwZU9mKHJlc3VsdCkgIT09ICdvYmplY3QnKVxyXG5cclxuXHRcdFx0cmVzdWx0ID0ge307XHJcblxyXG5cdFx0Zm9yICh2YXIgaW5kZXg9MDtpbmRleDxzaXplOysraW5kZXgpIHtcclxuXHJcblx0XHRcdHZhciBpdGVtID0gYXJndltpbmRleF0sXHJcblxyXG5cdFx0XHRcdHR5cGUgPSB0eXBlT2YoaXRlbSk7XHJcblxyXG5cdFx0XHRpZiAodHlwZSAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIga2V5IGluIGl0ZW0pIHtcclxuXHJcblx0XHRcdFx0dmFyIHNpdGVtID0gY2xvbmUgPyBQdWJsaWMuY2xvbmUoaXRlbVtrZXldKSA6IGl0ZW1ba2V5XTtcclxuXHJcblx0XHRcdFx0aWYgKHJlY3Vyc2l2ZSkge1xyXG5cclxuXHRcdFx0XHRcdHJlc3VsdFtrZXldID0gbWVyZ2VfcmVjdXJzaXZlKHJlc3VsdFtrZXldLCBzaXRlbSk7XHJcblxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdFx0cmVzdWx0W2tleV0gPSBzaXRlbTtcclxuXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCB0eXBlIG9mIHZhcmlhYmxlXHJcblx0ICogQHBhcmFtIG1peGVkIGlucHV0XHJcblx0ICogQHJldHVybiBzdHJpbmdcclxuXHQgKlxyXG5cdCAqIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vdHlwZW9mdmFyXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIHR5cGVPZihpbnB1dCkge1xyXG5cclxuXHRcdHJldHVybiAoe30pLnRvU3RyaW5nLmNhbGwoaW5wdXQpLnNsaWNlKDgsIC0xKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuXHR9XHJcblxyXG5cdGlmIChpc05vZGUpIHtcclxuXHJcblx0XHRtb2R1bGUuZXhwb3J0cyA9IFB1YmxpYztcclxuXHJcblx0fSBlbHNlIHtcclxuXHJcblx0XHR3aW5kb3dbcHVibGljTmFtZV0gPSBQdWJsaWM7XHJcblxyXG5cdH1cclxuXHJcbn0pKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZSAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKTsiLCJcbnZhciBwbHVnaW4gPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbiggbWV0YSwgZmlsZVVwbG9hZGVyLCBkb25lICkge1xuICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2Zvcm0nICksXG4gICAgICAgICAgICBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYnV0dG9uJyApO1xuICAgICAgICBcbiAgICAgICAgcGx1Z2luLnVwbG9hZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdpbnB1dCcgKTtcbiAgICAgICAgcGx1Z2luLnVwbG9hZC50eXBlID0gJ2ZpbGUnO1xuXG4gICAgICAgIHBsdWdpbi5pbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdpbnB1dCcgKTtcbiAgICAgICAgcGx1Z2luLmlucHV0LnR5cGUgPSAndXJsJztcblxuICAgICAgICBidXR0b24uaW5uZXJIVE1MID0gJ1N1Ym1pdCc7XG5cbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKCBwbHVnaW4udXBsb2FkICk7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCggcGx1Z2luLmlucHV0ICk7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCggYnV0dG9uICk7XG5cbiAgICAgICAgY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoICdzdWJtaXQnLCBvbkV2ZW50U3VibWl0LmJpbmQoIG51bGwsIGZpbGVVcGxvYWRlciApICk7XG4gICAgICAgIHBsdWdpbi51cGxvYWQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIG9uRXZlbnRDaGFuZ2UuYmluZCggbnVsbCwgZmlsZVVwbG9hZGVyICkgKTtcbiAgICAgICAgZG9uZSggbnVsbCwgY29udGFpbmVyICk7XG4gICAgfSxcbiAgICB0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKCAnc3VibWl0JyApICAgICAgICBcbiAgICAgICAgcGx1Z2luLnVwbG9hZC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJyApO1xuICAgIH0sXG4gICAgYXR0cmlidXRlczoge1xuICAgICAgICAnbmFtZScgOiAndXBsb2FkJ1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBvbkV2ZW50Q2hhbmdlKCBmaWxlVXBsb2FkZXIsIGV2ZW50ICkge1xuICAgIGZpbGVVcGxvYWRlci51cGxvYWQoIGV2ZW50LnRhcmdldCApO1xufVxuXG5mdW5jdGlvbiBvbkV2ZW50U3VibWl0KCBmaWxlVXBsb2FkZXIgKSB7XG4gICAgdmFyIGlucHV0ID0gcGx1Z2luLmlucHV0LFxuICAgICAgICB2YWx1ZSA9IGlucHV0LnZhbHVlLFxuICAgICAgICBldmVudCA9IHtcbiAgICAgICAgICAgIGZpbGVzOiBbe1xuICAgICAgICAgICAgICAgIHVybDogdmFsdWVcbiAgICAgICAgICAgIH1dXG4gICAgICAgIH07XG5cbiAgICBmaWxlVXBsb2FkZXIudXBsb2FkKCBldmVudCApO1xufSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1hZ2VUb0Jsb2IgPSByZXF1aXJlKCAnaW1hZ2UtdG8tYmxvYicgKSxcbiAgICB1dGlscyA9IHJlcXVpcmUoICcuL3V0aWxzJyApO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVVwbG9hZEV2ZW50O1xuXG5mdW5jdGlvbiBjcmVhdGVVcGxvYWRFdmVudCAoIGV2ZW50ZGF0YSwgY2FsbGJhY2sgKSB7XG4gICAgX2dldEJsb2JEYXRhKCBldmVudGRhdGEsIGZ1bmN0aW9uKCBlcnIsIGZpbGVzICkgeyBcbiAgICAgICAgaWYgKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soIGVyciApO1xuICAgICAgICBldmVudGRhdGEuZmlsZXMgPSBmaWxlcztcblxuICAgICAgICBjYWxsYmFjayggbnVsbCwgZXZlbnRkYXRhICk7XG4gICAgfSApOyAgICBcbn1cbiBcbmZ1bmN0aW9uIF9nZXRCbG9iRGF0YSAoIGV2ZW50ZGF0YSwgY2FsbGJhY2sgKSB7XG4gICAgdmFyIGZpbGVzID0gdXRpbHMubWFrZUFycmF5KCBldmVudGRhdGEuZmlsZXMgKSxcbiAgICAgICAgc2l6ZSA9IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgY291bnQgPSAwO1xuXG4gICAgZnVuY3Rpb24gZG9uZSAoICkge1xuICAgICAgICBjb3VudCArKztcbiAgICAgICAgaWYgKCBjb3VudCA9PT0gc2l6ZSApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCBudWxsLCBmaWxlcyApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0QmxvYkRhdGEoIGZpbGUsIGluZGV4ICkge1xuICAgICAgICBpZiAoIGZpbGUgaW5zdGFuY2VvZiBCbG9iICkge1xuICAgICAgICAgICAgZG9uZSgpOyAvLyBpZiBpdHMgYWxyZWFkeSBhIGJsb2Igbm8gbmVlZCB0byBkbyBhbnl0aGluZ1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBmaWxlLnVybCB8fCBmaWxlLmRhdGEgKSB7IC8vIGlmIHRoZSBmaWxlIHVybCBpcyBzZXQgb2YgdGhlIGZpbGUgZGF0YSBtZWFuaW5nIGEgZGF0YXVyaVxuICAgICAgICAgICAgaW1hZ2VUb0Jsb2IoIGZpbGUudXJsIHx8IGZpbGUuZGF0YSwgZnVuY3Rpb24oIGVyciwgYmxvYiApIHtcbiAgICAgICAgICAgICAgICBpZiAoIGVyciApIHJldHVybiBkb25lKCk7IC8vIHVuYWJsZSB0byBjb252ZXJ0IHNvIHNlbmQgaW4gcmF3IGZvcm1cbiAgICAgICAgICAgICAgICBmaWxlc1sgaW5kZXggXSA9IGJsb2I7XG4gICAgICAgICAgICAgICAgZG9uZSggKTtcbiAgICAgICAgICAgIH0gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkb25lKCApO1xuICAgIH1cblxuICAgIGZpbGVzLmZvckVhY2goIGdldEJsb2JEYXRhICk7XG59XG4iLCJcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMubWFrZUFycmF5ID0gZnVuY3Rpb24gKCBhcnIgKSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcnIsIDAgKTtcbn07Il19
