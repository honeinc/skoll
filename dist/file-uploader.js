(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

'use strict';

var merge = require( 'merge' ),
    UploadEvent = require( './src/upload-event')

/*
### FileUploader - Constructor

This is a basic Constructor that will just initialize some basic data structures needed to change the state of the fileUpload this should not due much due to the fact that this will happen initially inside of the module for the singleton. This should also be accessable via an export.

```javascript
var FileUploader = require( 'file-uploader' ).FileUploader,
    fileUploader = new FileUploader();
```
*/

function FileUploader() {

    this.el = document.createElement( 'div' );
    this.state = {
        view: 0
    };
    this.plugins = { };
    this.defaults = {
        plugin : 'upload'
    };
    setTimeout( this._init.bind( this ), 0 );
}

FileUploader.prototype = {
    get pluginList ( ) {
        var plugins = Object.keys( this.plugins );
        return plugins.filter( FileUploader.pluginVisible )
            .map( FileUploader.pluginListEl );
    }
}

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
    this.pluginList.forEach( this.listEl.appendChild.bind( this.listEl ) );

    this.el.classList.add( 'show' );
    this.state.view = 1;
    // open plugin
    if ( !plugin ) {
        // this.emit( 'error', new Error( 'No Plugin is found with the name ' + pluginName ))
        return;
    }
    plugin.open( options.meta || {}, this, this._handlePluginOpen.bind( this, options ) );
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

    this.el.classList.add( 'show' );
    this.state.view = 0;

    this.contentEl.innerHTML = '';
    if ( this.currentPlugin && typeof this.currentPlugin.teardown === 'function' ) {
        this.currentPlugin.teardown();
        this.currentPlugin = null;
    }

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

    // this.emit( 'error', new Error( 'useToUpload needs to be passed a function as the first parameter, ' + typof fn + ' given.' ) );
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

FileUploader.pluginListEl = function( plugin ) {
    var el = document.createElement( 'li' ),
        span = document.createElement( 'span' );

    // consider some way to use icons
    span.innerText = plugin.name;
    // need a way to bind events
    el.appendChild( span );

    return el;
};

FileUploader._init = function( ) {

    // this.el is built in the constructor

    this.tableEl = document.createElement( 'div' );
    this.modalEl = document.createElement( 'div' );
    this.contentEl = document.createElement( 'div' );
    this.listEl = document.createElement( 'ul' );
    // classing structure
    this.el.classList.add( 'FileUploader-modal-overlay' );
    this.tableEl.classList.add( 'FileUploader-modal-table' ); // this is here to allow vertical centering
    this.modalEl.classList.add( 'FileUploader-modal' );
    this.contentEl.classList.add( 'FileUploader-modal-content' );
    this.listEl.classList.add( 'FileUploader-modal-list' );
    // adding them all together
    this.el.appendChild( this.tableEl );
    this.tableEl.appendChild( this.modalEl );
    this.modalEl.appendChild( this.listEl );
    this.modalEl.appendChild( this.contentEl );

    /* HTML repesentation
    
    <div class="FileUploader-modal-overlay" >
        <div class="FileUploader-modal-table" >
            <div class="FileUploader-modal" >
                <ul class="FileUploader-modal-list"></ul>
                <div class="FileUploader-modal-content"></div>
            </div>
        </div>
    </div>

    */
};

FileUploader.prototype._handlePluginOpen = function( options, err, el ) {

    var defaultPlugin = this.defaults.plugin,
        openDefault = this.open.bind( this, merge( options, { 
            plugin: defaultPlugin
        } ) );

    if ( err ) {
        // this.emit( 'error', err );
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

},{"./src/upload-event":3,"merge":2}],2:[function(require,module,exports){
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
},{}],3:[function(require,module,exports){

var merge = require( 'merge' );
module.exports = UploadEvent;

function UploadEvent ( eventdata ) {




    return new Event( 'uploadevent', eventdata );
}

UploadEvent.prototype._getBlobData = function() { };
},{"merge":2}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL2ZpbGUtdXBsb2FkZXIvZmFrZV9kMjIzZDY0LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9maWxlLXVwbG9hZGVyL25vZGVfbW9kdWxlcy9tZXJnZS9tZXJnZS5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvZmlsZS11cGxvYWRlci9zcmMvdXBsb2FkLWV2ZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbWVyZ2UgPSByZXF1aXJlKCAnbWVyZ2UnICksXG4gICAgVXBsb2FkRXZlbnQgPSByZXF1aXJlKCAnLi9zcmMvdXBsb2FkLWV2ZW50JylcblxuLypcbiMjIyBGaWxlVXBsb2FkZXIgLSBDb25zdHJ1Y3RvclxuXG5UaGlzIGlzIGEgYmFzaWMgQ29uc3RydWN0b3IgdGhhdCB3aWxsIGp1c3QgaW5pdGlhbGl6ZSBzb21lIGJhc2ljIGRhdGEgc3RydWN0dXJlcyBuZWVkZWQgdG8gY2hhbmdlIHRoZSBzdGF0ZSBvZiB0aGUgZmlsZVVwbG9hZCB0aGlzIHNob3VsZCBub3QgZHVlIG11Y2ggZHVlIHRvIHRoZSBmYWN0IHRoYXQgdGhpcyB3aWxsIGhhcHBlbiBpbml0aWFsbHkgaW5zaWRlIG9mIHRoZSBtb2R1bGUgZm9yIHRoZSBzaW5nbGV0b24uIFRoaXMgc2hvdWxkIGFsc28gYmUgYWNjZXNzYWJsZSB2aWEgYW4gZXhwb3J0LlxuXG5gYGBqYXZhc2NyaXB0XG52YXIgRmlsZVVwbG9hZGVyID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICkuRmlsZVVwbG9hZGVyLFxuICAgIGZpbGVVcGxvYWRlciA9IG5ldyBGaWxlVXBsb2FkZXIoKTtcbmBgYFxuKi9cblxuZnVuY3Rpb24gRmlsZVVwbG9hZGVyKCkge1xuXG4gICAgdGhpcy5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgICAgdmlldzogMFxuICAgIH07XG4gICAgdGhpcy5wbHVnaW5zID0geyB9O1xuICAgIHRoaXMuZGVmYXVsdHMgPSB7XG4gICAgICAgIHBsdWdpbiA6ICd1cGxvYWQnXG4gICAgfTtcbiAgICBzZXRUaW1lb3V0KCB0aGlzLl9pbml0LmJpbmQoIHRoaXMgKSwgMCApO1xufVxuXG5GaWxlVXBsb2FkZXIucHJvdG90eXBlID0ge1xuICAgIGdldCBwbHVnaW5MaXN0ICggKSB7XG4gICAgICAgIHZhciBwbHVnaW5zID0gT2JqZWN0LmtleXMoIHRoaXMucGx1Z2lucyApO1xuICAgICAgICByZXR1cm4gcGx1Z2lucy5maWx0ZXIoIEZpbGVVcGxvYWRlci5wbHVnaW5WaXNpYmxlIClcbiAgICAgICAgICAgIC5tYXAoIEZpbGVVcGxvYWRlci5wbHVnaW5MaXN0RWwgKTtcbiAgICB9XG59XG5cbi8qXG4jIyMgRmlsZVVwbG9hZGVyOjpvcGVuXG5cblRoaXMgd2lsbCBqdXN0IGFwcGx5IGEgY2xhc3MsIGBzaG93YCwgdG8gdGhlIHVwbG9hZGVyIG1vZGFsIGNvbnRhaW5lciB0byBzaG93IHRoZSBtb2RhbC4gU2luY2Ugb25seSBleGFtcGxlIENTUyBpcyBwcm92aWRlZCBlaXRoZXIgdGhlIGV4YW1wbGUgY3NzIG5lZWRzIHRvIGJlIGludGVyZ3JhdGVkIGludG8gdGhlIGNvZGUgb3IgeW91IHdpbGwgbmVlZCB0byBwcm92aWRlIHRoYXQgZnVuY3Rpb25hbGl0eS4gVGhpcyB3aWxsIGFsc28gc2V0IHRoZSB2aWV3IHN0YXRlIG9mIHRoZSBgZmlsZVVwbG9hZGVyYCBvYmplY3QgdG8gYDFgIHRvIGluZGljYXRlIHRoYXQgdGhlIG1vZGFsIGlzIG9wZW4uXG5cbmBgYGphdmFzY3JpcHRcbnZhciBmaWxlVXBsb2FkZXIgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKTtcblxuZmlsZVVwbG9hZGVyLm9wZW4oKTtcblxuaWYgKCBmaWxlVXBsb2FkZXIuc3RhdGUudmlldyA9PT0gMSApIHtcbiAgICBjb25zb2xlLmxvZyggJ2ZpbGVVcGxvYWRlciBpcyBvcGVuJyApO1xufVxuXG5gYGBcblxuX19wYXJhbXNfX1xuXG4tIG9wdGlvbnMgeyBPYmplY3QgfSAtIEFuIG9iamVjdCB0aGF0IHdpbGwgc3RvcmUgc29tZSBpbmZvcm1hdGlvbiB0aGF0IHBlcnRhaW5zIHRvIHRoZSB2aWV3IG9uY2UgYmVpbmcgb3BlbmVkLlxuICAgIC0gb3B0aW9ucy5tZXRhIHsgT2JqZWN0IH0gLSBBbiBvYmplY3QgdGhhdCBob2xkcyBkYXRhIGFib3V0IGN1cnJlbnQgc3RhdGUgb2YgYXBwIHRoYXQgaXMgb3BlbmluZyB2aWV3IGNldGFpbiBwbHVnaW5zLCBvciB0YWJzLCB0YWtlIGRpZmZlcm50IHR5cGVzIG9mIGluZm9ybWF0aW9uIGluIHRoaXMgYXJlYSB0byBmdW5jdGlvbiBwcm9wZXJseS4gX1NlZSBzcGVjaWZpYyBwbHVnaW5fIGBQbHVnaW46Om9wZW4gLT4gb3B0aW9uc2AgZm9yIG1vcmUgc3BlY2lmaWMgZGV0YWlscyBzaW5jZSBgb3B0aW9ucy5tZXRhYCBpcyBnZW5lcmFseSBqdXN0IHBhc3NlZCB0byB0aGUgcGx1Z2luIGFzIHRoYXQgb2JqZWN0LlxuICAgIC0gb3B0aW9ucy5wbHVnaW4geyBTdHJpbmcgfSAtIHRoaXMgaXMgdGhlIG5hbWUgb2YgdGhlIHBsdWdpbiB0byBoYXZlIG9wZW4gd2hlbiBjYWxsaW5nIHRoZSBvcGVuIGZuLiBUaGlzIHdpbGwgYWxzbyB0cmlnZ2VyIGEgYFBsdWdpbjo6b3BlbmAuIFNpbmNlIG1vc3Qgb2YgdGhlIGJhc2ljIGZ1bmN0aW9uYWxpdHkgaXMgd3JpdHRlbiBhcyBhIHBsdWdpbiB0aGlzIGNhbiBiZSB1c2VkIHRvIG9wZW4gZGVmYXVsdCB2aWV3cy4gQWxzbyBpZiBubyBuYW1lIGlzIGdpdmVuIHRoZW4gaXQgZGVmYXVsdHMgdG8gdGhlIG1haW4gYHVwbG9hZC1waG90b2AgcGx1Z2luLlxuXG5fX3JldHVybnNfX1xuXG4tIFBsdWdpbiB7IE9iamVjdCB9IC0gcGx1Z2luIHRoYXQgaXMgb3BlbmVkXG5cbmBgYGphdmFzY3JpcHRcbnZhciBmaWxlVXBsb2FkZXIgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKTtcblxuZmlsZVVwbG9hZGVyLm9wZW4oIHtcbiAgICBtZXRhOiB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQXdlc29tZSBjYXRzIGFuZCBwaXp6YVxcJ3MgaW4gc3BhY2UnXG4gICAgfSxcbiAgICBwbHVnaW46ICdnaXBoeS1zZWFyY2gnICBcbn0gKTsgXG5cbmBgYFxuKi9cblxuRmlsZVVwbG9hZGVyLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHZhciBkZWZhdWx0UGx1Z2luID0gdGhpcy5kZWZhdWx0cy5wbHVnaW4sXG4gICAgICAgIHBsdWdpbk5hbWUgPSAgb3B0aW9ucy5wbHVnaW4gfHwgZGVmYXVsdFBsdWdpbixcbiAgICAgICAgcGx1Z2luID0gdGhpcy5wbHVnaW5zWyBwbHVnaW5OYW1lIF0gfHwgdGhpcy5wbHVnaW5zWyBkZWZhdWx0UGx1Z2luIF07XG5cbiAgICBvcHRpb25zLnBsdWdpbiA9IHBsdWdpbk5hbWU7XG4gICAgdGhpcy5jdXJyZW50UGx1Z2luID0gcGx1Z2luO1xuXG4gICAgLy8gdXBkYXRlIGxpbmtzXG4gICAgdGhpcy5wbHVnaW5MaXN0LmZvckVhY2goIHRoaXMubGlzdEVsLmFwcGVuZENoaWxkLmJpbmQoIHRoaXMubGlzdEVsICkgKTtcblxuICAgIHRoaXMuZWwuY2xhc3NMaXN0LmFkZCggJ3Nob3cnICk7XG4gICAgdGhpcy5zdGF0ZS52aWV3ID0gMTtcbiAgICAvLyBvcGVuIHBsdWdpblxuICAgIGlmICggIXBsdWdpbiApIHtcbiAgICAgICAgLy8gdGhpcy5lbWl0KCAnZXJyb3InLCBuZXcgRXJyb3IoICdObyBQbHVnaW4gaXMgZm91bmQgd2l0aCB0aGUgbmFtZSAnICsgcGx1Z2luTmFtZSApKVxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHBsdWdpbi5vcGVuKCBvcHRpb25zLm1ldGEgfHwge30sIHRoaXMsIHRoaXMuX2hhbmRsZVBsdWdpbk9wZW4uYmluZCggdGhpcywgb3B0aW9ucyApICk7XG59O1xuXG5cbi8qXG4jIyMgRmlsZVVwbG9hZGVyOjpjbG9zZVxuXG5UaGlzIHdpbGwgcmVtb3ZlIHRoZSBgc2hvd2AgZnJvbSB0aGUgdXBsb2FkZXIgbW9kYWwgY29udGFpbmVyLiBUaGlzIHdpbGwgYWxzbyB0cmlnZ2VyIGBQbHVnaW46OnRlYXJkb3duYCB0byB0aGUgY3VycmVjdCBhY3RpdmUgcGx1Z2luLlxuXG5gYGBqYXZhc2NyaXB0XG52YXIgZmlsZVVwbG9hZGVyID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICk7XG5cbmZpbGVVcGxvYWRlci5vcGVuKCk7XG5maWxlVXBsYWRlci5jbG9zZSgpO1xuXG5pZiAoICFmaWxlVXBsb2FkZXIuc3RhdGUudmlldyApIHtcbiAgICBjb25zb2xlLmxvZyggJ2ZpbGVVcGxvYWRlciBpcyBjbG9zZWQnICk7XG59XG5cbmBgYFxuKi9cblxuRmlsZVVwbG9hZGVyLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdGhpcy5lbC5jbGFzc0xpc3QuYWRkKCAnc2hvdycgKTtcbiAgICB0aGlzLnN0YXRlLnZpZXcgPSAwO1xuXG4gICAgdGhpcy5jb250ZW50RWwuaW5uZXJIVE1MID0gJyc7XG4gICAgaWYgKCB0aGlzLmN1cnJlbnRQbHVnaW4gJiYgdHlwZW9mIHRoaXMuY3VycmVudFBsdWdpbi50ZWFyZG93biA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgdGhpcy5jdXJyZW50UGx1Z2luLnRlYXJkb3duKCk7XG4gICAgICAgIHRoaXMuY3VycmVudFBsdWdpbiA9IG51bGw7XG4gICAgfVxuXG59O1xuXG4vKlxuIyMjIEZpbGVVcGxvYWRlcjo6YWRkUGx1Z2luXG5cblRoaXMgd2lsbCBhZGQgYSBwbHVnaW4gdG8gdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIHBsdWdpbnMuIE1lYW5pbmcgdGhhdCBpdCB3aWxsIGFsc28gYWRkIHRoZSBwbHVnaW4gbmFtZSB0byB0aGUgbGlzdCBvZiBfdGFiYWJsZV8gcGx1Z2lucywgYW5kIHRhcmdldHMgdG8gb3BlbiB3aGVuIG9wZW5pbmcgdGhlIGBGaWxlVXBsb2FkZXJgLlxuXG5fX3BhcmFtc19fXG5cbi0gcGx1Z2luIHsgT2JqZWN0IH0gLSBBIGBQbHVnaW5gIG9iamVjdCB0aGF0IGhhcyBhIG51bWJlciBvZiBkaWZmZXJudCBhdHRyaWJ1dGVzIG9uIHRoZSBwbHVnaW4gdG8gYWxsb3cgdGhlIGBGaWxlVXBsb2FkZXJgIHRvIHJlYWQgYW5kIGludGVyYWN0IHdpdGggdGhlIHBsdWdpbi4gSWYgc29tZSByZXF1aXJlZCBtZXRob2RzIGFyZSBub3QgcHJvdmlkZWQgdGhlIHBsdWdpbiB3aWxsIG5vdCBiZSBhZGRlZCBhbmQgYW4gYGVycm9yYCBldmVudCB3aWxsIGJlIGVtaXR0ZWQgZnJvbSB0aGUgRmlsZVVwbG9hZGVyLlxuXG4tIG9wdGlvbnMgeyBPYmplY3QgfSAtIF9PcHRpb25hbF8gQSBvcHRpb25hbCBvYmplY3QgdGhhdCBjYW4gc3BlY2lmeSB0aGUgYmVoYXZpb3IgaW4gd2hpY2ggdGhlIGBGaWxlVXBsb2FkZXJgIGJlaGF2ZXMgd2l0aCBwbHVnaW4uIFxuICAtIG9wdGlvbnMubWVudUl0ZW0geyBCb29sZWFuIH0gLSBfT3B0aW9uYWxfIEEgZmxhZyB0byBzcGVjaWZ5IGlmIHRoZSBwbHVnaW4gc2hvdWxkIGJlIGxpbmtlZCB0byBpbiBhIGxpc3Qgb2YgcGx1Z2lucy5cblxuX19yZXR1cm5zX19cblxuLSBwbHVnaW4geyBPYmplY3QgfSAtIEEgY29weSBvZiB0aGUgYFBsdWdpbmAgb2JqZWN0IGJhY2sgd2l0aCB0aGUgYGlzQWRkZWRgIHByb3BlcnR5IHNldCB0byB0cnVlIGlmIHN1Y2Nlc3NmdWxsIGFkZGVkIHRvIHRoZSBgRmlsZVVwbG9hZGVyYFxuXG5gYGBqYXZhc2NyaXB0XG52YXIgZmlsZVVwbG9hZGVyID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICksXG4gICAgZm9vID0ge1xuICAgICAgICBvcGVuOiBmdW5jdGlvbigpe31cbiAgICB9LFxuICAgIGJhciA9IHtcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKXt9LFxuICAgICAgICB0ZWFyZG93bjogZnVuY3Rpb24oKXt9LFxuICAgICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICAgICAgICBuYW1lOiAnQmFyJ1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwbHVnaW5Gb28gPSBmaWxlVXBsb2FkZXIuYWRkUGx1Z2luKCBmb28gKSxcbiAgICBwbHVnaW5CYXIgPSBmaWxlVXBsb2FkZXIuYWRkUGx1Z2luKCBiYXIgKTtcblxucGx1Z2luRm9vLmlzQWRkZWQgLy8gZmFsc2UgLSBtaXNzaW5nIHNvbWUgcmVxdWlyZWQgbWV0aG9kc1xucGx1Z2luQmFyLmlzQWRkZWQgLy8gdHJ1ZVxuYGBgXG4qL1xuXG5GaWxlVXBsb2FkZXIucHJvdG90eXBlLmFkZFBsdWdpbiA9IGZ1bmN0aW9uKCBwbHVnaW4sIG9wdGlvbnMgKSB7XG4gICAgXG4gICAgdmFyIF9wbHVnaW4gPSBtZXJnZSggdHJ1ZSwge30sIHBsdWdpbiB8fCB7fSApO1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYgKCAhRmlsZVVwbG9hZGVyLmlzUGx1Z2luKCBwbHVnaW4gKSApe1xuICAgICAgICBfcGx1Z2luLmlzQWRkZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIF9wbHVnaW47XG4gICAgfSAgXG5cbiAgICB0aGlzLnBsdWdpbnNbIF9wbHVnaW4uYXR0cmlidXRlcy5uYW1lIF0gPSBfcGx1Z2luO1xuICAgIF9wbHVnaW4uaXNBZGRlZCA9IHRydWU7XG4gICAgcmV0dXJuIF9wbHVnaW47XG5cbn07XG5cbi8qXG4jIyMgRmlsZVVwbG9hZGVyOjp1c2VUb1VwbG9hZFxuXG5UaGlzIGlzIGEgd2F5IHRvIGV4dGVuZCB0aGUgZmlsZSB1cGxvYWRlciB0byBhbGxvdyBmb3IgY3VzdG9tIHdheXMgdG8gdXBsb2FkIGZpbGVzIHRvIHlvdXIgc2VydmVyLiBcblxuX19wYXJhbXNfX1xuXG4tIHVwbG9hZEZuIHsgRnVuY3Rpb24gfSAtIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIGV2ZXIgYW4gYXNzZXQgaXMgYXR0ZW1wdGVkIHRvIGJlIHVwbG9hZGVkLiBEdWUgdG8gdGhlIHBsdWdnYWJsaXR5IG9mIHRoaXMgbW9kYWwgdGhpcyBjYW4gYmUgYSBudW1iZXIgb2YgdGhpbmdzIGRlcGVuZGluZyBvbiB0aGUgbmF0dXJlIG9mIHRoZSBwbHVnaW4uIFRoaXMgY2FuIGFsc28gYmUgdXNlZCB0byBzYXZlIGluZm9ybWF0aW9uIHRvIHlvdSBkYXRhYmFzZSBhYm91dCB0aGUgZGF0YSBiZWluZyB1cGxvYWRlZC5cblxudXBsb2FkRm4gaXMgcGFzc2VkIGFuIFVwbG9hZEV2ZW50IG9iamVjdCB0aGF0IGhhcyBhIG51bWJlciBvZiBob29rcyB0aGF0IHlvdSBjYW4gdGllIHlvdXIgdXBsb2FkZXIgaW50byB0byBhbGxvdyBmb3IgYW4gaW50ZXJhY3RpdmUgZXhwZXJpZW5jZSB3aGlsZSB1cGxvYWRpbmcgcGhvdG9zLiBTZWUgYFVwbG9hZEV2ZW50YCBvYmplY3Qgc3BlY2lmaWNhdGlvbiB0byBzZWUgaG93IHRvIGhvb2sgaW50byB0aGlzIGZ1bmN0aW9uYWxpdHlcblxuYGBgamF2YXNjcmlwdFxudmFyIGZpbGVVcGxvYWRlciA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5maWxlVXBsb2FkZXIudXNlVG9VcGxvYWQoIGZ1bmN0aW9uKCA8VXBsb2FkRXZlbnQ+ICkge1xuICAgIHZhciBmaWxlcyA9IGV2ZW50LmZpbGVzOyAvLyB0aGlzIGlzIGNvbW1pdGluZyBmcm9tIGEgaW5wdXQgZmlsZSBldmVudFxuICAgIC8vIGJsYWggYmxhaCB1cGxvYWRcbiAgICBmZWVkYmFja0Zucy5kb25lKHtcbiAgICAgICAgZmlsZXNbeyB1cmw6ICdodHRwOi8vZm9vLmJhci9iYXoucG5nJyB9XVxuICAgIH0pXG59ICk7XG5gYGBcbiovXG5cbkZpbGVVcGxvYWRlci5wcm90b3R5cGUudXNlVG9VcGxvYWQgPSBmdW5jdGlvbiggZm4gKSB7XG4gICAgXG4gICAgaWYgKCB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIHRoaXMudXBsb2FkRm4gPSBmbjtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAndXNlVG9VcGxvYWQgbmVlZHMgdG8gYmUgcGFzc2VkIGEgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IHBhcmFtZXRlciwgJyArIHR5cG9mIGZuICsgJyBnaXZlbi4nICkgKTtcbn07XG5cbkZpbGVVcGxvYWRlci5pc1BsdWdpbiA9IGZ1bmN0aW9uKCBwbHVnaW4gKSB7XG5cbiAgICBpZiAoICFwbHVnaW4gfHwgdHlwZW9mIHBsdWdpbiAhPT0gJ29iamVjdCcgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBwbHVnaW4ub3BlbiAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgcGx1Z2luLnRlYXJkb3duICE9PSAnZnVuY3Rpb24nICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCAhcGx1Z2luLmF0dHJpYnV0ZXMgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBwbHVnaW4uYXR0cmlidXRlcy5uYW1lICE9PSAnc3RyaW5nJyApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuRmlsZVVwbG9hZGVyLnBsdWdpblZpc2libGUgPSBmdW5jdGlvbiggcGx1Z2luICkge1xuICAgIHJldHVybiAhcGx1Z2luLmF0dHJpYnV0ZXMuaGlkZTtcbn07XG5cbkZpbGVVcGxvYWRlci5wbHVnaW5MaXN0RWwgPSBmdW5jdGlvbiggcGx1Z2luICkge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaScgKSxcbiAgICAgICAgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xuXG4gICAgLy8gY29uc2lkZXIgc29tZSB3YXkgdG8gdXNlIGljb25zXG4gICAgc3Bhbi5pbm5lclRleHQgPSBwbHVnaW4ubmFtZTtcbiAgICAvLyBuZWVkIGEgd2F5IHRvIGJpbmQgZXZlbnRzXG4gICAgZWwuYXBwZW5kQ2hpbGQoIHNwYW4gKTtcblxuICAgIHJldHVybiBlbDtcbn07XG5cbkZpbGVVcGxvYWRlci5faW5pdCA9IGZ1bmN0aW9uKCApIHtcblxuICAgIC8vIHRoaXMuZWwgaXMgYnVpbHQgaW4gdGhlIGNvbnN0cnVjdG9yXG5cbiAgICB0aGlzLnRhYmxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgIHRoaXMubW9kYWxFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgdGhpcy5jb250ZW50RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgIHRoaXMubGlzdEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3VsJyApO1xuICAgIC8vIGNsYXNzaW5nIHN0cnVjdHVyZVxuICAgIHRoaXMuZWwuY2xhc3NMaXN0LmFkZCggJ0ZpbGVVcGxvYWRlci1tb2RhbC1vdmVybGF5JyApO1xuICAgIHRoaXMudGFibGVFbC5jbGFzc0xpc3QuYWRkKCAnRmlsZVVwbG9hZGVyLW1vZGFsLXRhYmxlJyApOyAvLyB0aGlzIGlzIGhlcmUgdG8gYWxsb3cgdmVydGljYWwgY2VudGVyaW5nXG4gICAgdGhpcy5tb2RhbEVsLmNsYXNzTGlzdC5hZGQoICdGaWxlVXBsb2FkZXItbW9kYWwnICk7XG4gICAgdGhpcy5jb250ZW50RWwuY2xhc3NMaXN0LmFkZCggJ0ZpbGVVcGxvYWRlci1tb2RhbC1jb250ZW50JyApO1xuICAgIHRoaXMubGlzdEVsLmNsYXNzTGlzdC5hZGQoICdGaWxlVXBsb2FkZXItbW9kYWwtbGlzdCcgKTtcbiAgICAvLyBhZGRpbmcgdGhlbSBhbGwgdG9nZXRoZXJcbiAgICB0aGlzLmVsLmFwcGVuZENoaWxkKCB0aGlzLnRhYmxlRWwgKTtcbiAgICB0aGlzLnRhYmxlRWwuYXBwZW5kQ2hpbGQoIHRoaXMubW9kYWxFbCApO1xuICAgIHRoaXMubW9kYWxFbC5hcHBlbmRDaGlsZCggdGhpcy5saXN0RWwgKTtcbiAgICB0aGlzLm1vZGFsRWwuYXBwZW5kQ2hpbGQoIHRoaXMuY29udGVudEVsICk7XG5cbiAgICAvKiBIVE1MIHJlcGVzZW50YXRpb25cbiAgICBcbiAgICA8ZGl2IGNsYXNzPVwiRmlsZVVwbG9hZGVyLW1vZGFsLW92ZXJsYXlcIiA+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJGaWxlVXBsb2FkZXItbW9kYWwtdGFibGVcIiA+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiRmlsZVVwbG9hZGVyLW1vZGFsXCIgPlxuICAgICAgICAgICAgICAgIDx1bCBjbGFzcz1cIkZpbGVVcGxvYWRlci1tb2RhbC1saXN0XCI+PC91bD5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiRmlsZVVwbG9hZGVyLW1vZGFsLWNvbnRlbnRcIj48L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgICovXG59O1xuXG5GaWxlVXBsb2FkZXIucHJvdG90eXBlLl9oYW5kbGVQbHVnaW5PcGVuID0gZnVuY3Rpb24oIG9wdGlvbnMsIGVyciwgZWwgKSB7XG5cbiAgICB2YXIgZGVmYXVsdFBsdWdpbiA9IHRoaXMuZGVmYXVsdHMucGx1Z2luLFxuICAgICAgICBvcGVuRGVmYXVsdCA9IHRoaXMub3Blbi5iaW5kKCB0aGlzLCBtZXJnZSggb3B0aW9ucywgeyBcbiAgICAgICAgICAgIHBsdWdpbjogZGVmYXVsdFBsdWdpblxuICAgICAgICB9ICkgKTtcblxuICAgIGlmICggZXJyICkge1xuICAgICAgICAvLyB0aGlzLmVtaXQoICdlcnJvcicsIGVyciApO1xuICAgICAgICBpZiAoIG9wdGlvbnMucGx1Z2luICE9PSBkZWZhdWx0UGx1Z2luICkge1xuICAgICAgICAgICAgb3BlbkRlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgZWwgPT09ICdzdHJpbmcnICkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5pbm5lckhUTUwgPSBlbDtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIGVsID09PSAnb2JqZWN0JyAmJiBlbC50YWdOYW1lICkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgdGhpcy5jb250ZW50RWwuYXBwZW5kQ2hpbGQoIGVsICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvcGVuRGVmYXVsdCgpOyAvLyBqdXN0IHRyeSB0byBvcGVuIGRlZmF1bHQgd2hlbiBubyBjb250ZW50IGlzIGdpdmVuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBGaWxlVXBsb2FkZXIoKTtcbm1vZHVsZS5leHBvcnRzLkZpbGVVcGxvYWRlciA9IEZpbGVVcGxvYWRlcjtcbm1vZHVsZS5leHBvcnRzLlVwbG9hZEV2ZW50ID0gVXBsb2FkRXZlbnQ7XG4iLCIvKiFcclxuICogQG5hbWUgSmF2YVNjcmlwdC9Ob2RlSlMgTWVyZ2UgdjEuMi4wXHJcbiAqIEBhdXRob3IgeWVpa29zXHJcbiAqIEByZXBvc2l0b3J5IGh0dHBzOi8vZ2l0aHViLmNvbS95ZWlrb3MvanMubWVyZ2VcclxuXHJcbiAqIENvcHlyaWdodCAyMDE0IHllaWtvcyAtIE1JVCBsaWNlbnNlXHJcbiAqIGh0dHBzOi8vcmF3LmdpdGh1Yi5jb20veWVpa29zL2pzLm1lcmdlL21hc3Rlci9MSUNFTlNFXHJcbiAqL1xyXG5cclxuOyhmdW5jdGlvbihpc05vZGUpIHtcclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2Ugb25lIG9yIG1vcmUgb2JqZWN0cyBcclxuXHQgKiBAcGFyYW0gYm9vbD8gY2xvbmVcclxuXHQgKiBAcGFyYW0gbWl4ZWQsLi4uIGFyZ3VtZW50c1xyXG5cdCAqIEByZXR1cm4gb2JqZWN0XHJcblx0ICovXHJcblxyXG5cdHZhciBQdWJsaWMgPSBmdW5jdGlvbihjbG9uZSkge1xyXG5cclxuXHRcdHJldHVybiBtZXJnZShjbG9uZSA9PT0gdHJ1ZSwgZmFsc2UsIGFyZ3VtZW50cyk7XHJcblxyXG5cdH0sIHB1YmxpY05hbWUgPSAnbWVyZ2UnO1xyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSB0d28gb3IgbW9yZSBvYmplY3RzIHJlY3Vyc2l2ZWx5IFxyXG5cdCAqIEBwYXJhbSBib29sPyBjbG9uZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCwuLi4gYXJndW1lbnRzXHJcblx0ICogQHJldHVybiBvYmplY3RcclxuXHQgKi9cclxuXHJcblx0UHVibGljLnJlY3Vyc2l2ZSA9IGZ1bmN0aW9uKGNsb25lKSB7XHJcblxyXG5cdFx0cmV0dXJuIG1lcmdlKGNsb25lID09PSB0cnVlLCB0cnVlLCBhcmd1bWVudHMpO1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDbG9uZSB0aGUgaW5wdXQgcmVtb3ZpbmcgYW55IHJlZmVyZW5jZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCBpbnB1dFxyXG5cdCAqIEByZXR1cm4gbWl4ZWRcclxuXHQgKi9cclxuXHJcblx0UHVibGljLmNsb25lID0gZnVuY3Rpb24oaW5wdXQpIHtcclxuXHJcblx0XHR2YXIgb3V0cHV0ID0gaW5wdXQsXHJcblx0XHRcdHR5cGUgPSB0eXBlT2YoaW5wdXQpLFxyXG5cdFx0XHRpbmRleCwgc2l6ZTtcclxuXHJcblx0XHRpZiAodHlwZSA9PT0gJ2FycmF5Jykge1xyXG5cclxuXHRcdFx0b3V0cHV0ID0gW107XHJcblx0XHRcdHNpemUgPSBpbnB1dC5sZW5ndGg7XHJcblxyXG5cdFx0XHRmb3IgKGluZGV4PTA7aW5kZXg8c2l6ZTsrK2luZGV4KVxyXG5cclxuXHRcdFx0XHRvdXRwdXRbaW5kZXhdID0gUHVibGljLmNsb25lKGlucHV0W2luZGV4XSk7XHJcblxyXG5cdFx0fSBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0Jykge1xyXG5cclxuXHRcdFx0b3V0cHV0ID0ge307XHJcblxyXG5cdFx0XHRmb3IgKGluZGV4IGluIGlucHV0KVxyXG5cclxuXHRcdFx0XHRvdXRwdXRbaW5kZXhdID0gUHVibGljLmNsb25lKGlucHV0W2luZGV4XSk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBvdXRwdXQ7XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIHR3byBvYmplY3RzIHJlY3Vyc2l2ZWx5XHJcblx0ICogQHBhcmFtIG1peGVkIGlucHV0XHJcblx0ICogQHBhcmFtIG1peGVkIGV4dGVuZFxyXG5cdCAqIEByZXR1cm4gbWl4ZWRcclxuXHQgKi9cclxuXHJcblx0ZnVuY3Rpb24gbWVyZ2VfcmVjdXJzaXZlKGJhc2UsIGV4dGVuZCkge1xyXG5cclxuXHRcdGlmICh0eXBlT2YoYmFzZSkgIT09ICdvYmplY3QnKVxyXG5cclxuXHRcdFx0cmV0dXJuIGV4dGVuZDtcclxuXHJcblx0XHRmb3IgKHZhciBrZXkgaW4gZXh0ZW5kKSB7XHJcblxyXG5cdFx0XHRpZiAodHlwZU9mKGJhc2Vba2V5XSkgPT09ICdvYmplY3QnICYmIHR5cGVPZihleHRlbmRba2V5XSkgPT09ICdvYmplY3QnKSB7XHJcblxyXG5cdFx0XHRcdGJhc2Vba2V5XSA9IG1lcmdlX3JlY3Vyc2l2ZShiYXNlW2tleV0sIGV4dGVuZFtrZXldKTtcclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdGJhc2Vba2V5XSA9IGV4dGVuZFtrZXldO1xyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gYmFzZTtcclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSB0d28gb3IgbW9yZSBvYmplY3RzXHJcblx0ICogQHBhcmFtIGJvb2wgY2xvbmVcclxuXHQgKiBAcGFyYW0gYm9vbCByZWN1cnNpdmVcclxuXHQgKiBAcGFyYW0gYXJyYXkgYXJndlxyXG5cdCAqIEByZXR1cm4gb2JqZWN0XHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIG1lcmdlKGNsb25lLCByZWN1cnNpdmUsIGFyZ3YpIHtcclxuXHJcblx0XHR2YXIgcmVzdWx0ID0gYXJndlswXSxcclxuXHRcdFx0c2l6ZSA9IGFyZ3YubGVuZ3RoO1xyXG5cclxuXHRcdGlmIChjbG9uZSB8fCB0eXBlT2YocmVzdWx0KSAhPT0gJ29iamVjdCcpXHJcblxyXG5cdFx0XHRyZXN1bHQgPSB7fTtcclxuXHJcblx0XHRmb3IgKHZhciBpbmRleD0wO2luZGV4PHNpemU7KytpbmRleCkge1xyXG5cclxuXHRcdFx0dmFyIGl0ZW0gPSBhcmd2W2luZGV4XSxcclxuXHJcblx0XHRcdFx0dHlwZSA9IHR5cGVPZihpdGVtKTtcclxuXHJcblx0XHRcdGlmICh0eXBlICE9PSAnb2JqZWN0JykgY29udGludWU7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gaXRlbSkge1xyXG5cclxuXHRcdFx0XHR2YXIgc2l0ZW0gPSBjbG9uZSA/IFB1YmxpYy5jbG9uZShpdGVtW2tleV0pIDogaXRlbVtrZXldO1xyXG5cclxuXHRcdFx0XHRpZiAocmVjdXJzaXZlKSB7XHJcblxyXG5cdFx0XHRcdFx0cmVzdWx0W2tleV0gPSBtZXJnZV9yZWN1cnNpdmUocmVzdWx0W2tleV0sIHNpdGVtKTtcclxuXHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0XHRyZXN1bHRba2V5XSA9IHNpdGVtO1xyXG5cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXN1bHQ7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IHR5cGUgb2YgdmFyaWFibGVcclxuXHQgKiBAcGFyYW0gbWl4ZWQgaW5wdXRcclxuXHQgKiBAcmV0dXJuIHN0cmluZ1xyXG5cdCAqXHJcblx0ICogQHNlZSBodHRwOi8vanNwZXJmLmNvbS90eXBlb2Z2YXJcclxuXHQgKi9cclxuXHJcblx0ZnVuY3Rpb24gdHlwZU9mKGlucHV0KSB7XHJcblxyXG5cdFx0cmV0dXJuICh7fSkudG9TdHJpbmcuY2FsbChpbnB1dCkuc2xpY2UoOCwgLTEpLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cdH1cclxuXHJcblx0aWYgKGlzTm9kZSkge1xyXG5cclxuXHRcdG1vZHVsZS5leHBvcnRzID0gUHVibGljO1xyXG5cclxuXHR9IGVsc2Uge1xyXG5cclxuXHRcdHdpbmRvd1twdWJsaWNOYW1lXSA9IFB1YmxpYztcclxuXHJcblx0fVxyXG5cclxufSkodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpOyIsIlxudmFyIG1lcmdlID0gcmVxdWlyZSggJ21lcmdlJyApO1xubW9kdWxlLmV4cG9ydHMgPSBVcGxvYWRFdmVudDtcblxuZnVuY3Rpb24gVXBsb2FkRXZlbnQgKCBldmVudGRhdGEgKSB7XG5cblxuXG5cbiAgICByZXR1cm4gbmV3IEV2ZW50KCAndXBsb2FkZXZlbnQnLCBldmVudGRhdGEgKTtcbn1cblxuVXBsb2FkRXZlbnQucHJvdG90eXBlLl9nZXRCbG9iRGF0YSA9IGZ1bmN0aW9uKCkgeyB9OyJdfQ==
