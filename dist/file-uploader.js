(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

'use strict';

var merge = require( 'merge' ),
    EventEmitter2 = require( 'eventemitter2' ).EventEmitter2,
    emit = require( 'emit-bindings' ),
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

    this.el = document.createElement( 'div' );
    this.state = {
        view: 0
    };
    this.plugins = { };
    this.defaults = {
        plugin : 'upload',
        closeOnUpload: true
    };

    EventEmitter2.call( this );
    setTimeout( this._init.bind( this ), 0 );
}

Skoll.prototype = Object.create( EventEmitter2.prototype, {
        pluginList: { // descriptor
            get: function ( ) {
                var plugins = Object.keys( this.plugins );
                return plugins.map( Skoll.mapPlugins( this.plugins ) )
                    .filter( Skoll.pluginVisible )
                    .map( Skoll.pluginListEl( this.currentPlugin ) )
                    .reverse();
            }
        }
    }
);

Skoll.prototype.constructor = Skoll;
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

    options.plugin = pluginName;
    this.prevPlugin = this.currentPlugin;
    this.currentPlugin = plugin;
    this.meta = options.meta || {};

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
    // need to unbind this
    // document.addEventListener( 'keyup', function( e ) {
    //    var code = e.keyCode || e.which;
    //     close();
    // } );

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
        el.setAttribute( 'data-emit', 'skoll.plugin.open' );
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
    this.el.setAttribute( 'data-emit', 'skoll.close' );
    this.tableEl.classList.add( 'skoll-modal-table' ); // this is here to allow vertical centering
    this.cellEl.classList.add( 'skoll-modal-cell' );
    this.closeEl.classList.add( 'skoll-modal-close' );
    this.closeEl.setAttribute( 'data-emit', 'skoll.close' );
    this.modalEl.classList.add( 'skoll-modal' );
    this.modalEl.setAttribute( 'data-emit', 'skoll.modal.stopPropagation' );
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

    // bind some events to dom
    emit.on( 'skoll.close', this.close.bind( this ) );
    emit.on( 'skoll.plugin.open', this._onPluginOpen.bind( this ) );

    // attach default plugin
    this.addPlugin( uploadPlugin );
    this.addPlugin( previewPlugin );

};

Skoll.prototype._onPluginOpen = function( e ) {
    var el = e.emitTarget;
    this.open( {
        meta: this.meta,
        plugin: el.getAttribute( 'data-plugin-name' )
    } );
};

