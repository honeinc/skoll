(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

var plugin = module.exports = {
    open: function( meta, fileUploader, done ) {
        done( null, "<h1>Hello World</h1>" );
    },
    teardown: function() { },
    attributes: {
        'name' : 'foo'
    }
}

},{}],2:[function(require,module,exports){
var skoll = require( '..' ),
    foo = require( './foo' );

skoll.on( 'error', function( err ) {
    console.error( err.message );
    console.error( err.stack );
} );

skoll.addPlugin( foo );

skoll.useToUpload( function( event ){
    console.log( event );
});

window.skoll = skoll;

document.body.appendChild( skoll.el );
},{"..":3,"./foo":1}],3:[function(require,module,exports){

'use strict';

var merge = require( 'merge' ),
    eventEmitter = require( 'event-emitter' ),
    UploadEvent = require( './src/upload-event'),
    utils = require( './src/utils' ),
    uploadPlugin = require( './src/plugins/upload' ),
    previewPlugin = require( './src/plugins/preview' );

/*
### Skoll - Constructor

This is a basic Constructor that will just initialize some basic data structures needed to change the state of the fileUpload this should not due much due to the fact that this will happen initially inside of the module for the singleton. This should also be accessable via an export.

```javascript
var Skoll = require( 'file-uploader' ).Skoll,
    Skoll = new Skoll();
```
*/

function Skoll() {

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

Skoll.prototype = {
    get pluginList ( ) {
        var plugins = Object.keys( this.plugins );
        return plugins.map( Skoll.mapPlugins( this.plugins ) )
            .filter( Skoll.pluginVisible )
            .map( Skoll.pluginListEl( this.currentPlugin ) )
            .reverse();
    }
};

/*
### Skoll::open

This will just apply a class, `show`, to the uploader modal container to show the modal. Since only example CSS is provided either the example css needs to be intergrated into the code or you will need to provide that functionality. This will also set the view state of the `Skoll` object to `1` to indicate that the modal is open.

```javascript
var Skoll = require( 'file-uploader' );

Skoll.open();

if ( Skoll.state.view === 1 ) {
    console.log( 'Skoll is open' );
}

```

__params__

- options { Object } - An object that will store some information that pertains to the view once being opened.
    - options.meta { Object } - An object that holds data about current state of app that is opening view cetain plugins, or tabs, take differnt types of information in this area to function properly. _See specific plugin_ `Plugin::open -> options` for more specific details since `options.meta` is generaly just passed to the plugin as that object.
    - options.plugin { String } - this is the name of the plugin to have open when calling the open fn. This will also trigger a `Plugin::open`. Since most of the basic functionality is written as a plugin this can be used to open default views. Also if no name is given then it defaults to the main `upload-photo` plugin.

__returns__

- Plugin { Object } - plugin that is opened

```javascript
var Skoll = require( 'file-uploader' );

Skoll.open( {
    meta: {
        description: 'Awesome cats and pizza\'s in space'
    },
    plugin: 'giphy-search'  
} ); 

```
*/

Skoll.prototype.open = function( options ) {

    options = options || {};

    var defaultPlugin = this.defaults.plugin,
        pluginName =  options.plugin || defaultPlugin,
        plugin = this.plugins[ pluginName ] || this.plugins[ defaultPlugin ],
        close = this.close.bind( this );


    if ( this.currentPlugin ) {
        this.currentPlugin.teardown();
    }

    options.plugin = pluginName;
    this.currentPlugin = plugin;
    this.meta = options.meta || {};

    // update links
    this.listEl.innerHTML = '';

    this.pluginList.map( this.mapBindOpen.bind( this ) )
        .forEach( this.listEl.appendChild.bind( this.listEl ) );

    this.el.classList.add( 'show' );
    this.state.view = 1;
    // open plugin
    if ( !plugin ) {
        this.emit( 'error', new Error( 'No Plugin is found with the name ' + pluginName ) );
        return;
    }
    plugin.open( options.meta || {}, this, this._handlePluginOpen.bind( this, options ) );
    document.addEventListener( 'keyup', function( e ) {
       var code = e.keyCode || e.which;
        close();
    } );

    this.emit( 'open', plugin ); 

};


/*
### Skoll::close

This will remove the `show` from the uploader modal container. This will also trigger `Plugin::teardown` to the currect active plugin.

```javascript
var Skoll = require( 'file-uploader' );

Skoll.open();
fileUplader.close();

if ( !Skoll.state.view ) {
    console.log( 'Skoll is closed' );
}

```
*/

Skoll.prototype.close = function() {

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
### Skoll::upload

Upload method is a proxy to the Upload adapter that should be provided. This is used mainly to normalize some of the event data allowing it to be in a common format that uploader adapters can easily deal with. This is mainly to be used inside of plugins

__params__

- target { Object } - This is a object that will have the key Files in it. It is something similiar to the `event.target` object you would get on a change event of a file type input.
    - target.files { Array } - This can be a `Blob` or an object with the key `url` inside of it. eg. `[{ url: https://pbs.twimg.com/profile_images/544039728463351808/NkoRdBBL_bigger.png }]`. When creating an event this will attempt to convert this url into a blob if it is an image, otherwise it will just pass the object to the upload adapter.
*/


Skoll.prototype.upload = function( target ) { 

    if ( typeof target.files !== 'object' ) { // default upload events are not a true array
        this.emit( 'error', new Error( 'target passed to Skoll::upload does not have files array' ) );
        return;
    }

    if ( typeof this.uploadFn !== 'function' ) {
        // error
        this.emit( 'error', new Error( 'No upload function added using Skoll::useToUpload' ) );
        return;
    }

    var close = this.close.bind( this ),
        uploadFn = this.uploadFn,
        closeOnUpload = this.defaults.closeOnUpload,
        error = this.emit.bind( this, 'error' );

    this._createEvent( target, function( err, uploadEvent ) {
        if ( err ) {
            error( err );
            return;
        }

        uploadFn( uploadEvent || _event );
        if ( closeOnUpload ) { // this should be changable
            close();
            return;
        }
    } );
};

/*
### Skoll::preview

preview method is a easy way to open up the use or cancel dialog. This will open up the preview plugin that is registered with the system to preview the selection. 

__params__

- target { Object } - This is a object that will have the key Files in it. It is something similiar to the `event.target` object you would get on a change event of a file type input.
    - target.files { Array } - This can be a `Blob` or an object with the key `url` inside of it. eg. `[{ url: https://pbs.twimg.com/profile_images/544039728463351808/NkoRdBBL_bigger.png }]`. When creating an event this will attempt to convert this url into a blob if it is an image, otherwise it will just pass the object to the upload adapter.
*/


Skoll.prototype.preview = function( target ) {
    
    if ( typeof target.files !== 'object' ) { // default upload events are not a true array
        this.emit( 'error', new Error( 'target passed to Skoll::upload does not have files array' ) );
        return;
    }

    var open = this.open.bind( this ),
        meta = this.meta;

    this._createEvent( target, function( err, uploadEvent ) {
        meta.event = uploadEvent;
        open( { 
            meta: meta,
            plugin: 'preview' 
        } );
    } );

};


/*
__params__

- target { Object } - This is a object that will have the key Files in it. It is something similiar to the `event.target` object you would get on a change event of a file type input.
    - target.files { Array } - This can be a `Blob` or an object with the key `url` inside of it. eg. `[{ url: https://pbs.twimg.com/profile_images/544039728463351808/NkoRdBBL_bigger.png }]`. When creating an event this will attempt to convert this url into a blob if it is an image, otherwise it will just pass the object to the upload adapter.
*/

/*
### Skoll::addPlugin

This will add a plugin to the list of available plugins. Meaning that it will also add the plugin name to the list of _tabable_ plugins, and targets to open when opening the `Skoll`.

__params__

- plugin { Object } - A `Plugin` object that has a number of differnt attributes on the plugin to allow the `Skoll` to read and interact with the plugin. If some required methods are not provided the plugin will not be added and an `error` event will be emitted from the Skoll.

- options { Object } - _Optional_ A optional object that can specify the behavior in which the `Skoll` behaves with plugin. 
  - options.menuItem { Boolean } - _Optional_ A flag to specify if the plugin should be linked to in a list of plugins.

__returns__

- plugin { Object } - A copy of the `Plugin` object back with the `isAdded` property set to true if successfull added to the `Skoll`

```javascript
var Skoll = require( 'file-uploader' ),
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
    pluginFoo = Skoll.addPlugin( foo ),
    pluginBar = Skoll.addPlugin( bar );

pluginFoo.isAdded // false - missing some required methods
pluginBar.isAdded // true
```
*/

Skoll.prototype.addPlugin = function( plugin, options ) {
    
    var _plugin = merge( true, {}, plugin || {} );
    options = options || {};

    if ( !Skoll.isPlugin( plugin ) ){
        _plugin.isAdded = false;
        return _plugin;
    }  

    this.plugins[ _plugin.attributes.name ] = _plugin;
    _plugin.isAdded = true;
    return _plugin;

};

/*
### Skoll::useToUpload

This is a way to extend the file uploader to allow for custom ways to upload files to your server. 

__params__

- uploadFn { Function } - a function that will be called when ever an asset is attempted to be uploaded. Due to the pluggablity of this modal this can be a number of things depending on the nature of the plugin. This can also be used to save information to you database about the data being uploaded.

uploadFn is passed an UploadEvent object that has a number of hooks that you can tie your uploader into to allow for an interactive experience while uploading photos. See `UploadEvent` object specification to see how to hook into this functionality

```javascript
var Skoll = require( 'file-uploader' );

Skoll.useToUpload( function( <UploadEvent> ) {
    var files = event.files; // this is commiting from a input file event
    // blah blah upload
    feedbackFns.done({
        files[{ url: 'http://foo.bar/baz.png' }]
    })
} );
```
*/

Skoll.prototype.useToUpload = function( fn ) {
    if ( typeof fn === 'function' ) {
        this.uploadFn = fn;
        return;
    }

    this.emit( 'error', new Error( 'useToUpload needs to be passed a function as the first parameter, ' + typeof fn + ' given.' ) );
};


// start private methods

Skoll.prototype._createEvent = function( target, callback ) { 

    var _event = {},
        error = this.emit.bind( this, 'error' );

    _event.files = target.files;
    _event.originalEvent = target;

    // ways to give feedback to Skoll
    _event.done = this.emit.bind( this, 'done' );
    _event.error = error;

    new UploadEvent( _event, callback );

};

Skoll.prototype.mapBindOpen = function( el ) {
    el.addEventListener( 'click', this.open.bind( this, {
        meta: this.meta, 
        plugin: el.getAttribute( 'data-plugin-name' ) 
    } ) );
    return el;
};

Skoll.isPlugin = function( plugin ) {

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

Skoll.pluginVisible = function( plugin ) {
    return !plugin.attributes.hide;
};

Skoll.mapPlugins = function( plugins ) {
    return function( pluginName ) {
        return plugins[ pluginName ];
    }
};

Skoll.pluginListEl = function( currentPlugin ) {

    var currentPluginName = currentPlugin.attributes.name; 

    return function( plugin ) {
        var el = document.createElement( 'li' ),
            span = document.createElement( 'span' ),
            name = plugin.attributes.name;

        // consider some way to use icons
        span.innerText = name;
        el.setAttribute( 'data-plugin-name', name );
        el.appendChild( span );
        if ( name === currentPluginName ) {
            el.setAttribute( 'data-plugin-selected', true );
        }

        return el;        
    }

};

Skoll.prototype._init = function( ) {

    // this.el is built in the constructor
    var div = document.createElement.bind( document, 'div' ); 

    this.tableEl = div();
    this.cellEl = div();
    this.modalEl = div();
    this.contentEl = div();
    this.closeEl = div();
    this.listEl = document.createElement( 'ul' );
    // classing structure
    this.el.classList.add( 'skoll-modal-overlay' );
    this.tableEl.classList.add( 'skoll-modal-table' ); // this is here to allow vertical centering
    this.cellEl.classList.add( 'skoll-modal-cell' );
    this.closeEl.classList.add( 'skoll-modal-close' );
    this.modalEl.classList.add( 'skoll-modal' );
    this.contentEl.classList.add( 'skoll-modal-content' );
    this.listEl.classList.add( 'skoll-modal-list' );
    // adding them all together
    this.el.appendChild( this.tableEl );
    this.tableEl.appendChild( this.cellEl );
    this.cellEl.appendChild( this.modalEl );
    this.modalEl.appendChild( this.listEl );
    this.modalEl.appendChild( this.closeEl );
    this.modalEl.appendChild( this.contentEl );

    /* HTML repesentation
    
    <div class="skoll-modal-overlay" >
        <div class="skoll-modal-table" >
            <div class="skoll-modal-cell" >
                <div class="skoll-modal" >
                    <ul class="skoll-modal-list"></ul>
                    <div class="skoll-modal-close"></div>
                    <div class="skoll-modal-content"></div>
                </div>
            </div>
        </div>
    </div>

    */
    function stopPropagation( e ) {
        e.stopPropagation();
    }
    // bind some events to dom
    this.closeEl.addEventListener( 'click', this.close.bind( this ) );
    this.el.addEventListener( 'click', this.close.bind( this ) );
    this.modalEl.addEventListener( 'click', stopPropagation );

    // attach default plugin
    this.addPlugin( uploadPlugin );
    this.addPlugin( previewPlugin );

};

Skoll.prototype._handlePluginOpen = function( options, err, el ) {

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

module.exports = new Skoll();
module.exports.Skoll = Skoll;
module.exports.UploadEvent = UploadEvent;
module.exports.imageToBlob = require( 'image-to-blob' );

},{"./src/plugins/preview":22,"./src/plugins/upload":23,"./src/upload-event":24,"./src/utils":25,"event-emitter":4,"image-to-blob":19,"merge":21}],4:[function(require,module,exports){
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

},{"d":5,"es5-ext/object/valid-callable":14}],5:[function(require,module,exports){
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

},{"es5-ext/object/assign":6,"es5-ext/object/is-callable":9,"es5-ext/object/normalize-options":13,"es5-ext/string/#/contains":16}],6:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.assign
	: require('./shim');

},{"./is-implemented":7,"./shim":8}],7:[function(require,module,exports){
'use strict';

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};

},{}],8:[function(require,module,exports){
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

},{"../keys":10,"../valid-value":15}],9:[function(require,module,exports){
// Deprecated

'use strict';

module.exports = function (obj) { return typeof obj === 'function'; };

},{}],10:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.keys
	: require('./shim');

},{"./is-implemented":11,"./shim":12}],11:[function(require,module,exports){
'use strict';

module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};

},{}],12:[function(require,module,exports){
'use strict';

var keys = Object.keys;

module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};

},{}],13:[function(require,module,exports){
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

},{"./assign":6}],14:[function(require,module,exports){
'use strict';

module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],15:[function(require,module,exports){
'use strict';

module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{}],16:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? String.prototype.contains
	: require('./shim');

},{"./is-implemented":17,"./shim":18}],17:[function(require,module,exports){
'use strict';

var str = 'razdwatrzy';

module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};

},{}],18:[function(require,module,exports){
'use strict';

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],19:[function(require,module,exports){

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

},{"image-to-data-uri":20}],20:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
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
},{}],22:[function(require,module,exports){

var plugin = module.exports = {
    open: function( meta, skoll, done ) {
        var files = meta.event.files,
            size = files.length,
            count = 0,
            _files = [];

        function next( err, URI ) {
            count ++;

            if ( !err && URI ) { 
                _files.push( URI ); 
            }

            if ( count === size ) {
                render( _files, done )
            }
        }

        files.filter( filterUrls )
            .forEach( function( file ){
                readFile( file, next ); 
            } );

    },
    teardown: function() { },
    attributes: {
        name : 'preview',
        hide: true
    }
};

function filterUrls( file ) {
    return typeof file.url !== 'string';
}

function readFile( file, callback ) {
    var reader = new FileReader();

    reader.onload = function( ) {
        callback( null, reader.result );
    };

    reader.onerror = function( err ) {
        callback( err );
    };

    reader.readAsDataURL( file );
}

function render( files, done ) {

    var wrapper = document.createElement( 'div' ),
        use = document.createElement( 'button' ),
        cancel = document.createElement( 'button' ),
        images = document.createElement( 'div' ),
        buttons = document.createElement( 'div' )

    wrapper.classList.add( 'skoll-preview-wrapper' );
    images.classList.add( 'skoll-preview-images' );
    buttons.classList.add( 'skoll-preview-buttons' );

    use.innerHTML = 'Use';
    cancel.innerHTML = 'Cancel';

    function createElementAndAppend( container ) {

        return function( file ) {
            var img = document.createElement( 'div' );
            img.classList.add( 'skoll-preview-image' );
            img.setAttribute( 'style', 'background-image: url(' + file + ');' );
            container.appendChild( img );
        }
    }

    files.forEach( createElementAndAppend( images ) );

    wrapper.appendChild( images );
    wrapper.appendChild( buttons );
    buttons.appendChild( cancel );
    buttons.appendChild( use );

    done( null, wrapper );
}
},{}],23:[function(require,module,exports){

var plugin = module.exports = {
    open: function( meta, fileUploader, done ) {
        var button = document.createElement( 'button' );
        
        plugin.container = document.createElement( 'form' ),

        plugin.upload = document.createElement( 'input' );
        plugin.upload.type = 'file';
        plugin.upload.multiple = true;

        plugin.input = document.createElement( 'input' );
        plugin.input.type = 'url';

        button.innerHTML = 'Submit';

        plugin.container.appendChild( plugin.upload );
        plugin.container.appendChild( plugin.input );
        plugin.container.appendChild( button );

        plugin.container.addEventListener( 'submit', onEventSubmit.bind( null, fileUploader ) );
        plugin.upload.addEventListener( 'change', onEventChange.bind( null, fileUploader ) );
        done( null, plugin.container );
    },
    teardown: function() {
        plugin.upload = null;
        plugin.input = null;
        plugin.container = null;
    },
    attributes: {
        name : 'upload'
    }
}


function onEventChange( fileUploader, event ) {
    fileUploader.preview( event.target );
}

function onEventSubmit( fileUploader, e ) {

    e.preventDefault();

    var input = plugin.input,
        value = input.value,
        event = {
            files: [{
                url: value
            }]
        };

    fileUploader.preview( event );
}
},{}],24:[function(require,module,exports){

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

},{"./utils":25,"image-to-blob":19}],25:[function(require,module,exports){

'use strict';

module.exports.makeArray = function ( arr ) {
    return Array.prototype.slice.call( arr, 0 );
};
},{}]},{},[2]);