Skoll.prototype._handlePluginOpen = function( options, err, el ) {

    var defaultPlugin = this.defaults.plugin,
        openDefault = this.open.bind( this, merge( options, {
            plugin: defaultPlugin
        } ) );

    if ( this.prevPlugin ) {
        this.prevPlugin.teardown();
    }

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

},{"./src/plugins/preview":7,"./src/plugins/upload":8,"./src/upload-event":9,"./src/utils":10,"emit-bindings":2,"eventemitter2":3,"image-to-blob":4,"merge":6}],2:[function(require,module,exports){
'use strict';

var EventEmitter2 = require( 'eventemitter2' ).EventEmitter2;

/*
    dependencies
*/

/* binding */
var bindingMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
var eventPrefix = bindingMethod !== 'addEventListener' ? 'on' : '';

function bind( el, type, fn, capture ) {
    el[ bindingMethod ]( eventPrefix + type, fn, capture || false );
    return fn;
}

/* matching */
var vendorMatch = Element.prototype.matches || Element.prototype.webkitMatchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.oMatchesSelector;

function matches( el, selector ) {
    if ( !el || el.nodeType !== 1 ) {
        return false;
    }
    if ( vendorMatch ) {
        return vendorMatch.call( el, selector );
    }
    var nodes = document.querySelectorAll( selector, el.parentNode );
    for ( var i = 0; i < nodes.length; ++i ) {
        if ( nodes[ i ] == el ) {
            return true;
        }
    }
    return false;
}

/* closest */

function closest( element, selector, checkSelf, root ) {
    element = checkSelf ? {parentNode: element} : element;

    root = root || document;

    /* Make sure `element !== document` and `element != null`
       otherwise we get an illegal invocation */
    while ( ( element = element.parentNode ) && element !== document ) {
        if ( matches( element, selector ) ) {
            return element;
        }

        /* After `matches` on the edge case that
           the selector matches the root
           (when the root is not the document) */
        if (element === root) {
            return;
        }
    }
}

/*
    end dependencies
*/

function Emit() {
    var self = this;
    EventEmitter2.call( self );

    self.validators = [];
    self.touchMoveDelta = 10;
    self.initialTouchPoint = null;

    bind( document, 'touchstart', self.handleEvent.bind( self ) );
    bind( document, 'touchmove', self.handleEvent.bind( self ) );
    bind( document, 'touchend', self.handleEvent.bind( self ) );
    bind( document, 'click', self.handleEvent.bind( self ) );
    bind( document, 'input', self.handleEvent.bind( self ) );
    bind( document, 'submit', self.handleEvent.bind( self ) );
}

Emit.prototype = Object.create( EventEmitter2.prototype );

function t() {
    return true;
}
function f() {
    return false;
}

function getTouchDelta( event, initial ) {
    var deltaX = ( event.touches[ 0 ].pageX - initial.x );
    var deltaY = ( event.touches[ 0 ].pageY - initial.y );
    return Math.sqrt( ( deltaX * deltaX ) + ( deltaY * deltaY ) );
}

Emit.prototype.handleEvent = function( event ) {
    var self = this;

    if ( typeof( event.isPropagationStopped ) == 'undefined' ) {
        event.isPropagationStopped = f;
    }

    var touches = event.touches;
    var delta = -1;
    switch ( event.type ) {
        case 'touchstart':
            self.initialTouchPoint = self.lastTouchPoint = {
                x: touches && touches.length ? touches[ 0 ].pageX : 0,
                y: touches && touches.length ? touches[ 0 ].pageY : 0
            };

            break;

        case 'touchmove':
            if ( touches && touches.length && self.initialTouchPoint ) {
                delta = getTouchDelta( event, self.initialTouchPoint );
                if ( delta > self.touchMoveDelta ) {
                    self.initialTouchPoint = null;
                }

                self.lastTouchPoint = {
                    x: touches[ 0 ].pageX,
                    y: touches[ 0 ].pageY
                };
            }

            break;

        case 'click':
        case 'touchend':
        case 'input':
        case 'submit':
            // eat any late-firing click events on touch devices
            if ( event.type === 'click' && self.lastTouchPoint ) {
                if ( event.touches && event.touches.length ) {
                    delta = getTouchDelta( event, self.lastTouchPoint );
                    if ( delta < self.touchMoveDelta ) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                }
            }

            // handle canceling touches that have moved too much
            if ( event.type === 'touchend' && !self.initialTouchPoint ) {
                return;
            }

            var selector = '[data-emit]';
            var originalElement = event.target || event.srcElement;

            // if it's a link and it has no emit attribute, allow the event to pass
            if ( !originalElement.getAttribute( 'data-emit' ) && ( originalElement.tagName === 'A' || originalElement.tagName === 'BUTTON' || originalElement.tagName === 'INPUT' ) ) {
                return;
            }

            var forceAllowDefault = originalElement.tagName == 'INPUT' && ( originalElement.type == 'checkbox' || originalElement.type == 'radio' );
            var el = closest( originalElement, selector, true, document );

            if ( el ) {
                var depth = -1;
                while ( el && !event.isPropagationStopped() && ++depth < 100 ) {
                    var validated = true;
                    for ( var validatorIndex = 0; validatorIndex < self.validators.length; ++validatorIndex ) {
                        if ( !self.validators[ validatorIndex ].call( this, el, event ) ) {
                            validated = false;
                            break;
                        }
                    }

                    // eat the event if a validator failed
                    if ( !validated ) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        if ( typeof( event.isPropagationStopped ) != 'function' || !event.isPropagationStopped() ) {
                            event.isPropagationStopped = t;
                        }

                        el = null;
                        continue;
                    }

                    if ( typeof( self.validate ) == 'function' && !self.validate.call( self, el ) ) {
                        el = closest( el, selector, false, document );
                        continue;
                    }

                    if ( el.tagName == 'FORM' ) {
                        if ( event.type != 'submit' ) {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }
                    else if ( el.tagName == 'INPUT' ) {
                        if ( !( el.type == 'submit' || el.type == 'checkbox' || el.type == 'radio' || el.type == 'file' ) && event.type != 'input' ) {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }
                    else if ( el.tagName == 'SELECT' ) {
                        if ( event.type != 'input' ) {
                            el = closest( el, selector, false, document );
                            continue;
                        }
                    }

                    event.emitTarget = el;
                    self._emit( el, event, forceAllowDefault );
                    el = closest( el, selector, false, document );
                }

                if ( depth >= 100 ) {
                    throw new Error( 'Exceeded depth limit for Emit calls.' );
                }
            }
            else {
                self.emit( 'unhandled', event );
            }

            self.initialTouchPoint = null;

            break;
    }
};

Emit.prototype._emit = function( element, event, forceDefault ) {
    var self = this;
    var optionString = element.getAttribute( 'data-emit-options' );
    var options = {};
    var ignoreString = element.getAttribute( 'data-emit-ignore' );
    var i;

    if ( ignoreString && ignoreString.length ) {
        var ignoredEvents = ignoreString.toLowerCase().split( ' ' );
        for ( i = 0; i < ignoredEvents.length; ++i ) {
            if ( event.type == ignoredEvents[ i ] ) {
                return;
            }
        }
    }

    if ( optionString && optionString.length ) {
        var opts = optionString.toLowerCase().split( ' ' );
        for ( i = 0; i < opts.length; ++i ) {
            options[ opts[ i ] ] = true;
        }
    }

    if ( !forceDefault && !options.allowdefault ) {
        event.preventDefault();
    }

    if ( !options.allowpropagate ) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        if ( typeof( event.isPropagationStopped ) != 'function' || !event.isPropagationStopped() ) {
            event.isPropagationStopped = t;
        }
    }

    var emissionList = element.getAttribute( 'data-emit' );
    if ( !emissionList ) {
        // allow for empty behaviors that catch events
        return;
    }

    var emissions = emissionList.split( ',' );
    if ( options.debounce ) {
        self.timeouts = self.timeouts || {};
        if ( self.timeouts[ element ] ) {
            clearTimeout( self.timeouts[ element ] );
        }

        (function() {
            var _element = element;
            var _emissions = emissions;
            var _event = event;
            self.timeouts[ element ] = setTimeout( function() {
                _emissions.forEach( function( emission ) {
                    self.emit( emission, _event );
                } );
                clearTimeout( self.timeouts[ _element ] );
                self.timeouts[ _element ] = null;
            }, 250 );
        } )();

        return;
    }

    emissions.forEach( function( emission ) {
        self.emit( emission, event );
    } );
};

Emit.prototype.addValidator = function( validator ) {
    var self = this;

    var found = false;
    for ( var i = 0; i < self.validators.length; ++i ) {
        if ( self.validators[ i ] == validator ) {
            found = true;
            break;
        }
    }

    if ( found ) {
        return false;
    }

    self.validators.push( validator );
    return true;
};

Emit.prototype.removeValidator = function( validator ) {
    var self = this;

    var found = false;
    for ( var i = 0; i < self.validators.length; ++i ) {
        if ( self.validators[ i ] == validator ) {
            self.validators.splice( i, 1 );
            found = true;
            break;
        }
    }

    return found;
};

Emit.singleton = Emit.singleton || new Emit();
Emit.singleton.Emit = Emit;

module.exports = Emit.singleton;
},{"eventemitter2":3}],3:[function(require,module,exports){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

},{}],4:[function(require,module,exports){

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

},{"image-to-data-uri":5}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
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
},{}],7:[function(require,module,exports){
var emit = require( 'emit-bindings' ),
    attributes = {
        name : 'preview',
        hide: true
    };


function Preview( attrs ){
    this.attributes = attrs;
}

Preview.prototype = {
    open: function( meta, skoll, done ){
        var files = meta.event.files,
            size = files.length,
            count = 0,
            render = this.render.bind( this ),
            _files = [];

        emit.on( 'skoll.preview.cancel', skoll.open.bind( skoll, { meta: meta } ) );
        emit.on( 'skoll.preview.use', skoll.upload.bind( skoll, meta.event ) );

        function next( err, URI ) {

            var btns;

            count ++;

            if ( !err && URI ) {
                _files.push( URI );
            }

            if ( count === size ) {
                render( _files, done );
            }
        }

        files.filter( filterUrls )
            .forEach( function( file ){
                readFile( file, next );
            } );
    },
    teardown: function(){
        emit.removeAllListeners( 'skoll.preview.cancel' );
        emit.removeAllListeners( 'skoll.preview.use' );
    },
    render: function( files, callback ) {
        var wrapper = document.createElement( 'div' ),
            use = document.createElement( 'button' ),
            cancel = document.createElement( 'button' ),
            images = document.createElement( 'div' ),
            buttons = document.createElement( 'div' )

        wrapper.classList.add( 'skoll-preview-wrapper' );
        images.classList.add( 'skoll-preview-images' );
        buttons.classList.add( 'skoll-preview-buttons' );

        use.innerText = 'Use';
        use.setAttribute( 'data-emit', 'skoll.preview.use' );
        use.classList.add( 'skoll-button' );

        cancel.innerHTML = 'Cancel';
        cancel.setAttribute( 'data-emit', 'skoll.preview.cancel' );
        cancel.classList.add( 'skoll-button' );

        files.forEach( createElementAndAppend( images ) );

        wrapper.appendChild( images );
        wrapper.appendChild( buttons );
        buttons.appendChild( cancel );
        buttons.appendChild( use );

        callback( null, wrapper );
    }
};

module.exports = new Preview( attributes );

function createElementAndAppend( container ) {
    return function( file ) {
        var img = document.createElement( 'div' );
        img.classList.add( 'skoll-preview-image' );
        img.setAttribute( 'style', 'background-image: url(' + file + ');' );
        container.appendChild( img );
    }
}

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
},{"emit-bindings":2}],8:[function(require,module,exports){

var emit = require( 'emit-bindings' );

function Upload( attrs ){
    this.attributes = attrs;
}

Upload.prototype = {
    open: function( meta, skoll, done ) {
        this.skoll = skoll;
        emit.on( 'skoll.upload.submit', this.onSubmit.bind( this ) );
        this.render( done );
    },
    teardown: function() {
        // clear out some cache
        this.upload = null;
        this.input = null;
        this.container = null;
        this.skoll = null;
        emit.removeAllListeners( 'skoll.upload.submit' );
    },
    onSubmit: function( e ) {

        e.preventDefault();

        var input = this.input,
            value = input.value,
            event = {
                files: [{
                    url: value
                }]
            };

        this.skoll.preview( event );
    },
    onChange: function( e ) {
        this.skoll.preview( e.target );
    },
    attachListeners: function( ) {

        var leaveBuffer,
            classList = this.dropzone.classList;

        function dragOver() {
            clearTimeout( leaveBuffer );
            if ( classList.contains( 'skoll-upload-drag-over' ) ) return;
            classList.add( 'skoll-upload-drag-over' );
        }

        function dragLeave() {
            classList.remove( 'skoll-upload-drag-over' );
            classList.remove( 'skoll-upload-show' );
        }

        function showOver() {
            if ( classList.remove( 'skoll-upload-show' ) ) return;
            classList.add( 'skoll-upload-show' );
        }

        this.dropzone.addEventListener( 'dragover', dragOver );
        this.dropzone.addEventListener( 'dragleave', dragLeave );
        this.dropzone.addEventListener( 'drop', dragLeave );

        this.skoll.el.removeEventListener( 'dragover', showOver );
        this.skoll.el.addEventListener( 'dragover', showOver );

        this.upload.addEventListener( 'change', this.onChange.bind( this ) );

    },
    render: function( done ) {

        var html =
        '<div class="skoll-upload-url">' +
            '<button class="skoll-button" data-emit="skoll-upload-trigger">Upload</button>' +
        '</div>' +
        '<hr>' +
        '<form class="skoll-upload-form" data-emit="skoll.upload.submit">' +
            '<p>Enter a URL:</p>' +
            '<input type="url" />' +
            '<button class="skoll-button">Submit</button>' +
        '</form>' +
        '<div class="skoll-upload-dropzone">' +
            '<p>Drop you images here!</p>' +
            '<input class="skoll-upload-input" type="file" multiple />' +
        '</div>';

        this.el = document.createElement( 'div' );
        this.el.classList.add( 'skoll-upload-plugin' );
        this.el.innerHTML = html;

        this.dropzone = this.el.getElementsByClassName( 'skoll-upload-dropzone' )[ 0 ]
        this.upload = this.dropzone.getElementsByClassName( 'skoll-upload-input' )[ 0 ];

        this.attachListeners( );

        done( null, this.el );
    }
};

module.exports = new Upload( {
    name: 'upload'
} );

// - drag events -----------------------------------------------------


// UploadModal.prototype.dropZoneEvents = function( $dropzone, $wrapper ) {

// };

},{"emit-bindings":2}],9:[function(require,module,exports){

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

},{"./utils":10,"image-to-blob":4}],10:[function(require,module,exports){

'use strict';

module.exports.makeArray = function ( arr ) {
    return Array.prototype.slice.call( arr, 0 );
};
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvc2tvbGwvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9za29sbC9mYWtlXzkxYWU3OWMxLmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9za29sbC9ub2RlX21vZHVsZXMvZW1pdC1iaW5kaW5ncy9pbmRleC5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvc2tvbGwvbm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliL2V2ZW50ZW1pdHRlcjIuanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL3Nrb2xsL25vZGVfbW9kdWxlcy9pbWFnZS10by1ibG9iL2luZGV4LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9za29sbC9ub2RlX21vZHVsZXMvaW1hZ2UtdG8tYmxvYi9ub2RlX21vZHVsZXMvaW1hZ2UtdG8tZGF0YS11cmkvaW1hZ2UtdG8tZGF0YS11cmkuanMiLCIvaG9tZS9qYWNvYi9Qcm9qZWN0cy9Ib25lL3Nrb2xsL25vZGVfbW9kdWxlcy9tZXJnZS9tZXJnZS5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvc2tvbGwvc3JjL3BsdWdpbnMvcHJldmlldy5qcyIsIi9ob21lL2phY29iL1Byb2plY3RzL0hvbmUvc2tvbGwvc3JjL3BsdWdpbnMvdXBsb2FkLmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9za29sbC9zcmMvdXBsb2FkLWV2ZW50LmpzIiwiL2hvbWUvamFjb2IvUHJvamVjdHMvSG9uZS9za29sbC9zcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBtZXJnZSA9IHJlcXVpcmUoICdtZXJnZScgKSxcbiAgICBFdmVudEVtaXR0ZXIyID0gcmVxdWlyZSggJ2V2ZW50ZW1pdHRlcjInICkuRXZlbnRFbWl0dGVyMixcbiAgICBlbWl0ID0gcmVxdWlyZSggJ2VtaXQtYmluZGluZ3MnICksXG4gICAgVXBsb2FkRXZlbnQgPSByZXF1aXJlKCAnLi9zcmMvdXBsb2FkLWV2ZW50JyksXG4gICAgdXRpbHMgPSByZXF1aXJlKCAnLi9zcmMvdXRpbHMnICksXG4gICAgdXBsb2FkUGx1Z2luID0gcmVxdWlyZSggJy4vc3JjL3BsdWdpbnMvdXBsb2FkJyApLFxuICAgIHByZXZpZXdQbHVnaW4gPSByZXF1aXJlKCAnLi9zcmMvcGx1Z2lucy9wcmV2aWV3JyApO1xuXG4vKlxuIyMjIFNrb2xsIC0gQ29uc3RydWN0b3JcblxuVGhpcyBpcyBhIGJhc2ljIENvbnN0cnVjdG9yIHRoYXQgd2lsbCBqdXN0IGluaXRpYWxpemUgc29tZSBiYXNpYyBkYXRhIHN0cnVjdHVyZXMgbmVlZGVkIHRvIGNoYW5nZSB0aGUgc3RhdGUgb2YgdGhlIGZpbGVVcGxvYWQgdGhpcyBzaG91bGQgbm90IGR1ZSBtdWNoIGR1ZSB0byB0aGUgZmFjdCB0aGF0IHRoaXMgd2lsbCBoYXBwZW4gaW5pdGlhbGx5IGluc2lkZSBvZiB0aGUgbW9kdWxlIGZvciB0aGUgc2luZ2xldG9uLiBUaGlzIHNob3VsZCBhbHNvIGJlIGFjY2Vzc2FibGUgdmlhIGFuIGV4cG9ydC5cblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICkuU2tvbGwsXG4gICAgU2tvbGwgPSBuZXcgU2tvbGwoKTtcbmBgYFxuKi9cblxuZnVuY3Rpb24gU2tvbGwoKSB7XG5cbiAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcbiAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICB2aWV3OiAwXG4gICAgfTtcbiAgICB0aGlzLnBsdWdpbnMgPSB7IH07XG4gICAgdGhpcy5kZWZhdWx0cyA9IHtcbiAgICAgICAgcGx1Z2luIDogJ3VwbG9hZCcsXG4gICAgICAgIGNsb3NlT25VcGxvYWQ6IHRydWVcbiAgICB9O1xuXG4gICAgRXZlbnRFbWl0dGVyMi5jYWxsKCB0aGlzICk7XG4gICAgc2V0VGltZW91dCggdGhpcy5faW5pdC5iaW5kKCB0aGlzICksIDAgKTtcbn1cblxuU2tvbGwucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggRXZlbnRFbWl0dGVyMi5wcm90b3R5cGUsIHtcbiAgICAgICAgcGx1Z2luTGlzdDogeyAvLyBkZXNjcmlwdG9yXG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICggKSB7ICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgcGx1Z2lucyA9IE9iamVjdC5rZXlzKCB0aGlzLnBsdWdpbnMgKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGx1Z2lucy5tYXAoIFNrb2xsLm1hcFBsdWdpbnMoIHRoaXMucGx1Z2lucyApIClcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlciggU2tvbGwucGx1Z2luVmlzaWJsZSApXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoIFNrb2xsLnBsdWdpbkxpc3RFbCggdGhpcy5jdXJyZW50UGx1Z2luICkgKVxuICAgICAgICAgICAgICAgICAgICAucmV2ZXJzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuKTtcblxuU2tvbGwucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU2tvbGw7XG4vKlxuIyMjIFNrb2xsOjpvcGVuXG5cblRoaXMgd2lsbCBqdXN0IGFwcGx5IGEgY2xhc3MsIGBzaG93YCwgdG8gdGhlIHVwbG9hZGVyIG1vZGFsIGNvbnRhaW5lciB0byBzaG93IHRoZSBtb2RhbC4gU2luY2Ugb25seSBleGFtcGxlIENTUyBpcyBwcm92aWRlZCBlaXRoZXIgdGhlIGV4YW1wbGUgY3NzIG5lZWRzIHRvIGJlIGludGVyZ3JhdGVkIGludG8gdGhlIGNvZGUgb3IgeW91IHdpbGwgbmVlZCB0byBwcm92aWRlIHRoYXQgZnVuY3Rpb25hbGl0eS4gVGhpcyB3aWxsIGFsc28gc2V0IHRoZSB2aWV3IHN0YXRlIG9mIHRoZSBgU2tvbGxgIG9iamVjdCB0byBgMWAgdG8gaW5kaWNhdGUgdGhhdCB0aGUgbW9kYWwgaXMgb3Blbi5cblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICk7XG5cblNrb2xsLm9wZW4oKTtcblxuaWYgKCBTa29sbC5zdGF0ZS52aWV3ID09PSAxICkge1xuICAgIGNvbnNvbGUubG9nKCAnU2tvbGwgaXMgb3BlbicgKTtcbn1cblxuYGBgXG5cbl9fcGFyYW1zX19cblxuLSBvcHRpb25zIHsgT2JqZWN0IH0gLSBBbiBvYmplY3QgdGhhdCB3aWxsIHN0b3JlIHNvbWUgaW5mb3JtYXRpb24gdGhhdCBwZXJ0YWlucyB0byB0aGUgdmlldyBvbmNlIGJlaW5nIG9wZW5lZC5cbiAgICAtIG9wdGlvbnMubWV0YSB7IE9iamVjdCB9IC0gQW4gb2JqZWN0IHRoYXQgaG9sZHMgZGF0YSBhYm91dCBjdXJyZW50IHN0YXRlIG9mIGFwcCB0aGF0IGlzIG9wZW5pbmcgdmlldyBjZXRhaW4gcGx1Z2lucywgb3IgdGFicywgdGFrZSBkaWZmZXJudCB0eXBlcyBvZiBpbmZvcm1hdGlvbiBpbiB0aGlzIGFyZWEgdG8gZnVuY3Rpb24gcHJvcGVybHkuIF9TZWUgc3BlY2lmaWMgcGx1Z2luXyBgUGx1Z2luOjpvcGVuIC0+IG9wdGlvbnNgIGZvciBtb3JlIHNwZWNpZmljIGRldGFpbHMgc2luY2UgYG9wdGlvbnMubWV0YWAgaXMgZ2VuZXJhbHkganVzdCBwYXNzZWQgdG8gdGhlIHBsdWdpbiBhcyB0aGF0IG9iamVjdC5cbiAgICAtIG9wdGlvbnMucGx1Z2luIHsgU3RyaW5nIH0gLSB0aGlzIGlzIHRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gdG8gaGF2ZSBvcGVuIHdoZW4gY2FsbGluZyB0aGUgb3BlbiBmbi4gVGhpcyB3aWxsIGFsc28gdHJpZ2dlciBhIGBQbHVnaW46Om9wZW5gLiBTaW5jZSBtb3N0IG9mIHRoZSBiYXNpYyBmdW5jdGlvbmFsaXR5IGlzIHdyaXR0ZW4gYXMgYSBwbHVnaW4gdGhpcyBjYW4gYmUgdXNlZCB0byBvcGVuIGRlZmF1bHQgdmlld3MuIEFsc28gaWYgbm8gbmFtZSBpcyBnaXZlbiB0aGVuIGl0IGRlZmF1bHRzIHRvIHRoZSBtYWluIGB1cGxvYWQtcGhvdG9gIHBsdWdpbi5cblxuX19yZXR1cm5zX19cblxuLSBQbHVnaW4geyBPYmplY3QgfSAtIHBsdWdpbiB0aGF0IGlzIG9wZW5lZFxuXG5gYGBqYXZhc2NyaXB0XG52YXIgU2tvbGwgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKTtcblxuU2tvbGwub3Blbigge1xuICAgIG1ldGE6IHtcbiAgICAgICAgZGVzY3JpcHRpb246ICdBd2Vzb21lIGNhdHMgYW5kIHBpenphXFwncyBpbiBzcGFjZSdcbiAgICB9LFxuICAgIHBsdWdpbjogJ2dpcGh5LXNlYXJjaCcgIFxufSApOyBcblxuYGBgXG4qL1xuXG5Ta29sbC5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICB2YXIgZGVmYXVsdFBsdWdpbiA9IHRoaXMuZGVmYXVsdHMucGx1Z2luLFxuICAgICAgICBwbHVnaW5OYW1lID0gIG9wdGlvbnMucGx1Z2luIHx8IGRlZmF1bHRQbHVnaW4sXG4gICAgICAgIHBsdWdpbiA9IHRoaXMucGx1Z2luc1sgcGx1Z2luTmFtZSBdIHx8IHRoaXMucGx1Z2luc1sgZGVmYXVsdFBsdWdpbiBdLFxuICAgICAgICBjbG9zZSA9IHRoaXMuY2xvc2UuYmluZCggdGhpcyApO1xuXG4gICAgb3B0aW9ucy5wbHVnaW4gPSBwbHVnaW5OYW1lO1xuICAgIHRoaXMucHJldlBsdWdpbiA9IHRoaXMuY3VycmVudFBsdWdpbjtcbiAgICB0aGlzLmN1cnJlbnRQbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5tZXRhID0gb3B0aW9ucy5tZXRhIHx8IHt9O1xuXG4gICAgLy8gdXBkYXRlIGxpbmtzXG4gICAgdGhpcy5saXN0RWwuaW5uZXJIVE1MID0gJyc7XG5cbiAgICB0aGlzLnBsdWdpbkxpc3QuZm9yRWFjaCggdGhpcy5saXN0RWwuYXBwZW5kQ2hpbGQuYmluZCggdGhpcy5saXN0RWwgKSApO1xuXG4gICAgdGhpcy5lbC5jbGFzc0xpc3QuYWRkKCAnc2hvdycgKTtcbiAgICB0aGlzLnN0YXRlLnZpZXcgPSAxO1xuICAgIC8vIG9wZW4gcGx1Z2luXG4gICAgaWYgKCAhcGx1Z2luICkge1xuICAgICAgICB0aGlzLmVtaXQoICdlcnJvcicsIG5ldyBFcnJvciggJ05vIFBsdWdpbiBpcyBmb3VuZCB3aXRoIHRoZSBuYW1lICcgKyBwbHVnaW5OYW1lICkgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBwbHVnaW4ub3Blbiggb3B0aW9ucy5tZXRhIHx8IHt9LCB0aGlzLCB0aGlzLl9oYW5kbGVQbHVnaW5PcGVuLmJpbmQoIHRoaXMsIG9wdGlvbnMgKSApO1xuICAgIC8vIG5lZWQgdG8gdW5iaW5kIHRoaXNcbiAgICAvLyBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5dXAnLCBmdW5jdGlvbiggZSApIHtcbiAgICAvLyAgICB2YXIgY29kZSA9IGUua2V5Q29kZSB8fCBlLndoaWNoO1xuICAgIC8vICAgICBjbG9zZSgpO1xuICAgIC8vIH0gKTtcblxuICAgIHRoaXMuZW1pdCggJ29wZW4nLCBwbHVnaW4gKTsgXG5cbn07XG5cblxuLypcbiMjIyBTa29sbDo6Y2xvc2VcblxuVGhpcyB3aWxsIHJlbW92ZSB0aGUgYHNob3dgIGZyb20gdGhlIHVwbG9hZGVyIG1vZGFsIGNvbnRhaW5lci4gVGhpcyB3aWxsIGFsc28gdHJpZ2dlciBgUGx1Z2luOjp0ZWFyZG93bmAgdG8gdGhlIGN1cnJlY3QgYWN0aXZlIHBsdWdpbi5cblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICk7XG5cblNrb2xsLm9wZW4oKTtcbmZpbGVVcGxhZGVyLmNsb3NlKCk7XG5cbmlmICggIVNrb2xsLnN0YXRlLnZpZXcgKSB7XG4gICAgY29uc29sZS5sb2coICdTa29sbCBpcyBjbG9zZWQnICk7XG59XG5cbmBgYFxuKi9cblxuU2tvbGwucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG5cbiAgICB0aGlzLmVsLmNsYXNzTGlzdC5yZW1vdmUoICdzaG93JyApO1xuICAgIHRoaXMuc3RhdGUudmlldyA9IDA7XG5cbiAgICB0aGlzLmNvbnRlbnRFbC5pbm5lckhUTUwgPSAnJztcbiAgICBpZiAoIHRoaXMuY3VycmVudFBsdWdpbiAmJiB0eXBlb2YgdGhpcy5jdXJyZW50UGx1Z2luLnRlYXJkb3duID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICB0aGlzLmN1cnJlbnRQbHVnaW4udGVhcmRvd24oKTtcbiAgICAgICAgdGhpcy5jdXJyZW50UGx1Z2luID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLmVtaXQoICdjbG9zZScgKTtcblxufTtcblxuLypcbiMjIyBTa29sbDo6dXBsb2FkXG5cblVwbG9hZCBtZXRob2QgaXMgYSBwcm94eSB0byB0aGUgVXBsb2FkIGFkYXB0ZXIgdGhhdCBzaG91bGQgYmUgcHJvdmlkZWQuIFRoaXMgaXMgdXNlZCBtYWlubHkgdG8gbm9ybWFsaXplIHNvbWUgb2YgdGhlIGV2ZW50IGRhdGEgYWxsb3dpbmcgaXQgdG8gYmUgaW4gYSBjb21tb24gZm9ybWF0IHRoYXQgdXBsb2FkZXIgYWRhcHRlcnMgY2FuIGVhc2lseSBkZWFsIHdpdGguIFRoaXMgaXMgbWFpbmx5IHRvIGJlIHVzZWQgaW5zaWRlIG9mIHBsdWdpbnNcblxuX19wYXJhbXNfX1xuXG4tIHRhcmdldCB7IE9iamVjdCB9IC0gVGhpcyBpcyBhIG9iamVjdCB0aGF0IHdpbGwgaGF2ZSB0aGUga2V5IEZpbGVzIGluIGl0LiBJdCBpcyBzb21ldGhpbmcgc2ltaWxpYXIgdG8gdGhlIGBldmVudC50YXJnZXRgIG9iamVjdCB5b3Ugd291bGQgZ2V0IG9uIGEgY2hhbmdlIGV2ZW50IG9mIGEgZmlsZSB0eXBlIGlucHV0LlxuICAgIC0gdGFyZ2V0LmZpbGVzIHsgQXJyYXkgfSAtIFRoaXMgY2FuIGJlIGEgYEJsb2JgIG9yIGFuIG9iamVjdCB3aXRoIHRoZSBrZXkgYHVybGAgaW5zaWRlIG9mIGl0LiBlZy4gYFt7IHVybDogaHR0cHM6Ly9wYnMudHdpbWcuY29tL3Byb2ZpbGVfaW1hZ2VzLzU0NDAzOTcyODQ2MzM1MTgwOC9Oa29SZEJCTF9iaWdnZXIucG5nIH1dYC4gV2hlbiBjcmVhdGluZyBhbiBldmVudCB0aGlzIHdpbGwgYXR0ZW1wdCB0byBjb252ZXJ0IHRoaXMgdXJsIGludG8gYSBibG9iIGlmIGl0IGlzIGFuIGltYWdlLCBvdGhlcndpc2UgaXQgd2lsbCBqdXN0IHBhc3MgdGhlIG9iamVjdCB0byB0aGUgdXBsb2FkIGFkYXB0ZXIuXG4qL1xuXG5cblNrb2xsLnByb3RvdHlwZS51cGxvYWQgPSBmdW5jdGlvbiggdGFyZ2V0ICkgeyBcblxuICAgIGlmICggdHlwZW9mIHRhcmdldC5maWxlcyAhPT0gJ29iamVjdCcgKSB7IC8vIGRlZmF1bHQgdXBsb2FkIGV2ZW50cyBhcmUgbm90IGEgdHJ1ZSBhcnJheVxuICAgICAgICB0aGlzLmVtaXQoICdlcnJvcicsIG5ldyBFcnJvciggJ3RhcmdldCBwYXNzZWQgdG8gU2tvbGw6OnVwbG9hZCBkb2VzIG5vdCBoYXZlIGZpbGVzIGFycmF5JyApICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiB0aGlzLnVwbG9hZEZuICE9PSAnZnVuY3Rpb24nICkge1xuICAgICAgICAvLyBlcnJvclxuICAgICAgICB0aGlzLmVtaXQoICdlcnJvcicsIG5ldyBFcnJvciggJ05vIHVwbG9hZCBmdW5jdGlvbiBhZGRlZCB1c2luZyBTa29sbDo6dXNlVG9VcGxvYWQnICkgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBjbG9zZSA9IHRoaXMuY2xvc2UuYmluZCggdGhpcyApLFxuICAgICAgICB1cGxvYWRGbiA9IHRoaXMudXBsb2FkRm4sXG4gICAgICAgIGNsb3NlT25VcGxvYWQgPSB0aGlzLmRlZmF1bHRzLmNsb3NlT25VcGxvYWQsXG4gICAgICAgIGVycm9yID0gdGhpcy5lbWl0LmJpbmQoIHRoaXMsICdlcnJvcicgKTtcblxuICAgIHRoaXMuX2NyZWF0ZUV2ZW50KCB0YXJnZXQsIGZ1bmN0aW9uKCBlcnIsIHVwbG9hZEV2ZW50ICkge1xuICAgICAgICBpZiAoIGVyciApIHtcbiAgICAgICAgICAgIGVycm9yKCBlcnIgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVwbG9hZEZuKCB1cGxvYWRFdmVudCB8fCBfZXZlbnQgKTtcbiAgICAgICAgaWYgKCBjbG9zZU9uVXBsb2FkICkgeyAvLyB0aGlzIHNob3VsZCBiZSBjaGFuZ2FibGVcbiAgICAgICAgICAgIGNsb3NlKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9ICk7XG59O1xuXG4vKlxuIyMjIFNrb2xsOjpwcmV2aWV3XG5cbnByZXZpZXcgbWV0aG9kIGlzIGEgZWFzeSB3YXkgdG8gb3BlbiB1cCB0aGUgdXNlIG9yIGNhbmNlbCBkaWFsb2cuIFRoaXMgd2lsbCBvcGVuIHVwIHRoZSBwcmV2aWV3IHBsdWdpbiB0aGF0IGlzIHJlZ2lzdGVyZWQgd2l0aCB0aGUgc3lzdGVtIHRvIHByZXZpZXcgdGhlIHNlbGVjdGlvbi4gXG5cbl9fcGFyYW1zX19cblxuLSB0YXJnZXQgeyBPYmplY3QgfSAtIFRoaXMgaXMgYSBvYmplY3QgdGhhdCB3aWxsIGhhdmUgdGhlIGtleSBGaWxlcyBpbiBpdC4gSXQgaXMgc29tZXRoaW5nIHNpbWlsaWFyIHRvIHRoZSBgZXZlbnQudGFyZ2V0YCBvYmplY3QgeW91IHdvdWxkIGdldCBvbiBhIGNoYW5nZSBldmVudCBvZiBhIGZpbGUgdHlwZSBpbnB1dC5cbiAgICAtIHRhcmdldC5maWxlcyB7IEFycmF5IH0gLSBUaGlzIGNhbiBiZSBhIGBCbG9iYCBvciBhbiBvYmplY3Qgd2l0aCB0aGUga2V5IGB1cmxgIGluc2lkZSBvZiBpdC4gZWcuIGBbeyB1cmw6IGh0dHBzOi8vcGJzLnR3aW1nLmNvbS9wcm9maWxlX2ltYWdlcy81NDQwMzk3Mjg0NjMzNTE4MDgvTmtvUmRCQkxfYmlnZ2VyLnBuZyB9XWAuIFdoZW4gY3JlYXRpbmcgYW4gZXZlbnQgdGhpcyB3aWxsIGF0dGVtcHQgdG8gY29udmVydCB0aGlzIHVybCBpbnRvIGEgYmxvYiBpZiBpdCBpcyBhbiBpbWFnZSwgb3RoZXJ3aXNlIGl0IHdpbGwganVzdCBwYXNzIHRoZSBvYmplY3QgdG8gdGhlIHVwbG9hZCBhZGFwdGVyLlxuKi9cblxuXG5Ta29sbC5wcm90b3R5cGUucHJldmlldyA9IGZ1bmN0aW9uKCB0YXJnZXQgKSB7XG4gICAgXG4gICAgaWYgKCB0eXBlb2YgdGFyZ2V0LmZpbGVzICE9PSAnb2JqZWN0JyApIHsgLy8gZGVmYXVsdCB1cGxvYWQgZXZlbnRzIGFyZSBub3QgYSB0cnVlIGFycmF5XG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAndGFyZ2V0IHBhc3NlZCB0byBTa29sbDo6dXBsb2FkIGRvZXMgbm90IGhhdmUgZmlsZXMgYXJyYXknICkgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBvcGVuID0gdGhpcy5vcGVuLmJpbmQoIHRoaXMgKSxcbiAgICAgICAgbWV0YSA9IHRoaXMubWV0YTtcblxuICAgIHRoaXMuX2NyZWF0ZUV2ZW50KCB0YXJnZXQsIGZ1bmN0aW9uKCBlcnIsIHVwbG9hZEV2ZW50ICkge1xuICAgICAgICBtZXRhLmV2ZW50ID0gdXBsb2FkRXZlbnQ7XG4gICAgICAgIG9wZW4oIHsgXG4gICAgICAgICAgICBtZXRhOiBtZXRhLFxuICAgICAgICAgICAgcGx1Z2luOiAncHJldmlldycgXG4gICAgICAgIH0gKTtcbiAgICB9ICk7XG5cbn07XG5cblxuLypcbl9fcGFyYW1zX19cblxuLSB0YXJnZXQgeyBPYmplY3QgfSAtIFRoaXMgaXMgYSBvYmplY3QgdGhhdCB3aWxsIGhhdmUgdGhlIGtleSBGaWxlcyBpbiBpdC4gSXQgaXMgc29tZXRoaW5nIHNpbWlsaWFyIHRvIHRoZSBgZXZlbnQudGFyZ2V0YCBvYmplY3QgeW91IHdvdWxkIGdldCBvbiBhIGNoYW5nZSBldmVudCBvZiBhIGZpbGUgdHlwZSBpbnB1dC5cbiAgICAtIHRhcmdldC5maWxlcyB7IEFycmF5IH0gLSBUaGlzIGNhbiBiZSBhIGBCbG9iYCBvciBhbiBvYmplY3Qgd2l0aCB0aGUga2V5IGB1cmxgIGluc2lkZSBvZiBpdC4gZWcuIGBbeyB1cmw6IGh0dHBzOi8vcGJzLnR3aW1nLmNvbS9wcm9maWxlX2ltYWdlcy81NDQwMzk3Mjg0NjMzNTE4MDgvTmtvUmRCQkxfYmlnZ2VyLnBuZyB9XWAuIFdoZW4gY3JlYXRpbmcgYW4gZXZlbnQgdGhpcyB3aWxsIGF0dGVtcHQgdG8gY29udmVydCB0aGlzIHVybCBpbnRvIGEgYmxvYiBpZiBpdCBpcyBhbiBpbWFnZSwgb3RoZXJ3aXNlIGl0IHdpbGwganVzdCBwYXNzIHRoZSBvYmplY3QgdG8gdGhlIHVwbG9hZCBhZGFwdGVyLlxuKi9cblxuLypcbiMjIyBTa29sbDo6YWRkUGx1Z2luXG5cblRoaXMgd2lsbCBhZGQgYSBwbHVnaW4gdG8gdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIHBsdWdpbnMuIE1lYW5pbmcgdGhhdCBpdCB3aWxsIGFsc28gYWRkIHRoZSBwbHVnaW4gbmFtZSB0byB0aGUgbGlzdCBvZiBfdGFiYWJsZV8gcGx1Z2lucywgYW5kIHRhcmdldHMgdG8gb3BlbiB3aGVuIG9wZW5pbmcgdGhlIGBTa29sbGAuXG5cbl9fcGFyYW1zX19cblxuLSBwbHVnaW4geyBPYmplY3QgfSAtIEEgYFBsdWdpbmAgb2JqZWN0IHRoYXQgaGFzIGEgbnVtYmVyIG9mIGRpZmZlcm50IGF0dHJpYnV0ZXMgb24gdGhlIHBsdWdpbiB0byBhbGxvdyB0aGUgYFNrb2xsYCB0byByZWFkIGFuZCBpbnRlcmFjdCB3aXRoIHRoZSBwbHVnaW4uIElmIHNvbWUgcmVxdWlyZWQgbWV0aG9kcyBhcmUgbm90IHByb3ZpZGVkIHRoZSBwbHVnaW4gd2lsbCBub3QgYmUgYWRkZWQgYW5kIGFuIGBlcnJvcmAgZXZlbnQgd2lsbCBiZSBlbWl0dGVkIGZyb20gdGhlIFNrb2xsLlxuXG4tIG9wdGlvbnMgeyBPYmplY3QgfSAtIF9PcHRpb25hbF8gQSBvcHRpb25hbCBvYmplY3QgdGhhdCBjYW4gc3BlY2lmeSB0aGUgYmVoYXZpb3IgaW4gd2hpY2ggdGhlIGBTa29sbGAgYmVoYXZlcyB3aXRoIHBsdWdpbi4gXG4gIC0gb3B0aW9ucy5tZW51SXRlbSB7IEJvb2xlYW4gfSAtIF9PcHRpb25hbF8gQSBmbGFnIHRvIHNwZWNpZnkgaWYgdGhlIHBsdWdpbiBzaG91bGQgYmUgbGlua2VkIHRvIGluIGEgbGlzdCBvZiBwbHVnaW5zLlxuXG5fX3JldHVybnNfX1xuXG4tIHBsdWdpbiB7IE9iamVjdCB9IC0gQSBjb3B5IG9mIHRoZSBgUGx1Z2luYCBvYmplY3QgYmFjayB3aXRoIHRoZSBgaXNBZGRlZGAgcHJvcGVydHkgc2V0IHRvIHRydWUgaWYgc3VjY2Vzc2Z1bGwgYWRkZWQgdG8gdGhlIGBTa29sbGBcblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICksXG4gICAgZm9vID0ge1xuICAgICAgICBvcGVuOiBmdW5jdGlvbigpe31cbiAgICB9LFxuICAgIGJhciA9IHtcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKXt9LFxuICAgICAgICB0ZWFyZG93bjogZnVuY3Rpb24oKXt9LFxuICAgICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICAgICAgICBuYW1lOiAnQmFyJ1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwbHVnaW5Gb28gPSBTa29sbC5hZGRQbHVnaW4oIGZvbyApLFxuICAgIHBsdWdpbkJhciA9IFNrb2xsLmFkZFBsdWdpbiggYmFyICk7XG5cbnBsdWdpbkZvby5pc0FkZGVkIC8vIGZhbHNlIC0gbWlzc2luZyBzb21lIHJlcXVpcmVkIG1ldGhvZHNcbnBsdWdpbkJhci5pc0FkZGVkIC8vIHRydWVcbmBgYFxuKi9cblxuU2tvbGwucHJvdG90eXBlLmFkZFBsdWdpbiA9IGZ1bmN0aW9uKCBwbHVnaW4sIG9wdGlvbnMgKSB7XG4gICAgXG4gICAgdmFyIF9wbHVnaW4gPSBtZXJnZSggdHJ1ZSwge30sIHBsdWdpbiB8fCB7fSApO1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYgKCAhU2tvbGwuaXNQbHVnaW4oIHBsdWdpbiApICl7XG4gICAgICAgIF9wbHVnaW4uaXNBZGRlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gX3BsdWdpbjtcbiAgICB9ICBcblxuICAgIHRoaXMucGx1Z2luc1sgX3BsdWdpbi5hdHRyaWJ1dGVzLm5hbWUgXSA9IF9wbHVnaW47XG4gICAgX3BsdWdpbi5pc0FkZGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gX3BsdWdpbjtcblxufTtcblxuLypcbiMjIyBTa29sbDo6dXNlVG9VcGxvYWRcblxuVGhpcyBpcyBhIHdheSB0byBleHRlbmQgdGhlIGZpbGUgdXBsb2FkZXIgdG8gYWxsb3cgZm9yIGN1c3RvbSB3YXlzIHRvIHVwbG9hZCBmaWxlcyB0byB5b3VyIHNlcnZlci4gXG5cbl9fcGFyYW1zX19cblxuLSB1cGxvYWRGbiB7IEZ1bmN0aW9uIH0gLSBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiBldmVyIGFuIGFzc2V0IGlzIGF0dGVtcHRlZCB0byBiZSB1cGxvYWRlZC4gRHVlIHRvIHRoZSBwbHVnZ2FibGl0eSBvZiB0aGlzIG1vZGFsIHRoaXMgY2FuIGJlIGEgbnVtYmVyIG9mIHRoaW5ncyBkZXBlbmRpbmcgb24gdGhlIG5hdHVyZSBvZiB0aGUgcGx1Z2luLiBUaGlzIGNhbiBhbHNvIGJlIHVzZWQgdG8gc2F2ZSBpbmZvcm1hdGlvbiB0byB5b3UgZGF0YWJhc2UgYWJvdXQgdGhlIGRhdGEgYmVpbmcgdXBsb2FkZWQuXG5cbnVwbG9hZEZuIGlzIHBhc3NlZCBhbiBVcGxvYWRFdmVudCBvYmplY3QgdGhhdCBoYXMgYSBudW1iZXIgb2YgaG9va3MgdGhhdCB5b3UgY2FuIHRpZSB5b3VyIHVwbG9hZGVyIGludG8gdG8gYWxsb3cgZm9yIGFuIGludGVyYWN0aXZlIGV4cGVyaWVuY2Ugd2hpbGUgdXBsb2FkaW5nIHBob3Rvcy4gU2VlIGBVcGxvYWRFdmVudGAgb2JqZWN0IHNwZWNpZmljYXRpb24gdG8gc2VlIGhvdyB0byBob29rIGludG8gdGhpcyBmdW5jdGlvbmFsaXR5XG5cbmBgYGphdmFzY3JpcHRcbnZhciBTa29sbCA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5Ta29sbC51c2VUb1VwbG9hZCggZnVuY3Rpb24oIDxVcGxvYWRFdmVudD4gKSB7XG4gICAgdmFyIGZpbGVzID0gZXZlbnQuZmlsZXM7IC8vIHRoaXMgaXMgY29tbWl0aW5nIGZyb20gYSBpbnB1dCBmaWxlIGV2ZW50XG4gICAgLy8gYmxhaCBibGFoIHVwbG9hZFxuICAgIGZlZWRiYWNrRm5zLmRvbmUoe1xuICAgICAgICBmaWxlc1t7IHVybDogJ2h0dHA6Ly9mb28uYmFyL2Jhei5wbmcnIH1dXG4gICAgfSlcbn0gKTtcbmBgYFxuKi9cblxuU2tvbGwucHJvdG90eXBlLnVzZVRvVXBsb2FkID0gZnVuY3Rpb24oIGZuICkge1xuICAgIGlmICggdHlwZW9mIGZuID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICB0aGlzLnVwbG9hZEZuID0gZm47XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmVtaXQoICdlcnJvcicsIG5ldyBFcnJvciggJ3VzZVRvVXBsb2FkIG5lZWRzIHRvIGJlIHBhc3NlZCBhIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBwYXJhbWV0ZXIsICcgKyB0eXBlb2YgZm4gKyAnIGdpdmVuLicgKSApO1xufTtcblxuXG4vLyBzdGFydCBwcml2YXRlIG1ldGhvZHNcblxuU2tvbGwucHJvdG90eXBlLl9jcmVhdGVFdmVudCA9IGZ1bmN0aW9uKCB0YXJnZXQsIGNhbGxiYWNrICkgeyBcblxuICAgIHZhciBfZXZlbnQgPSB7fSxcbiAgICAgICAgZXJyb3IgPSB0aGlzLmVtaXQuYmluZCggdGhpcywgJ2Vycm9yJyApO1xuXG4gICAgX2V2ZW50LmZpbGVzID0gdGFyZ2V0LmZpbGVzO1xuICAgIF9ldmVudC5vcmlnaW5hbEV2ZW50ID0gdGFyZ2V0O1xuXG4gICAgLy8gd2F5cyB0byBnaXZlIGZlZWRiYWNrIHRvIFNrb2xsXG4gICAgX2V2ZW50LmRvbmUgPSB0aGlzLmVtaXQuYmluZCggdGhpcywgJ2RvbmUnICk7XG4gICAgX2V2ZW50LmVycm9yID0gZXJyb3I7XG5cbiAgICBuZXcgVXBsb2FkRXZlbnQoIF9ldmVudCwgY2FsbGJhY2sgKTtcblxufTtcblxuU2tvbGwuaXNQbHVnaW4gPSBmdW5jdGlvbiggcGx1Z2luICkge1xuXG4gICAgaWYgKCAhcGx1Z2luIHx8IHR5cGVvZiBwbHVnaW4gIT09ICdvYmplY3QnICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgcGx1Z2luLm9wZW4gIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHBsdWdpbi50ZWFyZG93biAhPT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICggIXBsdWdpbi5hdHRyaWJ1dGVzICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgcGx1Z2luLmF0dHJpYnV0ZXMubmFtZSAhPT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cblNrb2xsLnBsdWdpblZpc2libGUgPSBmdW5jdGlvbiggcGx1Z2luICkge1xuICAgIHJldHVybiAhcGx1Z2luLmF0dHJpYnV0ZXMuaGlkZTtcbn07XG5cblNrb2xsLm1hcFBsdWdpbnMgPSBmdW5jdGlvbiggcGx1Z2lucyApIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oIHBsdWdpbk5hbWUgKSB7XG4gICAgICAgIHJldHVybiBwbHVnaW5zWyBwbHVnaW5OYW1lIF07XG4gICAgfVxufTtcblxuU2tvbGwucGx1Z2luTGlzdEVsID0gZnVuY3Rpb24oIGN1cnJlbnRQbHVnaW4gKSB7XG5cbiAgICB2YXIgY3VycmVudFBsdWdpbk5hbWUgPSBjdXJyZW50UGx1Z2luLmF0dHJpYnV0ZXMubmFtZTsgXG5cbiAgICByZXR1cm4gZnVuY3Rpb24oIHBsdWdpbiApIHtcbiAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpJyApLFxuICAgICAgICAgICAgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApLFxuICAgICAgICAgICAgbmFtZSA9IHBsdWdpbi5hdHRyaWJ1dGVzLm5hbWU7XG5cbiAgICAgICAgLy8gY29uc2lkZXIgc29tZSB3YXkgdG8gdXNlIGljb25zXG4gICAgICAgIHNwYW4uaW5uZXJUZXh0ID0gbmFtZTtcbiAgICAgICAgZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1wbHVnaW4tbmFtZScsIG5hbWUgKTtcbiAgICAgICAgZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0JywgJ3Nrb2xsLnBsdWdpbi5vcGVuJyApO1xuICAgICAgICBlbC5hcHBlbmRDaGlsZCggc3BhbiApO1xuICAgICAgICBpZiAoIG5hbWUgPT09IGN1cnJlbnRQbHVnaW5OYW1lICkge1xuICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1wbHVnaW4tc2VsZWN0ZWQnLCB0cnVlICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZWw7ICAgICAgICBcbiAgICB9XG5cbn07XG5cblNrb2xsLnByb3RvdHlwZS5faW5pdCA9IGZ1bmN0aW9uKCApIHtcblxuICAgIC8vIHRoaXMuZWwgaXMgYnVpbHQgaW4gdGhlIGNvbnN0cnVjdG9yXG4gICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQuYmluZCggZG9jdW1lbnQsICdkaXYnICk7IFxuXG4gICAgdGhpcy50YWJsZUVsID0gZGl2KCk7XG4gICAgdGhpcy5jZWxsRWwgPSBkaXYoKTtcbiAgICB0aGlzLm1vZGFsRWwgPSBkaXYoKTtcbiAgICB0aGlzLmNvbnRlbnRFbCA9IGRpdigpO1xuICAgIHRoaXMuY2xvc2VFbCA9IGRpdigpO1xuICAgIHRoaXMubGlzdEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3VsJyApO1xuICAgIC8vIGNsYXNzaW5nIHN0cnVjdHVyZVxuICAgIHRoaXMuZWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsLW92ZXJsYXknICk7XG4gICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnLCAnc2tvbGwuY2xvc2UnICk7XG4gICAgdGhpcy50YWJsZUVsLmNsYXNzTGlzdC5hZGQoICdza29sbC1tb2RhbC10YWJsZScgKTsgLy8gdGhpcyBpcyBoZXJlIHRvIGFsbG93IHZlcnRpY2FsIGNlbnRlcmluZ1xuICAgIHRoaXMuY2VsbEVsLmNsYXNzTGlzdC5hZGQoICdza29sbC1tb2RhbC1jZWxsJyApO1xuICAgIHRoaXMuY2xvc2VFbC5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtbW9kYWwtY2xvc2UnICk7XG4gICAgdGhpcy5jbG9zZUVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcsICdza29sbC5jbG9zZScgKTtcbiAgICB0aGlzLm1vZGFsRWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsJyApO1xuICAgIHRoaXMubW9kYWxFbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnLCAnc2tvbGwubW9kYWwuc3RvcFByb3BhZ2F0aW9uJyApO1xuICAgIHRoaXMuY29udGVudEVsLmNsYXNzTGlzdC5hZGQoICdza29sbC1tb2RhbC1jb250ZW50JyApO1xuICAgIHRoaXMubGlzdEVsLmNsYXNzTGlzdC5hZGQoICdza29sbC1tb2RhbC1saXN0JyApO1xuICAgIC8vIGFkZGluZyB0aGVtIGFsbCB0b2dldGhlclxuICAgIHRoaXMuZWwuYXBwZW5kQ2hpbGQoIHRoaXMudGFibGVFbCApO1xuICAgIHRoaXMudGFibGVFbC5hcHBlbmRDaGlsZCggdGhpcy5jZWxsRWwgKTtcbiAgICB0aGlzLmNlbGxFbC5hcHBlbmRDaGlsZCggdGhpcy5tb2RhbEVsICk7XG4gICAgdGhpcy5tb2RhbEVsLmFwcGVuZENoaWxkKCB0aGlzLmxpc3RFbCApO1xuICAgIHRoaXMubW9kYWxFbC5hcHBlbmRDaGlsZCggdGhpcy5jbG9zZUVsICk7XG4gICAgdGhpcy5tb2RhbEVsLmFwcGVuZENoaWxkKCB0aGlzLmNvbnRlbnRFbCApO1xuXG4gICAgLyogSFRNTCByZXBlc2VudGF0aW9uXG4gICAgXG4gICAgPGRpdiBjbGFzcz1cInNrb2xsLW1vZGFsLW92ZXJsYXlcIiA+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJza29sbC1tb2RhbC10YWJsZVwiID5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJza29sbC1tb2RhbC1jZWxsXCIgPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJza29sbC1tb2RhbFwiID5cbiAgICAgICAgICAgICAgICAgICAgPHVsIGNsYXNzPVwic2tvbGwtbW9kYWwtbGlzdFwiPjwvdWw+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJza29sbC1tb2RhbC1jbG9zZVwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2tvbGwtbW9kYWwtY29udGVudFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgICovXG5cbiAgICAvLyBiaW5kIHNvbWUgZXZlbnRzIHRvIGRvbVxuICAgIGVtaXQub24oICdza29sbC5jbG9zZScsIHRoaXMuY2xvc2UuYmluZCggdGhpcyApICk7XG4gICAgZW1pdC5vbiggJ3Nrb2xsLnBsdWdpbi5vcGVuJywgdGhpcy5fb25QbHVnaW5PcGVuLmJpbmQoIHRoaXMgKSApO1xuXG4gICAgLy8gYXR0YWNoIGRlZmF1bHQgcGx1Z2luXG4gICAgdGhpcy5hZGRQbHVnaW4oIHVwbG9hZFBsdWdpbiApO1xuICAgIHRoaXMuYWRkUGx1Z2luKCBwcmV2aWV3UGx1Z2luICk7XG5cbn07XG5cblNrb2xsLnByb3RvdHlwZS5fb25QbHVnaW5PcGVuID0gZnVuY3Rpb24oIGUgKSB7XG4gICAgdmFyIGVsID0gZS5lbWl0VGFyZ2V0O1xuICAgIHRoaXMub3Blbigge1xuICAgICAgICBtZXRhOiB0aGlzLm1ldGEsIFxuICAgICAgICBwbHVnaW46IGVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtcGx1Z2luLW5hbWUnICkgXG4gICAgfSApO1xufTtcblxuU2tvbGwucHJvdG90eXBlLl9oYW5kbGVQbHVnaW5PcGVuID0gZnVuY3Rpb24oIG9wdGlvbnMsIGVyciwgZWwgKSB7XG5cbiAgICB2YXIgZGVmYXVsdFBsdWdpbiA9IHRoaXMuZGVmYXVsdHMucGx1Z2luLFxuICAgICAgICBvcGVuRGVmYXVsdCA9IHRoaXMub3Blbi5iaW5kKCB0aGlzLCBtZXJnZSggb3B0aW9ucywgeyBcbiAgICAgICAgICAgIHBsdWdpbjogZGVmYXVsdFBsdWdpblxuICAgICAgICB9ICkgKTtcblxuICAgIGlmICggdGhpcy5wcmV2UGx1Z2luICkge1xuICAgICAgICB0aGlzLnByZXZQbHVnaW4udGVhcmRvd24oKTtcbiAgICB9XG5cbiAgICBpZiAoIGVyciApIHtcbiAgICAgICAgdGhpcy5lbWl0KCAnZXJyb3InLCBlcnIgKTtcbiAgICAgICAgaWYgKCBvcHRpb25zLnBsdWdpbiAhPT0gZGVmYXVsdFBsdWdpbiApIHtcbiAgICAgICAgICAgIG9wZW5EZWZhdWx0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIGVsID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuaW5uZXJIVE1MID0gZWw7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBlbCA9PT0gJ29iamVjdCcgJiYgZWwudGFnTmFtZSApIHtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKCBlbCApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgb3BlbkRlZmF1bHQoKTsgLy8ganVzdCB0cnkgdG8gb3BlbiBkZWZhdWx0IHdoZW4gbm8gY29udGVudCBpcyBnaXZlblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgU2tvbGwoKTtcbm1vZHVsZS5leHBvcnRzLlNrb2xsID0gU2tvbGw7XG5tb2R1bGUuZXhwb3J0cy5VcGxvYWRFdmVudCA9IFVwbG9hZEV2ZW50O1xubW9kdWxlLmV4cG9ydHMuaW1hZ2VUb0Jsb2IgPSByZXF1aXJlKCAnaW1hZ2UtdG8tYmxvYicgKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCAnZXZlbnRlbWl0dGVyMicgKS5FdmVudEVtaXR0ZXIyO1xuXG4vKlxuICAgIGRlcGVuZGVuY2llc1xuKi9cblxuLyogYmluZGluZyAqL1xudmFyIGJpbmRpbmdNZXRob2QgPSB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciA/ICdhZGRFdmVudExpc3RlbmVyJyA6ICdhdHRhY2hFdmVudCc7XG52YXIgZXZlbnRQcmVmaXggPSBiaW5kaW5nTWV0aG9kICE9PSAnYWRkRXZlbnRMaXN0ZW5lcicgPyAnb24nIDogJyc7XG5cbmZ1bmN0aW9uIGJpbmQoIGVsLCB0eXBlLCBmbiwgY2FwdHVyZSApIHtcbiAgICBlbFsgYmluZGluZ01ldGhvZCBdKCBldmVudFByZWZpeCArIHR5cGUsIGZuLCBjYXB0dXJlIHx8IGZhbHNlICk7XG4gICAgcmV0dXJuIGZuO1xufVxuXG4vKiBtYXRjaGluZyAqL1xudmFyIHZlbmRvck1hdGNoID0gRWxlbWVudC5wcm90b3R5cGUubWF0Y2hlcyB8fCBFbGVtZW50LnByb3RvdHlwZS53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHwgRWxlbWVudC5wcm90b3R5cGUubW96TWF0Y2hlc1NlbGVjdG9yIHx8IEVsZW1lbnQucHJvdG90eXBlLm1zTWF0Y2hlc1NlbGVjdG9yIHx8IEVsZW1lbnQucHJvdG90eXBlLm9NYXRjaGVzU2VsZWN0b3I7XG5cbmZ1bmN0aW9uIG1hdGNoZXMoIGVsLCBzZWxlY3RvciApIHtcbiAgICBpZiAoICFlbCB8fCBlbC5ub2RlVHlwZSAhPT0gMSApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoIHZlbmRvck1hdGNoICkge1xuICAgICAgICByZXR1cm4gdmVuZG9yTWF0Y2guY2FsbCggZWwsIHNlbGVjdG9yICk7XG4gICAgfVxuICAgIHZhciBub2RlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yLCBlbC5wYXJlbnROb2RlICk7XG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgIGlmICggbm9kZXNbIGkgXSA9PSBlbCApIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAgXG4gICAgICAgIH0gXG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuLyogY2xvc2VzdCAqL1xuXG5mdW5jdGlvbiBjbG9zZXN0KCBlbGVtZW50LCBzZWxlY3RvciwgY2hlY2tTZWxmLCByb290ICkge1xuICAgIGVsZW1lbnQgPSBjaGVja1NlbGYgPyB7cGFyZW50Tm9kZTogZWxlbWVudH0gOiBlbGVtZW50O1xuXG4gICAgcm9vdCA9IHJvb3QgfHwgZG9jdW1lbnQ7XG5cbiAgICAvKiBNYWtlIHN1cmUgYGVsZW1lbnQgIT09IGRvY3VtZW50YCBhbmQgYGVsZW1lbnQgIT0gbnVsbGBcbiAgICAgICBvdGhlcndpc2Ugd2UgZ2V0IGFuIGlsbGVnYWwgaW52b2NhdGlvbiAqL1xuICAgIHdoaWxlICggKCBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlICkgJiYgZWxlbWVudCAhPT0gZG9jdW1lbnQgKSB7XG4gICAgICAgIGlmICggbWF0Y2hlcyggZWxlbWVudCwgc2VsZWN0b3IgKSApIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLyogQWZ0ZXIgYG1hdGNoZXNgIG9uIHRoZSBlZGdlIGNhc2UgdGhhdFxuICAgICAgICAgICB0aGUgc2VsZWN0b3IgbWF0Y2hlcyB0aGUgcm9vdFxuICAgICAgICAgICAod2hlbiB0aGUgcm9vdCBpcyBub3QgdGhlIGRvY3VtZW50KSAqL1xuICAgICAgICBpZiAoZWxlbWVudCA9PT0gcm9vdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKlxuICAgIGVuZCBkZXBlbmRlbmNpZXNcbiovXG5cbmZ1bmN0aW9uIEVtaXQoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIEV2ZW50RW1pdHRlcjIuY2FsbCggc2VsZiApO1xuXG4gICAgc2VsZi52YWxpZGF0b3JzID0gW107XG4gICAgc2VsZi50b3VjaE1vdmVEZWx0YSA9IDEwO1xuICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBudWxsO1xuXG4gICAgYmluZCggZG9jdW1lbnQsICd0b3VjaHN0YXJ0Jywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ3RvdWNobW92ZScsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICd0b3VjaGVuZCcsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICdjbGljaycsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICdpbnB1dCcsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG4gICAgYmluZCggZG9jdW1lbnQsICdzdWJtaXQnLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xufVxuXG5FbWl0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIEV2ZW50RW1pdHRlcjIucHJvdG90eXBlICk7XG5cbmZ1bmN0aW9uIHQoKSB7XG4gICAgcmV0dXJuIHRydWU7XG59XG5mdW5jdGlvbiBmKCkge1xuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0VG91Y2hEZWx0YSggZXZlbnQsIGluaXRpYWwgKSB7XG4gICAgdmFyIGRlbHRhWCA9ICggZXZlbnQudG91Y2hlc1sgMCBdLnBhZ2VYIC0gaW5pdGlhbC54ICk7XG4gICAgdmFyIGRlbHRhWSA9ICggZXZlbnQudG91Y2hlc1sgMCBdLnBhZ2VZIC0gaW5pdGlhbC55ICk7XG4gICAgcmV0dXJuIE1hdGguc3FydCggKCBkZWx0YVggKiBkZWx0YVggKSArICggZGVsdGFZICogZGVsdGFZICkgKTtcbn1cblxuRW1pdC5wcm90b3R5cGUuaGFuZGxlRXZlbnQgPSBmdW5jdGlvbiggZXZlbnQgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCB0eXBlb2YoIGV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkICkgPT0gJ3VuZGVmaW5lZCcgKSB7XG4gICAgICAgIGV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkID0gZjtcbiAgICB9XG5cbiAgICB2YXIgdG91Y2hlcyA9IGV2ZW50LnRvdWNoZXM7XG4gICAgdmFyIGRlbHRhID0gLTE7XG4gICAgc3dpdGNoICggZXZlbnQudHlwZSApIHtcbiAgICAgICAgY2FzZSAndG91Y2hzdGFydCc6XG4gICAgICAgICAgICBzZWxmLmluaXRpYWxUb3VjaFBvaW50ID0gc2VsZi5sYXN0VG91Y2hQb2ludCA9IHtcbiAgICAgICAgICAgICAgICB4OiB0b3VjaGVzICYmIHRvdWNoZXMubGVuZ3RoID8gdG91Y2hlc1sgMCBdLnBhZ2VYIDogMCxcbiAgICAgICAgICAgICAgICB5OiB0b3VjaGVzICYmIHRvdWNoZXMubGVuZ3RoID8gdG91Y2hlc1sgMCBdLnBhZ2VZIDogMFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAndG91Y2htb3ZlJzpcbiAgICAgICAgICAgIGlmICggdG91Y2hlcyAmJiB0b3VjaGVzLmxlbmd0aCAmJiBzZWxmLmluaXRpYWxUb3VjaFBvaW50ICkge1xuICAgICAgICAgICAgICAgIGRlbHRhID0gZ2V0VG91Y2hEZWx0YSggZXZlbnQsIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgKTtcbiAgICAgICAgICAgICAgICBpZiAoIGRlbHRhID4gc2VsZi50b3VjaE1vdmVEZWx0YSApIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5pbml0aWFsVG91Y2hQb2ludCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2VsZi5sYXN0VG91Y2hQb2ludCA9IHtcbiAgICAgICAgICAgICAgICAgICAgeDogdG91Y2hlc1sgMCBdLnBhZ2VYLFxuICAgICAgICAgICAgICAgICAgICB5OiB0b3VjaGVzWyAwIF0ucGFnZVlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdjbGljayc6XG4gICAgICAgIGNhc2UgJ3RvdWNoZW5kJzpcbiAgICAgICAgY2FzZSAnaW5wdXQnOlxuICAgICAgICBjYXNlICdzdWJtaXQnOlxuICAgICAgICAgICAgLy8gZWF0IGFueSBsYXRlLWZpcmluZyBjbGljayBldmVudHMgb24gdG91Y2ggZGV2aWNlc1xuICAgICAgICAgICAgaWYgKCBldmVudC50eXBlID09PSAnY2xpY2snICYmIHNlbGYubGFzdFRvdWNoUG9pbnQgKSB7XG4gICAgICAgICAgICAgICAgaWYgKCBldmVudC50b3VjaGVzICYmIGV2ZW50LnRvdWNoZXMubGVuZ3RoICkge1xuICAgICAgICAgICAgICAgICAgICBkZWx0YSA9IGdldFRvdWNoRGVsdGEoIGV2ZW50LCBzZWxmLmxhc3RUb3VjaFBvaW50ICk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggZGVsdGEgPCBzZWxmLnRvdWNoTW92ZURlbHRhICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBoYW5kbGUgY2FuY2VsaW5nIHRvdWNoZXMgdGhhdCBoYXZlIG1vdmVkIHRvbyBtdWNoXG4gICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgPT09ICd0b3VjaGVuZCcgJiYgIXNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2VsZWN0b3IgPSAnW2RhdGEtZW1pdF0nO1xuICAgICAgICAgICAgdmFyIG9yaWdpbmFsRWxlbWVudCA9IGV2ZW50LnRhcmdldCB8fCBldmVudC5zcmNFbGVtZW50O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBpZiBpdCdzIGEgbGluayBhbmQgaXQgaGFzIG5vIGVtaXQgYXR0cmlidXRlLCBhbGxvdyB0aGUgZXZlbnQgdG8gcGFzc1xuICAgICAgICAgICAgaWYgKCAhb3JpZ2luYWxFbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcgKSAmJiAoIG9yaWdpbmFsRWxlbWVudC50YWdOYW1lID09PSAnQScgfHwgb3JpZ2luYWxFbGVtZW50LnRhZ05hbWUgPT09ICdCVVRUT04nIHx8IG9yaWdpbmFsRWxlbWVudC50YWdOYW1lID09PSAnSU5QVVQnICkgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgZm9yY2VBbGxvd0RlZmF1bHQgPSBvcmlnaW5hbEVsZW1lbnQudGFnTmFtZSA9PSAnSU5QVVQnICYmICggb3JpZ2luYWxFbGVtZW50LnR5cGUgPT0gJ2NoZWNrYm94JyB8fCBvcmlnaW5hbEVsZW1lbnQudHlwZSA9PSAncmFkaW8nICk7XG4gICAgICAgICAgICB2YXIgZWwgPSBjbG9zZXN0KCBvcmlnaW5hbEVsZW1lbnQsIHNlbGVjdG9yLCB0cnVlLCBkb2N1bWVudCApO1xuXG4gICAgICAgICAgICBpZiAoIGVsICkge1xuICAgICAgICAgICAgICAgIHZhciBkZXB0aCA9IC0xO1xuICAgICAgICAgICAgICAgIHdoaWxlICggZWwgJiYgIWV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkKCkgJiYgKytkZXB0aCA8IDEwMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbGlkYXRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoIHZhciB2YWxpZGF0b3JJbmRleCA9IDA7IHZhbGlkYXRvckluZGV4IDwgc2VsZi52YWxpZGF0b3JzLmxlbmd0aDsgKyt2YWxpZGF0b3JJbmRleCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggIXNlbGYudmFsaWRhdG9yc1sgdmFsaWRhdG9ySW5kZXggXS5jYWxsKCB0aGlzLCBlbCwgZXZlbnQgKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGVhdCB0aGUgZXZlbnQgaWYgYSB2YWxpZGF0b3IgZmFpbGVkXG4gICAgICAgICAgICAgICAgICAgIGlmICggIXZhbGlkYXRlZCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YoIGV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkICkgIT0gJ2Z1bmN0aW9uJyB8fCAhZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQoKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCA9IHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YoIHNlbGYudmFsaWRhdGUgKSA9PSAnZnVuY3Rpb24nICYmICFzZWxmLnZhbGlkYXRlLmNhbGwoIHNlbGYsIGVsICkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICggZWwudGFnTmFtZSA9PSAnRk9STScgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgIT0gJ3N1Ym1pdCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBjbG9zZXN0KCBlbCwgc2VsZWN0b3IsIGZhbHNlLCBkb2N1bWVudCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKCBlbC50YWdOYW1lID09ICdJTlBVVCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICEoIGVsLnR5cGUgPT0gJ3N1Ym1pdCcgfHwgZWwudHlwZSA9PSAnY2hlY2tib3gnIHx8IGVsLnR5cGUgPT0gJ3JhZGlvJyB8fCBlbC50eXBlID09ICdmaWxlJyApICYmIGV2ZW50LnR5cGUgIT0gJ2lucHV0JyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoIGVsLnRhZ05hbWUgPT0gJ1NFTEVDVCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgIT0gJ2lucHV0JyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBldmVudC5lbWl0VGFyZ2V0ID0gZWw7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2VtaXQoIGVsLCBldmVudCwgZm9yY2VBbGxvd0RlZmF1bHQgKTtcbiAgICAgICAgICAgICAgICAgICAgZWwgPSBjbG9zZXN0KCBlbCwgc2VsZWN0b3IsIGZhbHNlLCBkb2N1bWVudCApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICggZGVwdGggPj0gMTAwICkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoICdFeGNlZWRlZCBkZXB0aCBsaW1pdCBmb3IgRW1pdCBjYWxscy4nICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5lbWl0KCAndW5oYW5kbGVkJywgZXZlbnQgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VsZi5pbml0aWFsVG91Y2hQb2ludCA9IG51bGw7XG5cbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbn07XG5cbkVtaXQucHJvdG90eXBlLl9lbWl0ID0gZnVuY3Rpb24oIGVsZW1lbnQsIGV2ZW50LCBmb3JjZURlZmF1bHQgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBvcHRpb25TdHJpbmcgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdC1vcHRpb25zJyApO1xuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgdmFyIGlnbm9yZVN0cmluZyA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0LWlnbm9yZScgKTtcbiAgICB2YXIgaTtcblxuICAgIGlmICggaWdub3JlU3RyaW5nICYmIGlnbm9yZVN0cmluZy5sZW5ndGggKSB7XG4gICAgICAgIHZhciBpZ25vcmVkRXZlbnRzID0gaWdub3JlU3RyaW5nLnRvTG93ZXJDYXNlKCkuc3BsaXQoICcgJyApO1xuICAgICAgICBmb3IgKCBpID0gMDsgaSA8IGlnbm9yZWRFdmVudHMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgPT0gaWdub3JlZEV2ZW50c1sgaSBdICkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICggb3B0aW9uU3RyaW5nICYmIG9wdGlvblN0cmluZy5sZW5ndGggKSB7XG4gICAgICAgIHZhciBvcHRzID0gb3B0aW9uU3RyaW5nLnRvTG93ZXJDYXNlKCkuc3BsaXQoICcgJyApO1xuICAgICAgICBmb3IgKCBpID0gMDsgaSA8IG9wdHMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgICAgICBvcHRpb25zWyBvcHRzWyBpIF0gXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoICFmb3JjZURlZmF1bHQgJiYgIW9wdGlvbnMuYWxsb3dkZWZhdWx0ICkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIGlmICggIW9wdGlvbnMuYWxsb3dwcm9wYWdhdGUgKSB7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICAgICAgaWYgKCB0eXBlb2YoIGV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkICkgIT0gJ2Z1bmN0aW9uJyB8fCAhZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQoKSApIHtcbiAgICAgICAgICAgIGV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkID0gdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBlbWlzc2lvbkxpc3QgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcgKTtcbiAgICBpZiAoICFlbWlzc2lvbkxpc3QgKSB7XG4gICAgICAgIC8vIGFsbG93IGZvciBlbXB0eSBiZWhhdmlvcnMgdGhhdCBjYXRjaCBldmVudHNcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBlbWlzc2lvbnMgPSBlbWlzc2lvbkxpc3Quc3BsaXQoICcsJyApO1xuICAgIGlmICggb3B0aW9ucy5kZWJvdW5jZSApIHtcbiAgICAgICAgc2VsZi50aW1lb3V0cyA9IHNlbGYudGltZW91dHMgfHwge307XG4gICAgICAgIGlmICggc2VsZi50aW1lb3V0c1sgZWxlbWVudCBdICkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KCBzZWxmLnRpbWVvdXRzWyBlbGVtZW50IF0gKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgICAgIHZhciBfZW1pc3Npb25zID0gZW1pc3Npb25zO1xuICAgICAgICAgICAgdmFyIF9ldmVudCA9IGV2ZW50O1xuICAgICAgICAgICAgc2VsZi50aW1lb3V0c1sgZWxlbWVudCBdID0gc2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgX2VtaXNzaW9ucy5mb3JFYWNoKCBmdW5jdGlvbiggZW1pc3Npb24gKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuZW1pdCggZW1pc3Npb24sIF9ldmVudCApO1xuICAgICAgICAgICAgICAgIH0gKTtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoIHNlbGYudGltZW91dHNbIF9lbGVtZW50IF0gKTtcbiAgICAgICAgICAgICAgICBzZWxmLnRpbWVvdXRzWyBfZWxlbWVudCBdID0gbnVsbDtcbiAgICAgICAgICAgIH0sIDI1MCApO1xuICAgICAgICB9ICkoKTtcblxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGVtaXNzaW9ucy5mb3JFYWNoKCBmdW5jdGlvbiggZW1pc3Npb24gKSB7XG4gICAgICAgIHNlbGYuZW1pdCggZW1pc3Npb24sIGV2ZW50ICk7XG4gICAgfSApO1xufTtcblxuRW1pdC5wcm90b3R5cGUuYWRkVmFsaWRhdG9yID0gZnVuY3Rpb24oIHZhbGlkYXRvciApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgZm91bmQgPSBmYWxzZTtcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBzZWxmLnZhbGlkYXRvcnMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgIGlmICggc2VsZi52YWxpZGF0b3JzWyBpIF0gPT0gdmFsaWRhdG9yICkge1xuICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIGZvdW5kICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgc2VsZi52YWxpZGF0b3JzLnB1c2goIHZhbGlkYXRvciApO1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuRW1pdC5wcm90b3R5cGUucmVtb3ZlVmFsaWRhdG9yID0gZnVuY3Rpb24oIHZhbGlkYXRvciApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgZm91bmQgPSBmYWxzZTtcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBzZWxmLnZhbGlkYXRvcnMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgIGlmICggc2VsZi52YWxpZGF0b3JzWyBpIF0gPT0gdmFsaWRhdG9yICkge1xuICAgICAgICAgICAgc2VsZi52YWxpZGF0b3JzLnNwbGljZSggaSwgMSApO1xuICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZm91bmQ7XG59O1xuXG5FbWl0LnNpbmdsZXRvbiA9IEVtaXQuc2luZ2xldG9uIHx8IG5ldyBFbWl0KCk7XG5FbWl0LnNpbmdsZXRvbi5FbWl0ID0gRW1pdDtcblxubW9kdWxlLmV4cG9ydHMgPSBFbWl0LnNpbmdsZXRvbjsiLCIvKiFcbiAqIEV2ZW50RW1pdHRlcjJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9oaWoxbngvRXZlbnRFbWl0dGVyMlxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMyBoaWoxbnhcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuOyFmdW5jdGlvbih1bmRlZmluZWQpIHtcblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgPyBBcnJheS5pc0FycmF5IDogZnVuY3Rpb24gX2lzQXJyYXkob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCI7XG4gIH07XG4gIHZhciBkZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbiAgZnVuY3Rpb24gaW5pdCgpIHtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBpZiAodGhpcy5fY29uZikge1xuICAgICAgY29uZmlndXJlLmNhbGwodGhpcywgdGhpcy5fY29uZik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY29uZmlndXJlKGNvbmYpIHtcbiAgICBpZiAoY29uZikge1xuXG4gICAgICB0aGlzLl9jb25mID0gY29uZjtcblxuICAgICAgY29uZi5kZWxpbWl0ZXIgJiYgKHRoaXMuZGVsaW1pdGVyID0gY29uZi5kZWxpbWl0ZXIpO1xuICAgICAgY29uZi5tYXhMaXN0ZW5lcnMgJiYgKHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBjb25mLm1heExpc3RlbmVycyk7XG4gICAgICBjb25mLndpbGRjYXJkICYmICh0aGlzLndpbGRjYXJkID0gY29uZi53aWxkY2FyZCk7XG4gICAgICBjb25mLm5ld0xpc3RlbmVyICYmICh0aGlzLm5ld0xpc3RlbmVyID0gY29uZi5uZXdMaXN0ZW5lcik7XG5cbiAgICAgIGlmICh0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJUcmVlID0ge307XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gRXZlbnRFbWl0dGVyKGNvbmYpIHtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICB0aGlzLm5ld0xpc3RlbmVyID0gZmFsc2U7XG4gICAgY29uZmlndXJlLmNhbGwodGhpcywgY29uZik7XG4gIH1cblxuICAvL1xuICAvLyBBdHRlbnRpb24sIGZ1bmN0aW9uIHJldHVybiB0eXBlIG5vdyBpcyBhcnJheSwgYWx3YXlzICFcbiAgLy8gSXQgaGFzIHplcm8gZWxlbWVudHMgaWYgbm8gYW55IG1hdGNoZXMgZm91bmQgYW5kIG9uZSBvciBtb3JlXG4gIC8vIGVsZW1lbnRzIChsZWFmcykgaWYgdGhlcmUgYXJlIG1hdGNoZXNcbiAgLy9cbiAgZnVuY3Rpb24gc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCBpKSB7XG4gICAgaWYgKCF0cmVlKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHZhciBsaXN0ZW5lcnM9W10sIGxlYWYsIGxlbiwgYnJhbmNoLCB4VHJlZSwgeHhUcmVlLCBpc29sYXRlZEJyYW5jaCwgZW5kUmVhY2hlZCxcbiAgICAgICAgdHlwZUxlbmd0aCA9IHR5cGUubGVuZ3RoLCBjdXJyZW50VHlwZSA9IHR5cGVbaV0sIG5leHRUeXBlID0gdHlwZVtpKzFdO1xuICAgIGlmIChpID09PSB0eXBlTGVuZ3RoICYmIHRyZWUuX2xpc3RlbmVycykge1xuICAgICAgLy9cbiAgICAgIC8vIElmIGF0IHRoZSBlbmQgb2YgdGhlIGV2ZW50KHMpIGxpc3QgYW5kIHRoZSB0cmVlIGhhcyBsaXN0ZW5lcnNcbiAgICAgIC8vIGludm9rZSB0aG9zZSBsaXN0ZW5lcnMuXG4gICAgICAvL1xuICAgICAgaWYgKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gW3RyZWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZWFmID0gMCwgbGVuID0gdHJlZS5fbGlzdGVuZXJzLmxlbmd0aDsgbGVhZiA8IGxlbjsgbGVhZisrKSB7XG4gICAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnNbbGVhZl0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbdHJlZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChjdXJyZW50VHlwZSA9PT0gJyonIHx8IGN1cnJlbnRUeXBlID09PSAnKionKSB8fCB0cmVlW2N1cnJlbnRUeXBlXSkge1xuICAgICAgLy9cbiAgICAgIC8vIElmIHRoZSBldmVudCBlbWl0dGVkIGlzICcqJyBhdCB0aGlzIHBhcnRcbiAgICAgIC8vIG9yIHRoZXJlIGlzIGEgY29uY3JldGUgbWF0Y2ggYXQgdGhpcyBwYXRjaFxuICAgICAgLy9cbiAgICAgIGlmIChjdXJyZW50VHlwZSA9PT0gJyonKSB7XG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzEpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcbiAgICAgIH0gZWxzZSBpZihjdXJyZW50VHlwZSA9PT0gJyoqJykge1xuICAgICAgICBlbmRSZWFjaGVkID0gKGkrMSA9PT0gdHlwZUxlbmd0aCB8fCAoaSsyID09PSB0eXBlTGVuZ3RoICYmIG5leHRUeXBlID09PSAnKicpKTtcbiAgICAgICAgaWYoZW5kUmVhY2hlZCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICAvLyBUaGUgbmV4dCBlbGVtZW50IGhhcyBhIF9saXN0ZW5lcnMsIGFkZCBpdCB0byB0aGUgaGFuZGxlcnMuXG4gICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIHR5cGVMZW5ndGgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBpZihicmFuY2ggPT09ICcqJyB8fCBicmFuY2ggPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgaWYodHJlZVticmFuY2hdLl9saXN0ZW5lcnMgJiYgIWVuZFJlYWNoZWQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCB0eXBlTGVuZ3RoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsyKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBObyBtYXRjaCBvbiB0aGlzIG9uZSwgc2hpZnQgaW50byB0aGUgdHJlZSBidXQgbm90IGluIHRoZSB0eXBlIGFycmF5LlxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gICAgICB9XG5cbiAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2N1cnJlbnRUeXBlXSwgaSsxKSk7XG4gICAgfVxuXG4gICAgeFRyZWUgPSB0cmVlWycqJ107XG4gICAgaWYgKHhUcmVlKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgdGhlIGxpc3RlbmVyIHRyZWUgd2lsbCBhbGxvdyBhbnkgbWF0Y2ggZm9yIHRoaXMgcGFydCxcbiAgICAgIC8vIHRoZW4gcmVjdXJzaXZlbHkgZXhwbG9yZSBhbGwgYnJhbmNoZXMgb2YgdGhlIHRyZWVcbiAgICAgIC8vXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHhUcmVlLCBpKzEpO1xuICAgIH1cblxuICAgIHh4VHJlZSA9IHRyZWVbJyoqJ107XG4gICAgaWYoeHhUcmVlKSB7XG4gICAgICBpZihpIDwgdHlwZUxlbmd0aCkge1xuICAgICAgICBpZih4eFRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIC8vIElmIHdlIGhhdmUgYSBsaXN0ZW5lciBvbiBhICcqKicsIGl0IHdpbGwgY2F0Y2ggYWxsLCBzbyBhZGQgaXRzIGhhbmRsZXIuXG4gICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQnVpbGQgYXJyYXlzIG9mIG1hdGNoaW5nIG5leHQgYnJhbmNoZXMgYW5kIG90aGVycy5cbiAgICAgICAgZm9yKGJyYW5jaCBpbiB4eFRyZWUpIHtcbiAgICAgICAgICBpZihicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB4eFRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xuICAgICAgICAgICAgICAvLyBXZSBrbm93IHRoZSBuZXh0IGVsZW1lbnQgd2lsbCBtYXRjaCwgc28ganVtcCB0d2ljZS5cbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IGN1cnJlbnRUeXBlKSB7XG4gICAgICAgICAgICAgIC8vIEN1cnJlbnQgbm9kZSBtYXRjaGVzLCBtb3ZlIGludG8gdGhlIHRyZWUuXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaCA9IHt9O1xuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaFticmFuY2hdID0geHhUcmVlW2JyYW5jaF07XG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeyAnKionOiBpc29sYXRlZEJyYW5jaCB9LCBpKzEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgIC8vIFdlIGhhdmUgcmVhY2hlZCB0aGUgZW5kIGFuZCBzdGlsbCBvbiBhICcqKidcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xuICAgICAgfSBlbHNlIGlmKHh4VHJlZVsnKiddICYmIHh4VHJlZVsnKiddLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbJyonXSwgdHlwZUxlbmd0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpc3RlbmVycztcbiAgfVxuXG4gIGZ1bmN0aW9uIGdyb3dMaXN0ZW5lclRyZWUodHlwZSwgbGlzdGVuZXIpIHtcblxuICAgIHR5cGUgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcblxuICAgIC8vXG4gICAgLy8gTG9va3MgZm9yIHR3byBjb25zZWN1dGl2ZSAnKionLCBpZiBzbywgZG9uJ3QgYWRkIHRoZSBldmVudCBhdCBhbGwuXG4gICAgLy9cbiAgICBmb3IodmFyIGkgPSAwLCBsZW4gPSB0eXBlLmxlbmd0aDsgaSsxIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmKHR5cGVbaV0gPT09ICcqKicgJiYgdHlwZVtpKzFdID09PSAnKionKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdHJlZSA9IHRoaXMubGlzdGVuZXJUcmVlO1xuICAgIHZhciBuYW1lID0gdHlwZS5zaGlmdCgpO1xuXG4gICAgd2hpbGUgKG5hbWUpIHtcblxuICAgICAgaWYgKCF0cmVlW25hbWVdKSB7XG4gICAgICAgIHRyZWVbbmFtZV0gPSB7fTtcbiAgICAgIH1cblxuICAgICAgdHJlZSA9IHRyZWVbbmFtZV07XG5cbiAgICAgIGlmICh0eXBlLmxlbmd0aCA9PT0gMCkge1xuXG4gICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gbGlzdGVuZXI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZih0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gW3RyZWUuX2xpc3RlbmVycywgbGlzdGVuZXJdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzQXJyYXkodHJlZS5fbGlzdGVuZXJzKSkge1xuXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMud2FybmVkKSB7XG5cbiAgICAgICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG0gPiAwICYmIHRyZWUuX2xpc3RlbmVycy5sZW5ndGggPiBtKSB7XG5cbiAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLndhcm5lZCA9IHRydWU7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5sZW5ndGgpO1xuICAgICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgbmFtZSA9IHR5cGUuc2hpZnQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuXG4gIC8vIDEwIGxpc3RlbmVycyBhcmUgYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaFxuICAvLyBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbiAgLy9cbiAgLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4gIC8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZGVsaW1pdGVyID0gJy4nO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG4gICAgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IG47XG4gICAgaWYgKCF0aGlzLl9jb25mKSB0aGlzLl9jb25mID0ge307XG4gICAgdGhpcy5fY29uZi5tYXhMaXN0ZW5lcnMgPSBuO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZXZlbnQgPSAnJztcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pIHtcbiAgICB0aGlzLm1hbnkoZXZlbnQsIDEsIGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm1hbnkgPSBmdW5jdGlvbihldmVudCwgdHRsLCBmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbWFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdGVuZXIoKSB7XG4gICAgICBpZiAoLS10dGwgPT09IDApIHtcbiAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgbGlzdGVuZXIuX29yaWdpbiA9IGZuO1xuXG4gICAgdGhpcy5vbihldmVudCwgbGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIHR5cGUgPSBhcmd1bWVudHNbMF07XG5cbiAgICBpZiAodHlwZSA9PT0gJ25ld0xpc3RlbmVyJyAmJiAhdGhpcy5uZXdMaXN0ZW5lcikge1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgfVxuXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSAqX2FsbCogZnVuY3Rpb25zIGFuZCBpbnZva2UgdGhlbS5cbiAgICBpZiAodGhpcy5fYWxsKSB7XG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKGkgPSAwLCBsID0gdGhpcy5fYWxsLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgICAgdGhpcy5fYWxsW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuXG4gICAgICBpZiAoIXRoaXMuX2FsbCAmJlxuICAgICAgICAhdGhpcy5fZXZlbnRzLmVycm9yICYmXG4gICAgICAgICEodGhpcy53aWxkY2FyZCAmJiB0aGlzLmxpc3RlbmVyVHJlZS5lcnJvcikpIHtcblxuICAgICAgICBpZiAoYXJndW1lbnRzWzFdIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBhcmd1bWVudHNbMV07IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5jYXVnaHQsIHVuc3BlY2lmaWVkICdlcnJvcicgZXZlbnQuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlcjtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIGhhbmRsZXIgPSBbXTtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlciwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSlcbiAgICAgICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gc2xvd2VyXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBlbHNlIGlmIChoYW5kbGVyKSB7XG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICAgIHZhciBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAobGlzdGVuZXJzLmxlbmd0aCA+IDApIHx8ICEhdGhpcy5fYWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiAhIXRoaXMuX2FsbDtcbiAgICB9XG5cbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcblxuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5vbkFueSh0eXBlKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignb24gb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PSBcIm5ld0xpc3RlbmVyc1wiISBCZWZvcmVcbiAgICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyc1wiLlxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICBncm93TGlzdGVuZXJUcmVlLmNhbGwodGhpcywgdHlwZSwgbGlzdGVuZXIpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHtcbiAgICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gICAgfVxuICAgIGVsc2UgaWYodHlwZW9mIHRoaXMuX2V2ZW50c1t0eXBlXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xuICAgICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG5cbiAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuXG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25BbnkgPSBmdW5jdGlvbihmbikge1xuXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbkFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgaWYoIXRoaXMuX2FsbCkge1xuICAgICAgdGhpcy5fYWxsID0gW107XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBmdW5jdGlvbiB0byB0aGUgZXZlbnQgbGlzdGVuZXIgY29sbGVjdGlvbi5cbiAgICB0aGlzLl9hbGwucHVzaChmbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub247XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlTGlzdGVuZXIgb25seSB0YWtlcyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlcnMsbGVhZnM9W107XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBkb2VzIG5vdCB1c2UgbGlzdGVuZXJzKCksIHNvIG5vIHNpZGUgZWZmZWN0IG9mIGNyZWF0aW5nIF9ldmVudHNbdHlwZV1cbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcbiAgICAgIGhhbmRsZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgbGVhZnMucHVzaCh7X2xpc3RlbmVyczpoYW5kbGVyc30pO1xuICAgIH1cblxuICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xuICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XG4gICAgICBoYW5kbGVycyA9IGxlYWYuX2xpc3RlbmVycztcbiAgICAgIGlmIChpc0FycmF5KGhhbmRsZXJzKSkge1xuXG4gICAgICAgIHZhciBwb3NpdGlvbiA9IC0xO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChoYW5kbGVyc1tpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5saXN0ZW5lciAmJiBoYW5kbGVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0uX29yaWdpbiAmJiBoYW5kbGVyc1tpXS5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb3NpdGlvbiA8IDApIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICBsZWFmLl9saXN0ZW5lcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0uc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChoYW5kbGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoaGFuZGxlcnMgPT09IGxpc3RlbmVyIHx8XG4gICAgICAgIChoYW5kbGVycy5saXN0ZW5lciAmJiBoYW5kbGVycy5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XG4gICAgICAgIChoYW5kbGVycy5fb3JpZ2luICYmIGhhbmRsZXJzLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmZBbnkgPSBmdW5jdGlvbihmbikge1xuICAgIHZhciBpID0gMCwgbCA9IDAsIGZucztcbiAgICBpZiAoZm4gJiYgdGhpcy5fYWxsICYmIHRoaXMuX2FsbC5sZW5ndGggPiAwKSB7XG4gICAgICBmbnMgPSB0aGlzLl9hbGw7XG4gICAgICBmb3IoaSA9IDAsIGwgPSBmbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmKGZuID09PSBmbnNbaV0pIHtcbiAgICAgICAgICBmbnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmY7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICF0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICB2YXIgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuXG4gICAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcbiAgICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XG4gICAgICAgIGxlYWYuX2xpc3RlbmVycyA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIGhhbmRsZXJzID0gW107XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXJzLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgICAgcmV0dXJuIGhhbmRsZXJzO1xuICAgIH1cblxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgdGhpcy5fZXZlbnRzW3R5cGVdID0gW107XG4gICAgaWYgKCFpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzQW55ID0gZnVuY3Rpb24oKSB7XG5cbiAgICBpZih0aGlzLl9hbGwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hbGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICB9O1xuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgLy8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBFdmVudEVtaXR0ZXI7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gQ29tbW9uSlNcbiAgICBleHBvcnRzLkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWwuXG4gICAgd2luZG93LkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XG4gIH1cbn0oKTtcbiIsIlxuLyogZ2xvYmFsIHVuZXNjYXBlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGltYWdlVG9VcmkgPSByZXF1aXJlKCAnaW1hZ2UtdG8tZGF0YS11cmknICk7XG5cbi8qXG4jIyBJbWFnZSB0byBibG9iXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5Db252ZXJ0cyByZW1vdGUgaW1hZ2UgdXJscyB0byBibG9icyB2aWEgY2FudmFzLiBcblxuYGBgamF2YXNjcmlwdFxudmFyIGltYWdlVG9CbG9iID0gcmVxdWlyZSggJ2ltYWdlLXRvLWJsb2InICk7XG5cbmltYWdlVG9CbG9iKCAnaHR0cDovL2Zvby5iYXIvYmF6LnBuZycsIGZ1bmN0aW9uKCBlcnIsIHVyaSApIHsgXG4gICAgY29uc29sZS5sb2coIHVyaSApOyBcbn0gKTtcbmltYWdlVG9CbG9iKCBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSggJ2ltZycgKVsgMCBdLCBmdW5jdGlvbiggZXJyLCB1cmkgKSB7IFxuICAgIGNvbnNvbGUubG9nKCB1cmkgKTsgXG59ICk7XG5gYGBcbiovXG5cbnZhciB0eXBlcyA9IHtcbiAgICAncG5nJzogJ2ltYWdlL3BuZycsXG4gICAgJ2pwZyc6ICdpbWFnZS9qcGVnJyxcbiAgICAnanBlZyc6ICdpbWFnZS9qcGVnJyxcbiAgICAnc3ZnJzogJ2ltYWdlL3N2Zyt4bWwnIC8vIHRoaXMgZ2V0cyBjb252ZXJ0ZWQgdG8gcG5nXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGltYWdlVG9CbG9iO1xubW9kdWxlLmV4cG9ydHMuZGF0YVVSSXRvQmxvYiA9IGRhdGFVUkl0b0Jsb2I7XG5tb2R1bGUuZXhwb3J0cy5faGFuZGxlSW1hZ2VUb1VSSSA9IGhhbmRsZUltYWdlVG9VUkk7XG5tb2R1bGUuZXhwb3J0cy5nZXRNaW1lVHlwZUZyb21VcmwgPSBnZXRUeXBlO1xuXG4vKlxuICAgIGltYWdlVG9CbG9iIC0gbWFpbiBmdW5jdGlvbiB0aGF0IGdldHMgZXhwb3NlZCwgY29udmVydHMgZWl0aGVyIGRvbSBub2RlIG9yIHVybCBvZiBpbWFnZSBpbnRvIGJsb2IgZGF0YVxuXG4gICAgcGFyYW1zXG4gICAgICAgIGltZyB7IE9iamVjdCB8IFN0cmluZyB9IC0gZWl0aGVyIGNhbiBiZSBhbiBJTUcgRE9NIG5vZGUgb3IgYSB1cmwgc3RyaW5nIHRoYXQgd2lsbCBsb2FkIHRoZSBpbWFnZVxuICAgICAgICBvcHRpb25zIHsgT2JqZWN0IH0gLSBvcHRpb25hbCwgYSBzZXQgb2Ygb3B0aW9ucyB0aGF0IHlvdSBjYW4gcGFzcyB0byB0aGUgaW1hZ2V0b2Jsb2IgdG8gY2hhbmdlIHRoZSBiZWhhdmlvclxuICAgICAgICBjYWxsYmFjayB7IEZ1bmN0aW9uIH0gLSBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBhZnRlciB0aGUgY29udmVyc2lvbiBpcyBjb21wbGV0ZWQuIFRoZSBjYWxsYmFjayB3aWxsIGdldCBwYXNzZWQgYW4gZXJyb3IgKCBpZiBvbmUgb2NjdXJlcyApIGFuZCB0aGUgYmxvYi5cblxuKi9cblxuZnVuY3Rpb24gaW1hZ2VUb0Jsb2IoIGltZywgb3B0aW9ucywgY2FsbGJhY2sgKSB7XG4gICAgXG4gICAgdmFyIHNyYztcblxuICAgIGlmICggdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYgKCAhaW1nICkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soIG5ldyBFcnJvciggJ1Bhc3MgaW4gYSBJTUcgRE9NIG5vZGUgb3IgYSB1cmwgYXMgZmlyc3QgcGFyYW0nICkgKTtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBpbWcgPT09ICdvYmplY3QnICYmIGltZy50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdpbWcnICkge1xuICAgICAgICBzcmMgPSBpbWcuc3JjO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIGltZyA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHNyYyA9IGltZztcbiAgICB9XG5cbiAgICBpZiAoIC9eZGF0YTovLnRlc3QoIHNyYyApICkgeyAvLyBjaGVjayB0byBzZWUgaWYgaXRzIGEgZGF0YSB1cmlcbiAgICAgICAgY2FsbGJhY2soIG51bGwsIGRhdGFVUkl0b0Jsb2IoIHNyYyApICk7IC8vIHNjcmlwdCB0byBkYXRhdXJpIGNvbnZlcnNpb25cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG9wdGlvbnMudHlwZSA9IHR5cGVzWyBvcHRpb25zLnR5cGUgXSB8fCBnZXRUeXBlKCBzcmMgKTtcbiAgICBvcHRpb25zLnNyYyA9IHNyYztcbiAgICBvcHRpb25zLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgaWYgKCAhb3B0aW9ucy50eXBlICkge1xuXG4gICAgICAgIGNhbGxiYWNrKCBuZXcgRXJyb3IoICdJbWFnZSB0eXBlIGlzIG5vdCBzdXBwb3J0ZWQnICkgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGltYWdlVG9VcmkoIHNyYywgb3B0aW9ucy50eXBlLCBoYW5kbGVJbWFnZVRvVVJJLmJpbmQoIG51bGwsIG9wdGlvbnMgKSApOyAvLyBhdHRlbXB0IGlmIHdlIGhhdmUgYSBcbn1cblxuLypcbiAgICBkYXRhVVJJdG9CbG9iIC0gdGFrZXMgYSBkYXRhdXJpIGFuZCBjb252ZXJ0cyBpdCBpbnRvIGEgYmxvYlxuXG4gICAgcGFyYW1zXG4gICAgICAgIHVyaSB7IFN0cmluZyB9IC0gYSB2YWxpZCBkYXRhdXJpXG5cbiAgICByZXR1cm5zXG4gICAgICAgIGJsb2IgeyBCbG9iIE9iamVjdCB9IC0gZ2VuZXJhdGVkIGJsb2Igb2JqZWN0XG5cbiovXG5cblxuZnVuY3Rpb24gZGF0YVVSSXRvQmxvYiggdXJpICkge1xuICAgIC8vIGNvbnZlcnQgYmFzZTY0L1VSTEVuY29kZWQgZGF0YSBjb21wb25lbnQgdG8gcmF3IGJpbmFyeSBkYXRhIGhlbGQgaW4gYSBzdHJpbmdcbiAgICB2YXIgYnl0ZVN0cmluZyxcbiAgICAgICAgbWltZVN0cmluZyxcbiAgICAgICAgaWE7XG5cbiAgICBpZiAoIHVyaS5zcGxpdCggJywnIClbMF0uaW5kZXhPZiggJ2Jhc2U2NCcgKSA+PSAwICkge1xuXG4gICAgICAgIGJ5dGVTdHJpbmcgPSBhdG9iKCB1cmkuc3BsaXQoJywnKVsxXSApO1xuICAgIH1cbiAgICBlbHNlIHtcblxuICAgICAgICBieXRlU3RyaW5nID0gdW5lc2NhcGUoIHVyaS5zcGxpdCgnLCcpWzFdICk7XG4gICAgfVxuXG4gICAgLy8gc2VwYXJhdGUgb3V0IHRoZSBtaW1lIGNvbXBvbmVudFxuICAgIG1pbWVTdHJpbmcgPSB1cmkuc3BsaXQoICcsJyApWyAwIF0uc3BsaXQoICc6JyApWyAxIF0uc3BsaXQoICc7JyApWyAwIF07XG5cbiAgICAvLyB3cml0ZSB0aGUgYnl0ZXMgb2YgdGhlIHN0cmluZyB0byBhIHR5cGVkIGFycmF5XG4gICAgaWEgPSBuZXcgVWludDhBcnJheSggYnl0ZVN0cmluZy5sZW5ndGggKTtcblxuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IGJ5dGVTdHJpbmcubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIFxuICAgICAgICBpYVsgaSBdID0gYnl0ZVN0cmluZy5jaGFyQ29kZUF0KCBpICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCbG9iKCBbIGlhIF0sIHtcbiAgICAgICAgdHlwZTogbWltZVN0cmluZ1xuICAgIH0gKTtcbn1cblxuLypcbiAgICBoYW5kbGVJbWFnZVRvVVJJIC0gaGFuZGxlcyBhIGNhbGxiYWNrIGZyb20gaW1hZ2VUb1VSSSBhbmQgZ2x1ZXMgdG9nZXRoZXIgZGF0YVVSSXRvQmxvYlxuXG4gICAgcGFyYW1zXG4gICAgICAgIG9wdGlvbnMgeyBPYmplY3QgfSAtIHRoZSBvcHRpb25zIG9iamVjdCBwYXNzZWQgdG8gdGhlIG1haW4gZm4gd2l0aCB0aGUgY2FsbGJhY2sgYXR0YWNoZWQgdG8gaXRcbiAgICAgICAgZXJyIHsgRXJyb3IgT2JqZWN0IH0gLSBhbiBlcnJvciBpZiBvbmUgb2NjdXJzIGluIHRoZSBpbWFnZVRvVVJJIG1ldGhvZCBcbiAgICAgICAgdXJpIHsgU3RyaW5nIH0gLSBhIHZhbGlkIGRhdGEgdXJsXG5cbiovXG5cbmZ1bmN0aW9uIGhhbmRsZUltYWdlVG9VUkkoIG9wdGlvbnMsIGVyciwgdXJpICkge1xuXG4gICAgaWYgKCBlcnIgKSB7XG4gICAgICAgIG9wdGlvbnMuY2FsbGJhY2soIGVyciApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgb3B0aW9ucy5jYWxsYmFjayggbnVsbCwgZGF0YVVSSXRvQmxvYiggdXJpICkgKTtcblxufVxuXG4vKlxuICAgIGdldFR5cGUgLSBzbWFsbCB1dGlsIHRvIGdldCB0eXBlIGZyb20gdXJsIGlmIG9uZSBpcyBwcmVzZW50IGluIHR5cGVzIGxpc3RcblxuICAgIHBhcmFtc1xuICAgICAgICB1cmwgeyBTdHJpbmcgfSAtIGEgdXJsIHRvIHBhcnNlIHRoZSBmaWxlIGV4dGVuc2lvbiBmcm9tXG5cbiAgICByZXR1cm5zXG4gICAgICAgIHR5cGUgeyBTdHJpbmcgfSAtIGEgbWltZSB0eXBlIGlmIHR5cGUgaXMgc3VwcG9ydGVkLCBpZiBub3QgdW5kZWZpbmVkIGlzIHJldHVybmVkXG5cbiovXG5cbmZ1bmN0aW9uIGdldFR5cGUoIHVybCApIHtcbiAgICByZXR1cm4gdXJsID8gdHlwZXNbIHVybC5zcGxpdCggJz8nICkuc2hpZnQoICkuc3BsaXQoICcuJyApLnBvcCggKSBdIDogbnVsbCA7XG59XG4iLCIvLyBjb252ZXJ0cyBhIFVSTCBvZiBhbiBpbWFnZSBpbnRvIGEgZGF0YVVSSVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodXJsLCBtaW1lVHlwZSwgY2IpIHtcbiAgICAvLyBDcmVhdGUgYW4gZW1wdHkgY2FudmFzIGFuZCBpbWFnZSBlbGVtZW50c1xuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKSxcbiAgICAgICAgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG5cbiAgICBpZiAoIHR5cGVvZiBtaW1lVHlwZSA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgY2IgPSBtaW1lVHlwZTtcbiAgICAgICAgbWltZVR5cGUgPSBudWxsO1xuICAgIH1cblxuICAgIG1pbWVUeXBlID0gbWltZVR5cGUgfHwgJ2ltYWdlL3BuZyc7XG5cbiAgICAvLyBhbGxvdyBmb3IgY3Jvc3Mgb3JpZ2luIHRoYXQgaGFzIGNvcnJlY3QgaGVhZGVyc1xuICAgIGltZy5jcm9zc09yaWdpbiA9IFwiQW5vbnltb3VzXCI7IFxuXG4gICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICAvLyBtYXRjaCBzaXplIG9mIGltYWdlXG4gICAgICAgIGNhbnZhcy53aWR0aCA9IGltZy53aWR0aDtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGltZy5oZWlnaHQ7XG5cbiAgICAgICAgLy8gQ29weSB0aGUgaW1hZ2UgY29udGVudHMgdG8gdGhlIGNhbnZhc1xuICAgICAgICBjdHguZHJhd0ltYWdlKGltZywgMCwgMCk7XG5cbiAgICAgICAgLy8gR2V0IHRoZSBkYXRhLVVSSSBmb3JtYXR0ZWQgaW1hZ2VcbiAgICAgICAgY2IoIG51bGwsIGNhbnZhcy50b0RhdGFVUkwoIG1pbWVUeXBlICkgKTtcbiAgICB9O1xuXG4gICAgaW1nLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNiKG5ldyBFcnJvcignRmFpbGVkVG9Mb2FkSW1hZ2UnKSk7XG4gICAgfTtcblxuICAgIC8vIGNhbnZhcyBpcyBub3Qgc3VwcG9ydGVkXG4gICAgaWYgKCFjYW52YXMuZ2V0Q29udGV4dCkge1xuICAgICAgICBjYihuZXcgRXJyb3IoJ0NhbnZhc0lzTm90U3VwcG9ydGVkJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGltZy5zcmMgPSB1cmw7XG4gICAgfVxufTtcbiIsIi8qIVxyXG4gKiBAbmFtZSBKYXZhU2NyaXB0L05vZGVKUyBNZXJnZSB2MS4yLjBcclxuICogQGF1dGhvciB5ZWlrb3NcclxuICogQHJlcG9zaXRvcnkgaHR0cHM6Ly9naXRodWIuY29tL3llaWtvcy9qcy5tZXJnZVxyXG5cclxuICogQ29weXJpZ2h0IDIwMTQgeWVpa29zIC0gTUlUIGxpY2Vuc2VcclxuICogaHR0cHM6Ly9yYXcuZ2l0aHViLmNvbS95ZWlrb3MvanMubWVyZ2UvbWFzdGVyL0xJQ0VOU0VcclxuICovXHJcblxyXG47KGZ1bmN0aW9uKGlzTm9kZSkge1xyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSBvbmUgb3IgbW9yZSBvYmplY3RzIFxyXG5cdCAqIEBwYXJhbSBib29sPyBjbG9uZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCwuLi4gYXJndW1lbnRzXHJcblx0ICogQHJldHVybiBvYmplY3RcclxuXHQgKi9cclxuXHJcblx0dmFyIFB1YmxpYyA9IGZ1bmN0aW9uKGNsb25lKSB7XHJcblxyXG5cdFx0cmV0dXJuIG1lcmdlKGNsb25lID09PSB0cnVlLCBmYWxzZSwgYXJndW1lbnRzKTtcclxuXHJcblx0fSwgcHVibGljTmFtZSA9ICdtZXJnZSc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIHR3byBvciBtb3JlIG9iamVjdHMgcmVjdXJzaXZlbHkgXHJcblx0ICogQHBhcmFtIGJvb2w/IGNsb25lXHJcblx0ICogQHBhcmFtIG1peGVkLC4uLiBhcmd1bWVudHNcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHRQdWJsaWMucmVjdXJzaXZlID0gZnVuY3Rpb24oY2xvbmUpIHtcclxuXHJcblx0XHRyZXR1cm4gbWVyZ2UoY2xvbmUgPT09IHRydWUsIHRydWUsIGFyZ3VtZW50cyk7XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENsb25lIHRoZSBpbnB1dCByZW1vdmluZyBhbnkgcmVmZXJlbmNlXHJcblx0ICogQHBhcmFtIG1peGVkIGlucHV0XHJcblx0ICogQHJldHVybiBtaXhlZFxyXG5cdCAqL1xyXG5cclxuXHRQdWJsaWMuY2xvbmUgPSBmdW5jdGlvbihpbnB1dCkge1xyXG5cclxuXHRcdHZhciBvdXRwdXQgPSBpbnB1dCxcclxuXHRcdFx0dHlwZSA9IHR5cGVPZihpbnB1dCksXHJcblx0XHRcdGluZGV4LCBzaXplO1xyXG5cclxuXHRcdGlmICh0eXBlID09PSAnYXJyYXknKSB7XHJcblxyXG5cdFx0XHRvdXRwdXQgPSBbXTtcclxuXHRcdFx0c2l6ZSA9IGlucHV0Lmxlbmd0aDtcclxuXHJcblx0XHRcdGZvciAoaW5kZXg9MDtpbmRleDxzaXplOysraW5kZXgpXHJcblxyXG5cdFx0XHRcdG91dHB1dFtpbmRleF0gPSBQdWJsaWMuY2xvbmUoaW5wdXRbaW5kZXhdKTtcclxuXHJcblx0XHR9IGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKSB7XHJcblxyXG5cdFx0XHRvdXRwdXQgPSB7fTtcclxuXHJcblx0XHRcdGZvciAoaW5kZXggaW4gaW5wdXQpXHJcblxyXG5cdFx0XHRcdG91dHB1dFtpbmRleF0gPSBQdWJsaWMuY2xvbmUoaW5wdXRbaW5kZXhdKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG91dHB1dDtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9iamVjdHMgcmVjdXJzaXZlbHlcclxuXHQgKiBAcGFyYW0gbWl4ZWQgaW5wdXRcclxuXHQgKiBAcGFyYW0gbWl4ZWQgZXh0ZW5kXHJcblx0ICogQHJldHVybiBtaXhlZFxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiBtZXJnZV9yZWN1cnNpdmUoYmFzZSwgZXh0ZW5kKSB7XHJcblxyXG5cdFx0aWYgKHR5cGVPZihiYXNlKSAhPT0gJ29iamVjdCcpXHJcblxyXG5cdFx0XHRyZXR1cm4gZXh0ZW5kO1xyXG5cclxuXHRcdGZvciAodmFyIGtleSBpbiBleHRlbmQpIHtcclxuXHJcblx0XHRcdGlmICh0eXBlT2YoYmFzZVtrZXldKSA9PT0gJ29iamVjdCcgJiYgdHlwZU9mKGV4dGVuZFtrZXldKSA9PT0gJ29iamVjdCcpIHtcclxuXHJcblx0XHRcdFx0YmFzZVtrZXldID0gbWVyZ2VfcmVjdXJzaXZlKGJhc2Vba2V5XSwgZXh0ZW5kW2tleV0pO1xyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0YmFzZVtrZXldID0gZXh0ZW5kW2tleV07XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBiYXNlO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIHR3byBvciBtb3JlIG9iamVjdHNcclxuXHQgKiBAcGFyYW0gYm9vbCBjbG9uZVxyXG5cdCAqIEBwYXJhbSBib29sIHJlY3Vyc2l2ZVxyXG5cdCAqIEBwYXJhbSBhcnJheSBhcmd2XHJcblx0ICogQHJldHVybiBvYmplY3RcclxuXHQgKi9cclxuXHJcblx0ZnVuY3Rpb24gbWVyZ2UoY2xvbmUsIHJlY3Vyc2l2ZSwgYXJndikge1xyXG5cclxuXHRcdHZhciByZXN1bHQgPSBhcmd2WzBdLFxyXG5cdFx0XHRzaXplID0gYXJndi5sZW5ndGg7XHJcblxyXG5cdFx0aWYgKGNsb25lIHx8IHR5cGVPZihyZXN1bHQpICE9PSAnb2JqZWN0JylcclxuXHJcblx0XHRcdHJlc3VsdCA9IHt9O1xyXG5cclxuXHRcdGZvciAodmFyIGluZGV4PTA7aW5kZXg8c2l6ZTsrK2luZGV4KSB7XHJcblxyXG5cdFx0XHR2YXIgaXRlbSA9IGFyZ3ZbaW5kZXhdLFxyXG5cclxuXHRcdFx0XHR0eXBlID0gdHlwZU9mKGl0ZW0pO1xyXG5cclxuXHRcdFx0aWYgKHR5cGUgIT09ICdvYmplY3QnKSBjb250aW51ZTtcclxuXHJcblx0XHRcdGZvciAodmFyIGtleSBpbiBpdGVtKSB7XHJcblxyXG5cdFx0XHRcdHZhciBzaXRlbSA9IGNsb25lID8gUHVibGljLmNsb25lKGl0ZW1ba2V5XSkgOiBpdGVtW2tleV07XHJcblxyXG5cdFx0XHRcdGlmIChyZWN1cnNpdmUpIHtcclxuXHJcblx0XHRcdFx0XHRyZXN1bHRba2V5XSA9IG1lcmdlX3JlY3Vyc2l2ZShyZXN1bHRba2V5XSwgc2l0ZW0pO1xyXG5cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdHJlc3VsdFtrZXldID0gc2l0ZW07XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3VsdDtcclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgdHlwZSBvZiB2YXJpYWJsZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCBpbnB1dFxyXG5cdCAqIEByZXR1cm4gc3RyaW5nXHJcblx0ICpcclxuXHQgKiBAc2VlIGh0dHA6Ly9qc3BlcmYuY29tL3R5cGVvZnZhclxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiB0eXBlT2YoaW5wdXQpIHtcclxuXHJcblx0XHRyZXR1cm4gKHt9KS50b1N0cmluZy5jYWxsKGlucHV0KS5zbGljZSg4LCAtMSkudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0fVxyXG5cclxuXHRpZiAoaXNOb2RlKSB7XHJcblxyXG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBQdWJsaWM7XHJcblxyXG5cdH0gZWxzZSB7XHJcblxyXG5cdFx0d2luZG93W3B1YmxpY05hbWVdID0gUHVibGljO1xyXG5cclxuXHR9XHJcblxyXG59KSh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cyk7IiwidmFyIGVtaXQgPSByZXF1aXJlKCAnZW1pdC1iaW5kaW5ncycgKSxcbiAgICBhdHRyaWJ1dGVzID0ge1xuICAgICAgICBuYW1lIDogJ3ByZXZpZXcnLFxuICAgICAgICBoaWRlOiB0cnVlXG4gICAgfTtcblxuXG5mdW5jdGlvbiBQcmV2aWV3KCBhdHRycyApeyBcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSBhdHRycztcbn1cblxuUHJldmlldy5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oIG1ldGEsIHNrb2xsLCBkb25lICl7XG4gICAgICAgIHZhciBmaWxlcyA9IG1ldGEuZXZlbnQuZmlsZXMsXG4gICAgICAgICAgICBzaXplID0gZmlsZXMubGVuZ3RoLFxuICAgICAgICAgICAgY291bnQgPSAwLFxuICAgICAgICAgICAgcmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCggdGhpcyApLFxuICAgICAgICAgICAgX2ZpbGVzID0gW107XG5cbiAgICAgICAgZW1pdC5vbiggJ3Nrb2xsLnByZXZpZXcuY2FuY2VsJywgc2tvbGwub3Blbi5iaW5kKCBza29sbCwgeyBtZXRhOiBtZXRhIH0gKSApO1xuICAgICAgICBlbWl0Lm9uKCAnc2tvbGwucHJldmlldy51c2UnLCBza29sbC51cGxvYWQuYmluZCggc2tvbGwsIG1ldGEuZXZlbnQgKSApO1xuXG4gICAgICAgIGZ1bmN0aW9uIG5leHQoIGVyciwgVVJJICkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgYnRucztcblxuICAgICAgICAgICAgY291bnQgKys7XG5cbiAgICAgICAgICAgIGlmICggIWVyciAmJiBVUkkgKSB7IFxuICAgICAgICAgICAgICAgIF9maWxlcy5wdXNoKCBVUkkgKTsgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICggY291bnQgPT09IHNpemUgKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyKCBfZmlsZXMsIGRvbmUgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGVzLmZpbHRlciggZmlsdGVyVXJscyApXG4gICAgICAgICAgICAuZm9yRWFjaCggZnVuY3Rpb24oIGZpbGUgKXtcbiAgICAgICAgICAgICAgICByZWFkRmlsZSggZmlsZSwgbmV4dCApOyBcbiAgICAgICAgICAgIH0gKTsgICAgXG4gICAgfSxcbiAgICB0ZWFyZG93bjogZnVuY3Rpb24oKXtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC5wcmV2aWV3LmNhbmNlbCcgKTtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC5wcmV2aWV3LnVzZScgKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24oIGZpbGVzLCBjYWxsYmFjayApIHtcbiAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApLFxuICAgICAgICAgICAgdXNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKSxcbiAgICAgICAgICAgIGNhbmNlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICksXG4gICAgICAgICAgICBpbWFnZXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApLFxuICAgICAgICAgICAgYnV0dG9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnIClcblxuICAgICAgICB3cmFwcGVyLmNsYXNzTGlzdC5hZGQoICdza29sbC1wcmV2aWV3LXdyYXBwZXInICk7XG4gICAgICAgIGltYWdlcy5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtcHJldmlldy1pbWFnZXMnICk7XG4gICAgICAgIGJ1dHRvbnMuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXByZXZpZXctYnV0dG9ucycgKTtcblxuICAgICAgICB1c2UuaW5uZXJUZXh0ID0gJ1VzZSc7XG4gICAgICAgIHVzZS5zZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnLCAnc2tvbGwucHJldmlldy51c2UnICk7XG4gICAgICAgIHVzZS5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtYnV0dG9uJyApO1xuXG4gICAgICAgIGNhbmNlbC5pbm5lckhUTUwgPSAnQ2FuY2VsJztcbiAgICAgICAgY2FuY2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcsICdza29sbC5wcmV2aWV3LmNhbmNlbCcgKTtcbiAgICAgICAgY2FuY2VsLmNsYXNzTGlzdC5hZGQoICdza29sbC1idXR0b24nICk7XG5cbiAgICAgICAgZmlsZXMuZm9yRWFjaCggY3JlYXRlRWxlbWVudEFuZEFwcGVuZCggaW1hZ2VzICkgKTtcblxuICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKCBpbWFnZXMgKTtcbiAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZCggYnV0dG9ucyApO1xuICAgICAgICBidXR0b25zLmFwcGVuZENoaWxkKCBjYW5jZWwgKTtcbiAgICAgICAgYnV0dG9ucy5hcHBlbmRDaGlsZCggdXNlICk7XG5cbiAgICAgICAgY2FsbGJhY2soIG51bGwsIHdyYXBwZXIgKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBQcmV2aWV3KCBhdHRyaWJ1dGVzICk7XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnRBbmRBcHBlbmQoIGNvbnRhaW5lciApIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oIGZpbGUgKSB7XG4gICAgICAgIHZhciBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgICAgICBpbWcuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXByZXZpZXctaW1hZ2UnICk7XG4gICAgICAgIGltZy5zZXRBdHRyaWJ1dGUoICdzdHlsZScsICdiYWNrZ3JvdW5kLWltYWdlOiB1cmwoJyArIGZpbGUgKyAnKTsnICk7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCggaW1nICk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmaWx0ZXJVcmxzKCBmaWxlICkge1xuICAgIHJldHVybiB0eXBlb2YgZmlsZS51cmwgIT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiByZWFkRmlsZSggZmlsZSwgY2FsbGJhY2sgKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cbiAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oICkge1xuICAgICAgICBjYWxsYmFjayggbnVsbCwgcmVhZGVyLnJlc3VsdCApO1xuICAgIH07XG5cbiAgICByZWFkZXIub25lcnJvciA9IGZ1bmN0aW9uKCBlcnIgKSB7XG4gICAgICAgIGNhbGxiYWNrKCBlcnIgKTtcbiAgICB9O1xuXG4gICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoIGZpbGUgKTtcbn0iLCJcbnZhciBlbWl0ID0gcmVxdWlyZSggJ2VtaXQtYmluZGluZ3MnICk7XG5cbmZ1bmN0aW9uIFVwbG9hZCggYXR0cnMgKXsgXG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gYXR0cnM7XG59XG5cblVwbG9hZC5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oIG1ldGEsIHNrb2xsLCBkb25lICkge1xuICAgICAgICB0aGlzLnNrb2xsID0gc2tvbGw7XG4gICAgICAgIGVtaXQub24oICdza29sbC51cGxvYWQuc3VibWl0JywgdGhpcy5vblN1Ym1pdC5iaW5kKCB0aGlzICkgKTtcbiAgICAgICAgdGhpcy5yZW5kZXIoIGRvbmUgKTtcbiAgICB9LFxuICAgIHRlYXJkb3duOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gY2xlYXIgb3V0IHNvbWUgY2FjaGVcbiAgICAgICAgdGhpcy51cGxvYWQgPSBudWxsO1xuICAgICAgICB0aGlzLmlucHV0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBudWxsO1xuICAgICAgICB0aGlzLnNrb2xsID0gbnVsbDtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC51cGxvYWQuc3VibWl0JyApO1xuICAgIH0sXG4gICAgb25TdWJtaXQ6IGZ1bmN0aW9uKCBlICkge1xuXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICB2YXIgaW5wdXQgPSB0aGlzLmlucHV0LFxuICAgICAgICAgICAgdmFsdWUgPSBpbnB1dC52YWx1ZSxcbiAgICAgICAgICAgIGV2ZW50ID0ge1xuICAgICAgICAgICAgICAgIGZpbGVzOiBbe1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHZhbHVlXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5za29sbC5wcmV2aWV3KCBldmVudCApO1xuICAgIH0sXG4gICAgb25DaGFuZ2U6IGZ1bmN0aW9uKCBlICkge1xuICAgICAgICB0aGlzLnNrb2xsLnByZXZpZXcoIGUudGFyZ2V0ICk7XG4gICAgfSxcbiAgICBhdHRhY2hMaXN0ZW5lcnM6IGZ1bmN0aW9uKCApIHtcblxuICAgICAgICB2YXIgbGVhdmVCdWZmZXIsXG4gICAgICAgICAgICBjbGFzc0xpc3QgPSB0aGlzLmRyb3B6b25lLmNsYXNzTGlzdDtcblxuICAgICAgICBmdW5jdGlvbiBkcmFnT3ZlcigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCggbGVhdmVCdWZmZXIgKTtcbiAgICAgICAgICAgIGlmICggY2xhc3NMaXN0LmNvbnRhaW5zKCAnc2tvbGwtdXBsb2FkLWRyYWctb3ZlcicgKSApIHJldHVybjtcbiAgICAgICAgICAgIGNsYXNzTGlzdC5hZGQoICdza29sbC11cGxvYWQtZHJhZy1vdmVyJyApO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZHJhZ0xlYXZlKCkge1xuICAgICAgICAgICAgY2xhc3NMaXN0LnJlbW92ZSggJ3Nrb2xsLXVwbG9hZC1kcmFnLW92ZXInICk7XG4gICAgICAgICAgICBjbGFzc0xpc3QucmVtb3ZlKCAnc2tvbGwtdXBsb2FkLXNob3cnICk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzaG93T3ZlcigpIHtcbiAgICAgICAgICAgIGlmICggY2xhc3NMaXN0LnJlbW92ZSggJ3Nrb2xsLXVwbG9hZC1zaG93JyApICkgcmV0dXJuO1xuICAgICAgICAgICAgY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXVwbG9hZC1zaG93JyApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kcm9wem9uZS5hZGRFdmVudExpc3RlbmVyKCAnZHJhZ292ZXInLCBkcmFnT3ZlciApO1xuICAgICAgICB0aGlzLmRyb3B6b25lLmFkZEV2ZW50TGlzdGVuZXIoICdkcmFnbGVhdmUnLCBkcmFnTGVhdmUgKTtcbiAgICAgICAgdGhpcy5kcm9wem9uZS5hZGRFdmVudExpc3RlbmVyKCAnZHJvcCcsIGRyYWdMZWF2ZSApO1xuXG4gICAgICAgIHRoaXMuc2tvbGwuZWwucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2RyYWdvdmVyJywgc2hvd092ZXIgKTtcbiAgICAgICAgdGhpcy5za29sbC5lbC5hZGRFdmVudExpc3RlbmVyKCAnZHJhZ292ZXInLCBzaG93T3ZlciApO1xuXG4gICAgICAgIHRoaXMudXBsb2FkLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB0aGlzLm9uQ2hhbmdlLmJpbmQoIHRoaXMgKSApO1xuXG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uKCBkb25lICkge1xuXG4gICAgICAgIHZhciBodG1sID0gXG4gICAgICAgICc8ZGl2IGNsYXNzPVwic2tvbGwtdXBsb2FkLXVybFwiPicgKyBcbiAgICAgICAgICAgICc8YnV0dG9uIGNsYXNzPVwic2tvbGwtYnV0dG9uXCIgZGF0YS1lbWl0PVwic2tvbGwtdXBsb2FkLXRyaWdnZXJcIj5VcGxvYWQ8L2J1dHRvbj4nICtcbiAgICAgICAgJzwvZGl2PicgK1xuICAgICAgICAnPGhyPicgK1xuICAgICAgICAnPGZvcm0gY2xhc3M9XCJza29sbC11cGxvYWQtZm9ybVwiIGRhdGEtZW1pdD1cInNrb2xsLnVwbG9hZC5zdWJtaXRcIj4nICsgXG4gICAgICAgICAgICAnPHA+VXNlIGFuIFVSTDo8L3A+JyArIFxuICAgICAgICAgICAgJzxpbnB1dCB0eXBlPVwidXJsXCIgLz4nICsgXG4gICAgICAgICAgICAnPGJ1dHRvbiBjbGFzcz1cInNrb2xsLWJ1dHRvblwiPlN1Ym1pdDwvYnV0dG9uPicgK1xuICAgICAgICAnPC9mb3JtPicgK1xuICAgICAgICAnPGRpdiBjbGFzcz1cInNrb2xsLXVwbG9hZC1kcm9wem9uZVwiPicgK1xuICAgICAgICAgICAgJzxwPkRyb3AgeW91IGltYWdlcyBoZXJlITwvcD4nICtcbiAgICAgICAgICAgICc8aW5wdXQgY2xhc3M9XCJza29sbC11cGxvYWQtaW5wdXRcIiB0eXBlPVwiZmlsZVwiIG11bHRpcGxlIC8+JyArXG4gICAgICAgICc8L2Rpdj4nO1xuXG4gICAgICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgICAgICB0aGlzLmVsLmNsYXNzTGlzdC5hZGQoICdza29sbC11cGxvYWQtcGx1Z2luJyApO1xuICAgICAgICB0aGlzLmVsLmlubmVySFRNTCA9IGh0bWw7XG5cbiAgICAgICAgdGhpcy5kcm9wem9uZSA9IHRoaXMuZWwuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSggJ3Nrb2xsLXVwbG9hZC1kcm9wem9uZScgKVsgMCBdXG4gICAgICAgIHRoaXMudXBsb2FkID0gdGhpcy5kcm9wem9uZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCAnc2tvbGwtdXBsb2FkLWlucHV0JyApWyAwIF07XG5cbiAgICAgICAgdGhpcy5hdHRhY2hMaXN0ZW5lcnMoICk7XG5cbiAgICAgICAgZG9uZSggbnVsbCwgdGhpcy5lbCApO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IFVwbG9hZCgge1xuICAgIG5hbWU6ICd1cGxvYWQnXG59ICk7XG5cbi8vIC0gZHJhZyBldmVudHMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXG4vLyBVcGxvYWRNb2RhbC5wcm90b3R5cGUuZHJvcFpvbmVFdmVudHMgPSBmdW5jdGlvbiggJGRyb3B6b25lLCAkd3JhcHBlciApIHtcblxuLy8gfTtcbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1hZ2VUb0Jsb2IgPSByZXF1aXJlKCAnaW1hZ2UtdG8tYmxvYicgKSxcbiAgICB1dGlscyA9IHJlcXVpcmUoICcuL3V0aWxzJyApO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVVwbG9hZEV2ZW50O1xuXG5mdW5jdGlvbiBjcmVhdGVVcGxvYWRFdmVudCAoIGV2ZW50ZGF0YSwgY2FsbGJhY2sgKSB7XG4gICAgX2dldEJsb2JEYXRhKCBldmVudGRhdGEsIGZ1bmN0aW9uKCBlcnIsIGZpbGVzICkgeyBcbiAgICAgICAgaWYgKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soIGVyciApO1xuICAgICAgICBldmVudGRhdGEuZmlsZXMgPSBmaWxlcztcblxuICAgICAgICBjYWxsYmFjayggbnVsbCwgZXZlbnRkYXRhICk7XG4gICAgfSApOyAgICBcbn1cbiBcbmZ1bmN0aW9uIF9nZXRCbG9iRGF0YSAoIGV2ZW50ZGF0YSwgY2FsbGJhY2sgKSB7XG4gICAgdmFyIGZpbGVzID0gdXRpbHMubWFrZUFycmF5KCBldmVudGRhdGEuZmlsZXMgKSxcbiAgICAgICAgc2l6ZSA9IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgY291bnQgPSAwO1xuXG4gICAgZnVuY3Rpb24gZG9uZSAoICkge1xuICAgICAgICBjb3VudCArKztcbiAgICAgICAgaWYgKCBjb3VudCA9PT0gc2l6ZSApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCBudWxsLCBmaWxlcyApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0QmxvYkRhdGEoIGZpbGUsIGluZGV4ICkge1xuICAgICAgICBpZiAoIGZpbGUgaW5zdGFuY2VvZiBCbG9iICkge1xuICAgICAgICAgICAgZG9uZSgpOyAvLyBpZiBpdHMgYWxyZWFkeSBhIGJsb2Igbm8gbmVlZCB0byBkbyBhbnl0aGluZ1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBmaWxlLnVybCB8fCBmaWxlLmRhdGEgKSB7IC8vIGlmIHRoZSBmaWxlIHVybCBpcyBzZXQgb2YgdGhlIGZpbGUgZGF0YSBtZWFuaW5nIGEgZGF0YXVyaVxuICAgICAgICAgICAgaW1hZ2VUb0Jsb2IoIGZpbGUudXJsIHx8IGZpbGUuZGF0YSwgZnVuY3Rpb24oIGVyciwgYmxvYiApIHtcbiAgICAgICAgICAgICAgICBpZiAoIGVyciApIHJldHVybiBkb25lKCk7IC8vIHVuYWJsZSB0byBjb252ZXJ0IHNvIHNlbmQgaW4gcmF3IGZvcm1cbiAgICAgICAgICAgICAgICBmaWxlc1sgaW5kZXggXSA9IGJsb2I7XG4gICAgICAgICAgICAgICAgZG9uZSggKTtcbiAgICAgICAgICAgIH0gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkb25lKCApO1xuICAgIH1cblxuICAgIGZpbGVzLmZvckVhY2goIGdldEJsb2JEYXRhICk7XG59XG4iLCJcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMubWFrZUFycmF5ID0gZnVuY3Rpb24gKCBhcnIgKSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcnIsIDAgKTtcbn07Il19
