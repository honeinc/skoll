(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

'use strict';

var merge = require( 'merge' ),
    EventEmitter2 = require( 'eventemitter2' ).EventEmitter2,
    emit = require( 'emit-bindings' ),
    UploadEvent = require( './src/upload-event'),
    // utils = require( './src/utils' ),
    uploadPlugin = require( 'skoll-upload' ),
    previewPlugin = require( 'skoll-preview' );

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
    this.listEl = document.createElement( 'ul' );
    this.contentEl = document.createElement( 'div' );
    this.state = {
        view: 0
    };
    this.plugins = { };
    this.defaults = {
        plugin : 'upload',
        closeOnUpload: true
    };

    EventEmitter2.call( this );
    // attach default plugin
    this.addPlugin( uploadPlugin );
    this.addPlugin( previewPlugin );
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
        plugin = this.plugins[ pluginName ] || this.plugins[ defaultPlugin ];
        // close = this.close.bind( this );

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

        uploadFn( uploadEvent );
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
    };
};

Skoll.pluginListEl = function( currentPlugin ) {

    var currentPluginName = currentPlugin.attributes.name; 

    return function( plugin ) {
        var el = document.createElement( 'li' ),
            span = document.createElement( 'span' ),
            name = plugin.attributes.name;

        // consider some way to use icons
        span.textContent = name;
        el.setAttribute( 'data-plugin-name', name );
        el.setAttribute( 'data-emit', 'skoll.plugin.open' );
        el.appendChild( span );
        if ( name === currentPluginName ) {
            el.setAttribute( 'data-plugin-selected', true );
        }

        return el;        
    };

};

Skoll.prototype._init = function( ) {

    // this.el && this.listEl is built in the constructor
    var div = document.createElement.bind( document, 'div' ); 

    this.tableEl = div();
    this.cellEl = div();
    this.modalEl = div();
    this.closeEl = div();
    // classing structure
    this.el.classList.add( 'skoll-modal-overlay' );
    this.el.setAttribute( 'data-emit', 'skoll.close' );
    this.tableEl.classList.add( 'skoll-modal-table' ); // this is here to allow vertical centering
    this.cellEl.classList.add( 'skoll-modal-cell' );
    this.closeEl.classList.add( 'skoll-modal-close' );
    this.closeEl.setAttribute( 'data-emit', 'skoll.close' );
    this.modalEl.classList.add( 'skoll-modal' );
    this.modalEl.setAttribute( 'data-emit', 'skoll.modal.stopPropagation' );
    this.modalEl.setAttribute( 'data-emit-options', 'allowdefault' );
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

},{"./src/upload-event":9,"emit-bindings":2,"eventemitter2":3,"image-to-blob":4,"merge":6,"skoll-preview":7,"skoll-upload":8}],2:[function(require,module,exports){
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
        if ( nodes[ i ] === el ) {
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

function getTouchDelta( event, initial ) {
    var deltaX = ( event.touches[ 0 ].pageX - initial.x );
    var deltaY = ( event.touches[ 0 ].pageY - initial.y );
    return Math.sqrt( ( deltaX * deltaX ) + ( deltaY * deltaY ) );
}

Emit.prototype.handleEvent = function( event ) {
    var self = this;

    var touches = event.touches;
    var delta = -1;

    if ( typeof event.propagationStoppedAt !== 'number' || isNaN( event.propagationStoppedAt ) ) {
        event.propagationStoppedAt = 100; // highest possible value
    }

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

            var selector = 'a,button,input,[data-emit]';
            var originalElement = event.target || event.srcElement;
            var el = originalElement;
            
            var depth = -1;
            var handled = false;
            while( el && event.propagationStoppedAt > depth && ++depth < 100 ) {
                event.emitTarget = el;
                event.depth = depth;
                
                if ( !el.hasAttribute( 'data-emit' ) ) {
                    // if it's a link, button or input and it has no emit attribute, allow the event to pass
                    if ( el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'INPUT' ) {
                        return;
                    }
                    else {
                        el = closest( el, selector, false, document );
                        continue;
                    }
                }

                var forceAllowDefault = el.tagName === 'INPUT' && ( el.type === 'checkbox' || el.type === 'radio' );

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
                    event.propagationStoppedAt = depth;
                    el = null;
                    continue;
                }
                
                if ( typeof( self.validate ) === 'function' && !self.validate.call( self, el ) ) {
                    el = closest( el, selector, false, document );
                    continue;
                }

                if ( el.tagName === 'FORM' ) {
                    if ( event.type !== 'submit' ) {
                        el = closest( el, selector, false, document );
                        continue;
                    }
                }
                else if ( el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ) {
                    if ( !( el.type === 'submit' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' ) && event.type !== 'input' ) {
                        el = closest( el, selector, false, document );
                        continue;
                    }
                }
                else if ( el.tagName === 'SELECT' ) {
                    if ( event.type !== 'input' ) {
                        el = closest( el, selector, false, document );
                        continue;
                    }
                }

                handled |= self._emit( el, event, forceAllowDefault );
                el = closest( el, selector, false, document );
            }
            
            if ( !handled ) {
                self.emit( 'unhandled', event );
            }
            else if ( depth >= 100 ) {
                throw new Error( 'Exceeded depth limit for Emit calls.' );
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
            if ( event.type === ignoredEvents[ i ] ) {
                return false;
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
        event.propagationStoppedAt = event.depth;
    }

    var emissionList = element.getAttribute( 'data-emit' );
    if ( !emissionList ) {
        // allow for empty behaviors that catch events
        return true;
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

        return true;
    }
    
    emissions.forEach( function( emission ) {
        self.emit( emission, event );
    } );
    
    return true;
};

Emit.prototype.addValidator = function( validator ) {
    var self = this;

    var found = false;
    for ( var i = 0; i < self.validators.length; ++i ) {
        if ( self.validators[ i ] === validator ) {
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
        if ( self.validators[ i ] === validator ) {
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

    if ( /^data:/.test( src ) && !options.convert ) { // check to see if its a data uri
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
        var files = meta.event.files.filter( filterUrls ),
            size = files.length,
            count = 0,
            render = this.render.bind( this ),
            _files = [];


        function next( err, URI ) {
            
            var btns, back;

            count ++;

            if ( !err && URI ) { 
                _files.push( URI ); 
            }

            if ( count === size ) {
                render( _files, done );

                back = Object.create( { meta: meta } );
                
                if ( typeof skoll.prevPlugin === 'object' ) {
                    back.plugin = skoll.prevPlugin.attributes.name; // this allows for skoll to back to prior plugin
                }

                emit.on( 'skoll.preview.cancel', skoll.open.bind( skoll, back ) );
                emit.on( 'skoll.preview.use', skoll.upload.bind( skoll, meta.event ) );
            }
        }

        if ( !size ) {
            done( null, '' ); // call event
            skoll.upload( meta.event );
            return;
        }

        // if we have files run through each
        files.forEach( function( file ){
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
            buttons = document.createElement( 'div' );

        wrapper.classList.add( 'skoll-preview-wrapper' );
        images.classList.add( 'skoll-preview-images' );
        buttons.classList.add( 'skoll-preview-buttons' );

        use.textContent = 'Use';
        use.setAttribute( 'data-emit', 'skoll.preview.use' );
        use.classList.add( 'skoll-button' );

        cancel.textContent = 'Cancel';
        cancel.setAttribute( 'data-emit', 'skoll.preview.cancel' );
        cancel.classList.add( 'skoll-button' );

        if( files.length === 1 ) {
            // display a large image
            var img = document.createElement( 'img' );
            img.src = files[ 0 ];
            img.classList.add( 'skoll-preview-image-large');
            images.appendChild( img );
        }
        else {
            files.forEach( createElementAndAppend( images ) );
        }

        wrapper.appendChild( images );
        wrapper.appendChild( buttons );
        buttons.appendChild( cancel );
        buttons.appendChild( use );

        callback( null, wrapper );
    }
};

module.exports = new Preview( attributes );
module.exports.Plugin = Preview; // export out plugin for extending

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
        emit.on( 'skoll.upload.trigger', this.onTrigger.bind( this ) );
        this.render( meta, done );
    },
    teardown: function() {
        // clear out some cache
        this.upload = null;
        this.input = null;
        this.container = null;
        this.skoll = null;
        emit.removeAllListeners( 'skoll.upload.submit' );
        emit.removeAllListeners( 'skoll.upload.trigger' );
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
    onTrigger: function( e ) {
        this.upload.dispatchEvent( new MouseEvent( 'click' ) ); // proxy event to upload
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
    render: function( meta, done ) {

        var html = 
        '<div class="skoll-upload-url">' + 
            '<button class="skoll-button" data-emit="skoll.upload.trigger">Upload A File</button>' +
        '</div>' +
        '<hr>' +
        '<form class="skoll-upload-form" data-emit="skoll.upload.submit">' + 
            '<p>Use an URL:</p>' + 
            '<input type="url" />' + 
            '<button class="skoll-button">Submit</button>' +
        '</form>' +
        '<div class="skoll-upload-dropzone">' +
            '<p>Drop you images here!</p>' +
            '<input class="skoll-upload-input" type="file" />' +
        '</div>';

        this.el = document.createElement( 'div' );
        this.el.classList.add( 'skoll-upload-plugin' );
        this.el.innerHTML = html;

        this.dropzone = this.el.getElementsByClassName( 'skoll-upload-dropzone' )[ 0 ];
        this.upload = this.dropzone.getElementsByClassName( 'skoll-upload-input' )[ 0 ];
        this.input = this.el.querySelector( '.skoll-upload-form input' );

        if ( meta.multiple ) {
            this.upload.setAttribute( 'multiple', true );
        }

        if ( meta.url ) {
            this.input.value = meta.url;
        }

        this.attachListeners( );

        done( null, this.el );
    }
};

module.exports = new Upload( {
    name: 'upload'
} );
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL3VidW50dS9za29sbC9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS91YnVudHUvc2tvbGwvZmFrZV85YjQ2YzQxZC5qcyIsIi9ob21lL3VidW50dS9za29sbC9ub2RlX21vZHVsZXMvZW1pdC1iaW5kaW5ncy9pbmRleC5qcyIsIi9ob21lL3VidW50dS9za29sbC9ub2RlX21vZHVsZXMvZXZlbnRlbWl0dGVyMi9saWIvZXZlbnRlbWl0dGVyMi5qcyIsIi9ob21lL3VidW50dS9za29sbC9ub2RlX21vZHVsZXMvaW1hZ2UtdG8tYmxvYi9pbmRleC5qcyIsIi9ob21lL3VidW50dS9za29sbC9ub2RlX21vZHVsZXMvaW1hZ2UtdG8tZGF0YS11cmkvaW1hZ2UtdG8tZGF0YS11cmkuanMiLCIvaG9tZS91YnVudHUvc2tvbGwvbm9kZV9tb2R1bGVzL21lcmdlL21lcmdlLmpzIiwiL2hvbWUvdWJ1bnR1L3Nrb2xsL25vZGVfbW9kdWxlcy9za29sbC1wcmV2aWV3L2luZGV4LmpzIiwiL2hvbWUvdWJ1bnR1L3Nrb2xsL25vZGVfbW9kdWxlcy9za29sbC11cGxvYWQvaW5kZXguanMiLCIvaG9tZS91YnVudHUvc2tvbGwvc3JjL3VwbG9hZC1ldmVudC5qcyIsIi9ob21lL3VidW50dS9za29sbC9zcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbWVyZ2UgPSByZXF1aXJlKCAnbWVyZ2UnICksXG4gICAgRXZlbnRFbWl0dGVyMiA9IHJlcXVpcmUoICdldmVudGVtaXR0ZXIyJyApLkV2ZW50RW1pdHRlcjIsXG4gICAgZW1pdCA9IHJlcXVpcmUoICdlbWl0LWJpbmRpbmdzJyApLFxuICAgIFVwbG9hZEV2ZW50ID0gcmVxdWlyZSggJy4vc3JjL3VwbG9hZC1ldmVudCcpLFxuICAgIC8vIHV0aWxzID0gcmVxdWlyZSggJy4vc3JjL3V0aWxzJyApLFxuICAgIHVwbG9hZFBsdWdpbiA9IHJlcXVpcmUoICdza29sbC11cGxvYWQnICksXG4gICAgcHJldmlld1BsdWdpbiA9IHJlcXVpcmUoICdza29sbC1wcmV2aWV3JyApO1xuXG4vKlxuIyMjIFNrb2xsIC0gQ29uc3RydWN0b3JcblxuVGhpcyBpcyBhIGJhc2ljIENvbnN0cnVjdG9yIHRoYXQgd2lsbCBqdXN0IGluaXRpYWxpemUgc29tZSBiYXNpYyBkYXRhIHN0cnVjdHVyZXMgbmVlZGVkIHRvIGNoYW5nZSB0aGUgc3RhdGUgb2YgdGhlIGZpbGVVcGxvYWQgdGhpcyBzaG91bGQgbm90IGR1ZSBtdWNoIGR1ZSB0byB0aGUgZmFjdCB0aGF0IHRoaXMgd2lsbCBoYXBwZW4gaW5pdGlhbGx5IGluc2lkZSBvZiB0aGUgbW9kdWxlIGZvciB0aGUgc2luZ2xldG9uLiBUaGlzIHNob3VsZCBhbHNvIGJlIGFjY2Vzc2FibGUgdmlhIGFuIGV4cG9ydC5cblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICkuU2tvbGwsXG4gICAgU2tvbGwgPSBuZXcgU2tvbGwoKTtcbmBgYFxuKi9cblxuZnVuY3Rpb24gU2tvbGwoKSB7XG5cbiAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcbiAgICB0aGlzLmxpc3RFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICd1bCcgKTtcbiAgICB0aGlzLmNvbnRlbnRFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgICAgdmlldzogMFxuICAgIH07XG4gICAgdGhpcy5wbHVnaW5zID0geyB9O1xuICAgIHRoaXMuZGVmYXVsdHMgPSB7XG4gICAgICAgIHBsdWdpbiA6ICd1cGxvYWQnLFxuICAgICAgICBjbG9zZU9uVXBsb2FkOiB0cnVlXG4gICAgfTtcblxuICAgIEV2ZW50RW1pdHRlcjIuY2FsbCggdGhpcyApO1xuICAgIC8vIGF0dGFjaCBkZWZhdWx0IHBsdWdpblxuICAgIHRoaXMuYWRkUGx1Z2luKCB1cGxvYWRQbHVnaW4gKTtcbiAgICB0aGlzLmFkZFBsdWdpbiggcHJldmlld1BsdWdpbiApO1xuICAgIHNldFRpbWVvdXQoIHRoaXMuX2luaXQuYmluZCggdGhpcyApLCAwICk7XG59XG5cblNrb2xsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIEV2ZW50RW1pdHRlcjIucHJvdG90eXBlLCB7XG4gICAgICAgIHBsdWdpbkxpc3Q6IHsgLy8gZGVzY3JpcHRvclxuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoICkgeyAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHBsdWdpbnMgPSBPYmplY3Qua2V5cyggdGhpcy5wbHVnaW5zICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBsdWdpbnMubWFwKCBTa29sbC5tYXBQbHVnaW5zKCB0aGlzLnBsdWdpbnMgKSApXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoIFNrb2xsLnBsdWdpblZpc2libGUgKVxuICAgICAgICAgICAgICAgICAgICAubWFwKCBTa29sbC5wbHVnaW5MaXN0RWwoIHRoaXMuY3VycmVudFBsdWdpbiApIClcbiAgICAgICAgICAgICAgICAgICAgLnJldmVyc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbik7XG5cblNrb2xsLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFNrb2xsO1xuLypcbiMjIyBTa29sbDo6b3BlblxuXG5UaGlzIHdpbGwganVzdCBhcHBseSBhIGNsYXNzLCBgc2hvd2AsIHRvIHRoZSB1cGxvYWRlciBtb2RhbCBjb250YWluZXIgdG8gc2hvdyB0aGUgbW9kYWwuIFNpbmNlIG9ubHkgZXhhbXBsZSBDU1MgaXMgcHJvdmlkZWQgZWl0aGVyIHRoZSBleGFtcGxlIGNzcyBuZWVkcyB0byBiZSBpbnRlcmdyYXRlZCBpbnRvIHRoZSBjb2RlIG9yIHlvdSB3aWxsIG5lZWQgdG8gcHJvdmlkZSB0aGF0IGZ1bmN0aW9uYWxpdHkuIFRoaXMgd2lsbCBhbHNvIHNldCB0aGUgdmlldyBzdGF0ZSBvZiB0aGUgYFNrb2xsYCBvYmplY3QgdG8gYDFgIHRvIGluZGljYXRlIHRoYXQgdGhlIG1vZGFsIGlzIG9wZW4uXG5cbmBgYGphdmFzY3JpcHRcbnZhciBTa29sbCA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5Ta29sbC5vcGVuKCk7XG5cbmlmICggU2tvbGwuc3RhdGUudmlldyA9PT0gMSApIHtcbiAgICBjb25zb2xlLmxvZyggJ1Nrb2xsIGlzIG9wZW4nICk7XG59XG5cbmBgYFxuXG5fX3BhcmFtc19fXG5cbi0gb3B0aW9ucyB7IE9iamVjdCB9IC0gQW4gb2JqZWN0IHRoYXQgd2lsbCBzdG9yZSBzb21lIGluZm9ybWF0aW9uIHRoYXQgcGVydGFpbnMgdG8gdGhlIHZpZXcgb25jZSBiZWluZyBvcGVuZWQuXG4gICAgLSBvcHRpb25zLm1ldGEgeyBPYmplY3QgfSAtIEFuIG9iamVjdCB0aGF0IGhvbGRzIGRhdGEgYWJvdXQgY3VycmVudCBzdGF0ZSBvZiBhcHAgdGhhdCBpcyBvcGVuaW5nIHZpZXcgY2V0YWluIHBsdWdpbnMsIG9yIHRhYnMsIHRha2UgZGlmZmVybnQgdHlwZXMgb2YgaW5mb3JtYXRpb24gaW4gdGhpcyBhcmVhIHRvIGZ1bmN0aW9uIHByb3Blcmx5LiBfU2VlIHNwZWNpZmljIHBsdWdpbl8gYFBsdWdpbjo6b3BlbiAtPiBvcHRpb25zYCBmb3IgbW9yZSBzcGVjaWZpYyBkZXRhaWxzIHNpbmNlIGBvcHRpb25zLm1ldGFgIGlzIGdlbmVyYWx5IGp1c3QgcGFzc2VkIHRvIHRoZSBwbHVnaW4gYXMgdGhhdCBvYmplY3QuXG4gICAgLSBvcHRpb25zLnBsdWdpbiB7IFN0cmluZyB9IC0gdGhpcyBpcyB0aGUgbmFtZSBvZiB0aGUgcGx1Z2luIHRvIGhhdmUgb3BlbiB3aGVuIGNhbGxpbmcgdGhlIG9wZW4gZm4uIFRoaXMgd2lsbCBhbHNvIHRyaWdnZXIgYSBgUGx1Z2luOjpvcGVuYC4gU2luY2UgbW9zdCBvZiB0aGUgYmFzaWMgZnVuY3Rpb25hbGl0eSBpcyB3cml0dGVuIGFzIGEgcGx1Z2luIHRoaXMgY2FuIGJlIHVzZWQgdG8gb3BlbiBkZWZhdWx0IHZpZXdzLiBBbHNvIGlmIG5vIG5hbWUgaXMgZ2l2ZW4gdGhlbiBpdCBkZWZhdWx0cyB0byB0aGUgbWFpbiBgdXBsb2FkLXBob3RvYCBwbHVnaW4uXG5cbl9fcmV0dXJuc19fXG5cbi0gUGx1Z2luIHsgT2JqZWN0IH0gLSBwbHVnaW4gdGhhdCBpcyBvcGVuZWRcblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICk7XG5cblNrb2xsLm9wZW4oIHtcbiAgICBtZXRhOiB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQXdlc29tZSBjYXRzIGFuZCBwaXp6YVxcJ3MgaW4gc3BhY2UnXG4gICAgfSxcbiAgICBwbHVnaW46ICdnaXBoeS1zZWFyY2gnICBcbn0gKTsgXG5cbmBgYFxuKi9cblxuU2tvbGwucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIGRlZmF1bHRQbHVnaW4gPSB0aGlzLmRlZmF1bHRzLnBsdWdpbixcbiAgICAgICAgcGx1Z2luTmFtZSA9ICBvcHRpb25zLnBsdWdpbiB8fCBkZWZhdWx0UGx1Z2luLFxuICAgICAgICBwbHVnaW4gPSB0aGlzLnBsdWdpbnNbIHBsdWdpbk5hbWUgXSB8fCB0aGlzLnBsdWdpbnNbIGRlZmF1bHRQbHVnaW4gXTtcbiAgICAgICAgLy8gY2xvc2UgPSB0aGlzLmNsb3NlLmJpbmQoIHRoaXMgKTtcblxuICAgIG9wdGlvbnMucGx1Z2luID0gcGx1Z2luTmFtZTtcbiAgICB0aGlzLnByZXZQbHVnaW4gPSB0aGlzLmN1cnJlbnRQbHVnaW47XG4gICAgdGhpcy5jdXJyZW50UGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMubWV0YSA9IG9wdGlvbnMubWV0YSB8fCB7fTtcblxuICAgIC8vIHVwZGF0ZSBsaW5rc1xuICAgIHRoaXMubGlzdEVsLmlubmVySFRNTCA9ICcnO1xuXG4gICAgdGhpcy5wbHVnaW5MaXN0LmZvckVhY2goIHRoaXMubGlzdEVsLmFwcGVuZENoaWxkLmJpbmQoIHRoaXMubGlzdEVsICkgKTtcblxuICAgIHRoaXMuZWwuY2xhc3NMaXN0LmFkZCggJ3Nob3cnICk7XG4gICAgdGhpcy5zdGF0ZS52aWV3ID0gMTtcbiAgICAvLyBvcGVuIHBsdWdpblxuICAgIGlmICggIXBsdWdpbiApIHtcbiAgICAgICAgdGhpcy5lbWl0KCAnZXJyb3InLCBuZXcgRXJyb3IoICdObyBQbHVnaW4gaXMgZm91bmQgd2l0aCB0aGUgbmFtZSAnICsgcGx1Z2luTmFtZSApICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcGx1Z2luLm9wZW4oIG9wdGlvbnMubWV0YSB8fCB7fSwgdGhpcywgdGhpcy5faGFuZGxlUGx1Z2luT3Blbi5iaW5kKCB0aGlzLCBvcHRpb25zICkgKTtcbiAgICAvLyBuZWVkIHRvIHVuYmluZCB0aGlzXG4gICAgLy8gZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleXVwJywgZnVuY3Rpb24oIGUgKSB7XG4gICAgLy8gICAgdmFyIGNvZGUgPSBlLmtleUNvZGUgfHwgZS53aGljaDtcbiAgICAvLyAgICAgY2xvc2UoKTtcbiAgICAvLyB9ICk7XG5cbiAgICB0aGlzLmVtaXQoICdvcGVuJywgcGx1Z2luICk7IFxuXG59O1xuXG5cbi8qXG4jIyMgU2tvbGw6OmNsb3NlXG5cblRoaXMgd2lsbCByZW1vdmUgdGhlIGBzaG93YCBmcm9tIHRoZSB1cGxvYWRlciBtb2RhbCBjb250YWluZXIuIFRoaXMgd2lsbCBhbHNvIHRyaWdnZXIgYFBsdWdpbjo6dGVhcmRvd25gIHRvIHRoZSBjdXJyZWN0IGFjdGl2ZSBwbHVnaW4uXG5cbmBgYGphdmFzY3JpcHRcbnZhciBTa29sbCA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5Ta29sbC5vcGVuKCk7XG5maWxlVXBsYWRlci5jbG9zZSgpO1xuXG5pZiAoICFTa29sbC5zdGF0ZS52aWV3ICkge1xuICAgIGNvbnNvbGUubG9nKCAnU2tvbGwgaXMgY2xvc2VkJyApO1xufVxuXG5gYGBcbiovXG5cblNrb2xsLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdGhpcy5lbC5jbGFzc0xpc3QucmVtb3ZlKCAnc2hvdycgKTtcbiAgICB0aGlzLnN0YXRlLnZpZXcgPSAwO1xuXG4gICAgdGhpcy5jb250ZW50RWwuaW5uZXJIVE1MID0gJyc7XG4gICAgaWYgKCB0aGlzLmN1cnJlbnRQbHVnaW4gJiYgdHlwZW9mIHRoaXMuY3VycmVudFBsdWdpbi50ZWFyZG93biA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgdGhpcy5jdXJyZW50UGx1Z2luLnRlYXJkb3duKCk7XG4gICAgICAgIHRoaXMuY3VycmVudFBsdWdpbiA9IG51bGw7XG4gICAgfVxuXG4gICAgdGhpcy5lbWl0KCAnY2xvc2UnICk7XG5cbn07XG5cbi8qXG4jIyMgU2tvbGw6OnVwbG9hZFxuXG5VcGxvYWQgbWV0aG9kIGlzIGEgcHJveHkgdG8gdGhlIFVwbG9hZCBhZGFwdGVyIHRoYXQgc2hvdWxkIGJlIHByb3ZpZGVkLiBUaGlzIGlzIHVzZWQgbWFpbmx5IHRvIG5vcm1hbGl6ZSBzb21lIG9mIHRoZSBldmVudCBkYXRhIGFsbG93aW5nIGl0IHRvIGJlIGluIGEgY29tbW9uIGZvcm1hdCB0aGF0IHVwbG9hZGVyIGFkYXB0ZXJzIGNhbiBlYXNpbHkgZGVhbCB3aXRoLiBUaGlzIGlzIG1haW5seSB0byBiZSB1c2VkIGluc2lkZSBvZiBwbHVnaW5zXG5cbl9fcGFyYW1zX19cblxuLSB0YXJnZXQgeyBPYmplY3QgfSAtIFRoaXMgaXMgYSBvYmplY3QgdGhhdCB3aWxsIGhhdmUgdGhlIGtleSBGaWxlcyBpbiBpdC4gSXQgaXMgc29tZXRoaW5nIHNpbWlsaWFyIHRvIHRoZSBgZXZlbnQudGFyZ2V0YCBvYmplY3QgeW91IHdvdWxkIGdldCBvbiBhIGNoYW5nZSBldmVudCBvZiBhIGZpbGUgdHlwZSBpbnB1dC5cbiAgICAtIHRhcmdldC5maWxlcyB7IEFycmF5IH0gLSBUaGlzIGNhbiBiZSBhIGBCbG9iYCBvciBhbiBvYmplY3Qgd2l0aCB0aGUga2V5IGB1cmxgIGluc2lkZSBvZiBpdC4gZWcuIGBbeyB1cmw6IGh0dHBzOi8vcGJzLnR3aW1nLmNvbS9wcm9maWxlX2ltYWdlcy81NDQwMzk3Mjg0NjMzNTE4MDgvTmtvUmRCQkxfYmlnZ2VyLnBuZyB9XWAuIFdoZW4gY3JlYXRpbmcgYW4gZXZlbnQgdGhpcyB3aWxsIGF0dGVtcHQgdG8gY29udmVydCB0aGlzIHVybCBpbnRvIGEgYmxvYiBpZiBpdCBpcyBhbiBpbWFnZSwgb3RoZXJ3aXNlIGl0IHdpbGwganVzdCBwYXNzIHRoZSBvYmplY3QgdG8gdGhlIHVwbG9hZCBhZGFwdGVyLlxuKi9cblxuXG5Ta29sbC5wcm90b3R5cGUudXBsb2FkID0gZnVuY3Rpb24oIHRhcmdldCApIHsgXG5cbiAgICBpZiAoIHR5cGVvZiB0YXJnZXQuZmlsZXMgIT09ICdvYmplY3QnICkgeyAvLyBkZWZhdWx0IHVwbG9hZCBldmVudHMgYXJlIG5vdCBhIHRydWUgYXJyYXlcbiAgICAgICAgdGhpcy5lbWl0KCAnZXJyb3InLCBuZXcgRXJyb3IoICd0YXJnZXQgcGFzc2VkIHRvIFNrb2xsOjp1cGxvYWQgZG9lcyBub3QgaGF2ZSBmaWxlcyBhcnJheScgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgdGhpcy51cGxvYWRGbiAhPT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgLy8gZXJyb3JcbiAgICAgICAgdGhpcy5lbWl0KCAnZXJyb3InLCBuZXcgRXJyb3IoICdObyB1cGxvYWQgZnVuY3Rpb24gYWRkZWQgdXNpbmcgU2tvbGw6OnVzZVRvVXBsb2FkJyApICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgY2xvc2UgPSB0aGlzLmNsb3NlLmJpbmQoIHRoaXMgKSxcbiAgICAgICAgdXBsb2FkRm4gPSB0aGlzLnVwbG9hZEZuLFxuICAgICAgICBjbG9zZU9uVXBsb2FkID0gdGhpcy5kZWZhdWx0cy5jbG9zZU9uVXBsb2FkLFxuICAgICAgICBlcnJvciA9IHRoaXMuZW1pdC5iaW5kKCB0aGlzLCAnZXJyb3InICk7XG5cbiAgICB0aGlzLl9jcmVhdGVFdmVudCggdGFyZ2V0LCBmdW5jdGlvbiggZXJyLCB1cGxvYWRFdmVudCApIHtcbiAgICAgICAgaWYgKCBlcnIgKSB7XG4gICAgICAgICAgICBlcnJvciggZXJyICk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB1cGxvYWRGbiggdXBsb2FkRXZlbnQgKTtcbiAgICAgICAgaWYgKCBjbG9zZU9uVXBsb2FkICkgeyAvLyB0aGlzIHNob3VsZCBiZSBjaGFuZ2FibGVcbiAgICAgICAgICAgIGNsb3NlKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9ICk7XG59O1xuXG4vKlxuIyMjIFNrb2xsOjpwcmV2aWV3XG5cbnByZXZpZXcgbWV0aG9kIGlzIGEgZWFzeSB3YXkgdG8gb3BlbiB1cCB0aGUgdXNlIG9yIGNhbmNlbCBkaWFsb2cuIFRoaXMgd2lsbCBvcGVuIHVwIHRoZSBwcmV2aWV3IHBsdWdpbiB0aGF0IGlzIHJlZ2lzdGVyZWQgd2l0aCB0aGUgc3lzdGVtIHRvIHByZXZpZXcgdGhlIHNlbGVjdGlvbi4gXG5cbl9fcGFyYW1zX19cblxuLSB0YXJnZXQgeyBPYmplY3QgfSAtIFRoaXMgaXMgYSBvYmplY3QgdGhhdCB3aWxsIGhhdmUgdGhlIGtleSBGaWxlcyBpbiBpdC4gSXQgaXMgc29tZXRoaW5nIHNpbWlsaWFyIHRvIHRoZSBgZXZlbnQudGFyZ2V0YCBvYmplY3QgeW91IHdvdWxkIGdldCBvbiBhIGNoYW5nZSBldmVudCBvZiBhIGZpbGUgdHlwZSBpbnB1dC5cbiAgICAtIHRhcmdldC5maWxlcyB7IEFycmF5IH0gLSBUaGlzIGNhbiBiZSBhIGBCbG9iYCBvciBhbiBvYmplY3Qgd2l0aCB0aGUga2V5IGB1cmxgIGluc2lkZSBvZiBpdC4gZWcuIGBbeyB1cmw6IGh0dHBzOi8vcGJzLnR3aW1nLmNvbS9wcm9maWxlX2ltYWdlcy81NDQwMzk3Mjg0NjMzNTE4MDgvTmtvUmRCQkxfYmlnZ2VyLnBuZyB9XWAuIFdoZW4gY3JlYXRpbmcgYW4gZXZlbnQgdGhpcyB3aWxsIGF0dGVtcHQgdG8gY29udmVydCB0aGlzIHVybCBpbnRvIGEgYmxvYiBpZiBpdCBpcyBhbiBpbWFnZSwgb3RoZXJ3aXNlIGl0IHdpbGwganVzdCBwYXNzIHRoZSBvYmplY3QgdG8gdGhlIHVwbG9hZCBhZGFwdGVyLlxuKi9cblxuXG5Ta29sbC5wcm90b3R5cGUucHJldmlldyA9IGZ1bmN0aW9uKCB0YXJnZXQgKSB7XG4gICAgXG4gICAgaWYgKCB0eXBlb2YgdGFyZ2V0LmZpbGVzICE9PSAnb2JqZWN0JyApIHsgLy8gZGVmYXVsdCB1cGxvYWQgZXZlbnRzIGFyZSBub3QgYSB0cnVlIGFycmF5XG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAndGFyZ2V0IHBhc3NlZCB0byBTa29sbDo6dXBsb2FkIGRvZXMgbm90IGhhdmUgZmlsZXMgYXJyYXknICkgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBvcGVuID0gdGhpcy5vcGVuLmJpbmQoIHRoaXMgKSxcbiAgICAgICAgbWV0YSA9IHRoaXMubWV0YTtcblxuICAgIHRoaXMuX2NyZWF0ZUV2ZW50KCB0YXJnZXQsIGZ1bmN0aW9uKCBlcnIsIHVwbG9hZEV2ZW50ICkge1xuICAgICAgICBtZXRhLmV2ZW50ID0gdXBsb2FkRXZlbnQ7XG4gICAgICAgIG9wZW4oIHsgXG4gICAgICAgICAgICBtZXRhOiBtZXRhLFxuICAgICAgICAgICAgcGx1Z2luOiAncHJldmlldycgXG4gICAgICAgIH0gKTtcbiAgICB9ICk7XG5cbn07XG5cblxuLypcbl9fcGFyYW1zX19cblxuLSB0YXJnZXQgeyBPYmplY3QgfSAtIFRoaXMgaXMgYSBvYmplY3QgdGhhdCB3aWxsIGhhdmUgdGhlIGtleSBGaWxlcyBpbiBpdC4gSXQgaXMgc29tZXRoaW5nIHNpbWlsaWFyIHRvIHRoZSBgZXZlbnQudGFyZ2V0YCBvYmplY3QgeW91IHdvdWxkIGdldCBvbiBhIGNoYW5nZSBldmVudCBvZiBhIGZpbGUgdHlwZSBpbnB1dC5cbiAgICAtIHRhcmdldC5maWxlcyB7IEFycmF5IH0gLSBUaGlzIGNhbiBiZSBhIGBCbG9iYCBvciBhbiBvYmplY3Qgd2l0aCB0aGUga2V5IGB1cmxgIGluc2lkZSBvZiBpdC4gZWcuIGBbeyB1cmw6IGh0dHBzOi8vcGJzLnR3aW1nLmNvbS9wcm9maWxlX2ltYWdlcy81NDQwMzk3Mjg0NjMzNTE4MDgvTmtvUmRCQkxfYmlnZ2VyLnBuZyB9XWAuIFdoZW4gY3JlYXRpbmcgYW4gZXZlbnQgdGhpcyB3aWxsIGF0dGVtcHQgdG8gY29udmVydCB0aGlzIHVybCBpbnRvIGEgYmxvYiBpZiBpdCBpcyBhbiBpbWFnZSwgb3RoZXJ3aXNlIGl0IHdpbGwganVzdCBwYXNzIHRoZSBvYmplY3QgdG8gdGhlIHVwbG9hZCBhZGFwdGVyLlxuKi9cblxuLypcbiMjIyBTa29sbDo6YWRkUGx1Z2luXG5cblRoaXMgd2lsbCBhZGQgYSBwbHVnaW4gdG8gdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIHBsdWdpbnMuIE1lYW5pbmcgdGhhdCBpdCB3aWxsIGFsc28gYWRkIHRoZSBwbHVnaW4gbmFtZSB0byB0aGUgbGlzdCBvZiBfdGFiYWJsZV8gcGx1Z2lucywgYW5kIHRhcmdldHMgdG8gb3BlbiB3aGVuIG9wZW5pbmcgdGhlIGBTa29sbGAuXG5cbl9fcGFyYW1zX19cblxuLSBwbHVnaW4geyBPYmplY3QgfSAtIEEgYFBsdWdpbmAgb2JqZWN0IHRoYXQgaGFzIGEgbnVtYmVyIG9mIGRpZmZlcm50IGF0dHJpYnV0ZXMgb24gdGhlIHBsdWdpbiB0byBhbGxvdyB0aGUgYFNrb2xsYCB0byByZWFkIGFuZCBpbnRlcmFjdCB3aXRoIHRoZSBwbHVnaW4uIElmIHNvbWUgcmVxdWlyZWQgbWV0aG9kcyBhcmUgbm90IHByb3ZpZGVkIHRoZSBwbHVnaW4gd2lsbCBub3QgYmUgYWRkZWQgYW5kIGFuIGBlcnJvcmAgZXZlbnQgd2lsbCBiZSBlbWl0dGVkIGZyb20gdGhlIFNrb2xsLlxuXG4tIG9wdGlvbnMgeyBPYmplY3QgfSAtIF9PcHRpb25hbF8gQSBvcHRpb25hbCBvYmplY3QgdGhhdCBjYW4gc3BlY2lmeSB0aGUgYmVoYXZpb3IgaW4gd2hpY2ggdGhlIGBTa29sbGAgYmVoYXZlcyB3aXRoIHBsdWdpbi4gXG4gIC0gb3B0aW9ucy5tZW51SXRlbSB7IEJvb2xlYW4gfSAtIF9PcHRpb25hbF8gQSBmbGFnIHRvIHNwZWNpZnkgaWYgdGhlIHBsdWdpbiBzaG91bGQgYmUgbGlua2VkIHRvIGluIGEgbGlzdCBvZiBwbHVnaW5zLlxuXG5fX3JldHVybnNfX1xuXG4tIHBsdWdpbiB7IE9iamVjdCB9IC0gQSBjb3B5IG9mIHRoZSBgUGx1Z2luYCBvYmplY3QgYmFjayB3aXRoIHRoZSBgaXNBZGRlZGAgcHJvcGVydHkgc2V0IHRvIHRydWUgaWYgc3VjY2Vzc2Z1bGwgYWRkZWQgdG8gdGhlIGBTa29sbGBcblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICksXG4gICAgZm9vID0ge1xuICAgICAgICBvcGVuOiBmdW5jdGlvbigpe31cbiAgICB9LFxuICAgIGJhciA9IHtcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKXt9LFxuICAgICAgICB0ZWFyZG93bjogZnVuY3Rpb24oKXt9LFxuICAgICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICAgICAgICBuYW1lOiAnQmFyJ1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwbHVnaW5Gb28gPSBTa29sbC5hZGRQbHVnaW4oIGZvbyApLFxuICAgIHBsdWdpbkJhciA9IFNrb2xsLmFkZFBsdWdpbiggYmFyICk7XG5cbnBsdWdpbkZvby5pc0FkZGVkIC8vIGZhbHNlIC0gbWlzc2luZyBzb21lIHJlcXVpcmVkIG1ldGhvZHNcbnBsdWdpbkJhci5pc0FkZGVkIC8vIHRydWVcbmBgYFxuKi9cblxuU2tvbGwucHJvdG90eXBlLmFkZFBsdWdpbiA9IGZ1bmN0aW9uKCBwbHVnaW4sIG9wdGlvbnMgKSB7XG4gICAgXG4gICAgdmFyIF9wbHVnaW4gPSBtZXJnZSggdHJ1ZSwge30sIHBsdWdpbiB8fCB7fSApO1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYgKCAhU2tvbGwuaXNQbHVnaW4oIHBsdWdpbiApICl7XG4gICAgICAgIF9wbHVnaW4uaXNBZGRlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gX3BsdWdpbjtcbiAgICB9ICBcblxuICAgIHRoaXMucGx1Z2luc1sgX3BsdWdpbi5hdHRyaWJ1dGVzLm5hbWUgXSA9IF9wbHVnaW47XG4gICAgX3BsdWdpbi5pc0FkZGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gX3BsdWdpbjtcblxufTtcblxuLypcbiMjIyBTa29sbDo6dXNlVG9VcGxvYWRcblxuVGhpcyBpcyBhIHdheSB0byBleHRlbmQgdGhlIGZpbGUgdXBsb2FkZXIgdG8gYWxsb3cgZm9yIGN1c3RvbSB3YXlzIHRvIHVwbG9hZCBmaWxlcyB0byB5b3VyIHNlcnZlci4gXG5cbl9fcGFyYW1zX19cblxuLSB1cGxvYWRGbiB7IEZ1bmN0aW9uIH0gLSBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiBldmVyIGFuIGFzc2V0IGlzIGF0dGVtcHRlZCB0byBiZSB1cGxvYWRlZC4gRHVlIHRvIHRoZSBwbHVnZ2FibGl0eSBvZiB0aGlzIG1vZGFsIHRoaXMgY2FuIGJlIGEgbnVtYmVyIG9mIHRoaW5ncyBkZXBlbmRpbmcgb24gdGhlIG5hdHVyZSBvZiB0aGUgcGx1Z2luLiBUaGlzIGNhbiBhbHNvIGJlIHVzZWQgdG8gc2F2ZSBpbmZvcm1hdGlvbiB0byB5b3UgZGF0YWJhc2UgYWJvdXQgdGhlIGRhdGEgYmVpbmcgdXBsb2FkZWQuXG5cbnVwbG9hZEZuIGlzIHBhc3NlZCBhbiBVcGxvYWRFdmVudCBvYmplY3QgdGhhdCBoYXMgYSBudW1iZXIgb2YgaG9va3MgdGhhdCB5b3UgY2FuIHRpZSB5b3VyIHVwbG9hZGVyIGludG8gdG8gYWxsb3cgZm9yIGFuIGludGVyYWN0aXZlIGV4cGVyaWVuY2Ugd2hpbGUgdXBsb2FkaW5nIHBob3Rvcy4gU2VlIGBVcGxvYWRFdmVudGAgb2JqZWN0IHNwZWNpZmljYXRpb24gdG8gc2VlIGhvdyB0byBob29rIGludG8gdGhpcyBmdW5jdGlvbmFsaXR5XG5cbmBgYGphdmFzY3JpcHRcbnZhciBTa29sbCA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5Ta29sbC51c2VUb1VwbG9hZCggZnVuY3Rpb24oIDxVcGxvYWRFdmVudD4gKSB7XG4gICAgdmFyIGZpbGVzID0gZXZlbnQuZmlsZXM7IC8vIHRoaXMgaXMgY29tbWl0aW5nIGZyb20gYSBpbnB1dCBmaWxlIGV2ZW50XG4gICAgLy8gYmxhaCBibGFoIHVwbG9hZFxuICAgIGZlZWRiYWNrRm5zLmRvbmUoe1xuICAgICAgICBmaWxlc1t7IHVybDogJ2h0dHA6Ly9mb28uYmFyL2Jhei5wbmcnIH1dXG4gICAgfSlcbn0gKTtcbmBgYFxuKi9cblxuU2tvbGwucHJvdG90eXBlLnVzZVRvVXBsb2FkID0gZnVuY3Rpb24oIGZuICkge1xuICAgIGlmICggdHlwZW9mIGZuID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICB0aGlzLnVwbG9hZEZuID0gZm47XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmVtaXQoICdlcnJvcicsIG5ldyBFcnJvciggJ3VzZVRvVXBsb2FkIG5lZWRzIHRvIGJlIHBhc3NlZCBhIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBwYXJhbWV0ZXIsICcgKyB0eXBlb2YgZm4gKyAnIGdpdmVuLicgKSApO1xufTtcblxuXG4vLyBzdGFydCBwcml2YXRlIG1ldGhvZHNcblxuU2tvbGwucHJvdG90eXBlLl9jcmVhdGVFdmVudCA9IGZ1bmN0aW9uKCB0YXJnZXQsIGNhbGxiYWNrICkgeyBcblxuICAgIHZhciBfZXZlbnQgPSB7fSxcbiAgICAgICAgZXJyb3IgPSB0aGlzLmVtaXQuYmluZCggdGhpcywgJ2Vycm9yJyApO1xuXG4gICAgX2V2ZW50LmZpbGVzID0gdGFyZ2V0LmZpbGVzO1xuICAgIF9ldmVudC5vcmlnaW5hbEV2ZW50ID0gdGFyZ2V0O1xuXG4gICAgLy8gd2F5cyB0byBnaXZlIGZlZWRiYWNrIHRvIFNrb2xsXG4gICAgX2V2ZW50LmRvbmUgPSB0aGlzLmVtaXQuYmluZCggdGhpcywgJ2RvbmUnICk7XG4gICAgX2V2ZW50LmVycm9yID0gZXJyb3I7XG5cbiAgICBuZXcgVXBsb2FkRXZlbnQoIF9ldmVudCwgY2FsbGJhY2sgKTtcblxufTtcblxuU2tvbGwuaXNQbHVnaW4gPSBmdW5jdGlvbiggcGx1Z2luICkge1xuXG4gICAgaWYgKCAhcGx1Z2luIHx8IHR5cGVvZiBwbHVnaW4gIT09ICdvYmplY3QnICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgcGx1Z2luLm9wZW4gIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHBsdWdpbi50ZWFyZG93biAhPT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICggIXBsdWdpbi5hdHRyaWJ1dGVzICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgcGx1Z2luLmF0dHJpYnV0ZXMubmFtZSAhPT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cblNrb2xsLnBsdWdpblZpc2libGUgPSBmdW5jdGlvbiggcGx1Z2luICkge1xuICAgIHJldHVybiAhcGx1Z2luLmF0dHJpYnV0ZXMuaGlkZTtcbn07XG5cblNrb2xsLm1hcFBsdWdpbnMgPSBmdW5jdGlvbiggcGx1Z2lucyApIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oIHBsdWdpbk5hbWUgKSB7XG4gICAgICAgIHJldHVybiBwbHVnaW5zWyBwbHVnaW5OYW1lIF07XG4gICAgfTtcbn07XG5cblNrb2xsLnBsdWdpbkxpc3RFbCA9IGZ1bmN0aW9uKCBjdXJyZW50UGx1Z2luICkge1xuXG4gICAgdmFyIGN1cnJlbnRQbHVnaW5OYW1lID0gY3VycmVudFBsdWdpbi5hdHRyaWJ1dGVzLm5hbWU7IFxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCBwbHVnaW4gKSB7XG4gICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaScgKSxcbiAgICAgICAgICAgIHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKSxcbiAgICAgICAgICAgIG5hbWUgPSBwbHVnaW4uYXR0cmlidXRlcy5uYW1lO1xuXG4gICAgICAgIC8vIGNvbnNpZGVyIHNvbWUgd2F5IHRvIHVzZSBpY29uc1xuICAgICAgICBzcGFuLnRleHRDb250ZW50ID0gbmFtZTtcbiAgICAgICAgZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1wbHVnaW4tbmFtZScsIG5hbWUgKTtcbiAgICAgICAgZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0JywgJ3Nrb2xsLnBsdWdpbi5vcGVuJyApO1xuICAgICAgICBlbC5hcHBlbmRDaGlsZCggc3BhbiApO1xuICAgICAgICBpZiAoIG5hbWUgPT09IGN1cnJlbnRQbHVnaW5OYW1lICkge1xuICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1wbHVnaW4tc2VsZWN0ZWQnLCB0cnVlICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZWw7ICAgICAgICBcbiAgICB9O1xuXG59O1xuXG5Ta29sbC5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiggKSB7XG5cbiAgICAvLyB0aGlzLmVsICYmIHRoaXMubGlzdEVsIGlzIGJ1aWx0IGluIHRoZSBjb25zdHJ1Y3RvclxuICAgIHZhciBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50LmJpbmQoIGRvY3VtZW50LCAnZGl2JyApOyBcblxuICAgIHRoaXMudGFibGVFbCA9IGRpdigpO1xuICAgIHRoaXMuY2VsbEVsID0gZGl2KCk7XG4gICAgdGhpcy5tb2RhbEVsID0gZGl2KCk7XG4gICAgdGhpcy5jbG9zZUVsID0gZGl2KCk7XG4gICAgLy8gY2xhc3Npbmcgc3RydWN0dXJlXG4gICAgdGhpcy5lbC5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtbW9kYWwtb3ZlcmxheScgKTtcbiAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcsICdza29sbC5jbG9zZScgKTtcbiAgICB0aGlzLnRhYmxlRWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsLXRhYmxlJyApOyAvLyB0aGlzIGlzIGhlcmUgdG8gYWxsb3cgdmVydGljYWwgY2VudGVyaW5nXG4gICAgdGhpcy5jZWxsRWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsLWNlbGwnICk7XG4gICAgdGhpcy5jbG9zZUVsLmNsYXNzTGlzdC5hZGQoICdza29sbC1tb2RhbC1jbG9zZScgKTtcbiAgICB0aGlzLmNsb3NlRWwuc2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0JywgJ3Nrb2xsLmNsb3NlJyApO1xuICAgIHRoaXMubW9kYWxFbC5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtbW9kYWwnICk7XG4gICAgdGhpcy5tb2RhbEVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcsICdza29sbC5tb2RhbC5zdG9wUHJvcGFnYXRpb24nICk7XG4gICAgdGhpcy5tb2RhbEVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdC1vcHRpb25zJywgJ2FsbG93ZGVmYXVsdCcgKTtcbiAgICB0aGlzLmNvbnRlbnRFbC5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtbW9kYWwtY29udGVudCcgKTtcbiAgICB0aGlzLmxpc3RFbC5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtbW9kYWwtbGlzdCcgKTtcbiAgICAvLyBhZGRpbmcgdGhlbSBhbGwgdG9nZXRoZXJcbiAgICB0aGlzLmVsLmFwcGVuZENoaWxkKCB0aGlzLnRhYmxlRWwgKTtcbiAgICB0aGlzLnRhYmxlRWwuYXBwZW5kQ2hpbGQoIHRoaXMuY2VsbEVsICk7XG4gICAgdGhpcy5jZWxsRWwuYXBwZW5kQ2hpbGQoIHRoaXMubW9kYWxFbCApO1xuICAgIHRoaXMubW9kYWxFbC5hcHBlbmRDaGlsZCggdGhpcy5saXN0RWwgKTtcbiAgICB0aGlzLm1vZGFsRWwuYXBwZW5kQ2hpbGQoIHRoaXMuY2xvc2VFbCApO1xuICAgIHRoaXMubW9kYWxFbC5hcHBlbmRDaGlsZCggdGhpcy5jb250ZW50RWwgKTtcblxuICAgIC8qIEhUTUwgcmVwZXNlbnRhdGlvblxuICAgIFxuICAgIDxkaXYgY2xhc3M9XCJza29sbC1tb2RhbC1vdmVybGF5XCIgPlxuICAgICAgICA8ZGl2IGNsYXNzPVwic2tvbGwtbW9kYWwtdGFibGVcIiA+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2tvbGwtbW9kYWwtY2VsbFwiID5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2tvbGwtbW9kYWxcIiA+XG4gICAgICAgICAgICAgICAgICAgIDx1bCBjbGFzcz1cInNrb2xsLW1vZGFsLWxpc3RcIj48L3VsPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2tvbGwtbW9kYWwtY2xvc2VcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNrb2xsLW1vZGFsLWNvbnRlbnRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICAqL1xuXG4gICAgLy8gYmluZCBzb21lIGV2ZW50cyB0byBkb21cbiAgICBlbWl0Lm9uKCAnc2tvbGwuY2xvc2UnLCB0aGlzLmNsb3NlLmJpbmQoIHRoaXMgKSApO1xuICAgIGVtaXQub24oICdza29sbC5wbHVnaW4ub3BlbicsIHRoaXMuX29uUGx1Z2luT3Blbi5iaW5kKCB0aGlzICkgKTtcblxuXG59O1xuXG5Ta29sbC5wcm90b3R5cGUuX29uUGx1Z2luT3BlbiA9IGZ1bmN0aW9uKCBlICkge1xuICAgIHZhciBlbCA9IGUuZW1pdFRhcmdldDtcbiAgICB0aGlzLm9wZW4oIHtcbiAgICAgICAgbWV0YTogdGhpcy5tZXRhLCBcbiAgICAgICAgcGx1Z2luOiBlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXBsdWdpbi1uYW1lJyApIFxuICAgIH0gKTtcbn07XG5cblNrb2xsLnByb3RvdHlwZS5faGFuZGxlUGx1Z2luT3BlbiA9IGZ1bmN0aW9uKCBvcHRpb25zLCBlcnIsIGVsICkge1xuXG4gICAgdmFyIGRlZmF1bHRQbHVnaW4gPSB0aGlzLmRlZmF1bHRzLnBsdWdpbixcbiAgICAgICAgb3BlbkRlZmF1bHQgPSB0aGlzLm9wZW4uYmluZCggdGhpcywgbWVyZ2UoIG9wdGlvbnMsIHsgXG4gICAgICAgICAgICBwbHVnaW46IGRlZmF1bHRQbHVnaW5cbiAgICAgICAgfSApICk7XG5cbiAgICBpZiAoIHRoaXMucHJldlBsdWdpbiApIHtcbiAgICAgICAgdGhpcy5wcmV2UGx1Z2luLnRlYXJkb3duKCk7XG4gICAgfVxuXG4gICAgaWYgKCBlcnIgKSB7XG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgZXJyICk7XG4gICAgICAgIGlmICggb3B0aW9ucy5wbHVnaW4gIT09IGRlZmF1bHRQbHVnaW4gKSB7XG4gICAgICAgICAgICBvcGVuRGVmYXVsdCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmlubmVySFRNTCA9IGVsO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgZWwgPT09ICdvYmplY3QnICYmIGVsLnRhZ05hbWUgKSB7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmlubmVySFRNTCA9ICcnO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hcHBlbmRDaGlsZCggZWwgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG9wZW5EZWZhdWx0KCk7IC8vIGp1c3QgdHJ5IHRvIG9wZW4gZGVmYXVsdCB3aGVuIG5vIGNvbnRlbnQgaXMgZ2l2ZW5cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IFNrb2xsKCk7XG5tb2R1bGUuZXhwb3J0cy5Ta29sbCA9IFNrb2xsO1xubW9kdWxlLmV4cG9ydHMuVXBsb2FkRXZlbnQgPSBVcGxvYWRFdmVudDtcbm1vZHVsZS5leHBvcnRzLmltYWdlVG9CbG9iID0gcmVxdWlyZSggJ2ltYWdlLXRvLWJsb2InICk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBFdmVudEVtaXR0ZXIyID0gcmVxdWlyZSggJ2V2ZW50ZW1pdHRlcjInICkuRXZlbnRFbWl0dGVyMjtcblxuLypcbiAgICBkZXBlbmRlbmNpZXNcbiovXG5cbi8qIGJpbmRpbmcgKi9cbnZhciBiaW5kaW5nTWV0aG9kID0gd2luZG93LmFkZEV2ZW50TGlzdGVuZXIgPyAnYWRkRXZlbnRMaXN0ZW5lcicgOiAnYXR0YWNoRXZlbnQnO1xudmFyIGV2ZW50UHJlZml4ID0gYmluZGluZ01ldGhvZCAhPT0gJ2FkZEV2ZW50TGlzdGVuZXInID8gJ29uJyA6ICcnO1xuXG5mdW5jdGlvbiBiaW5kKCBlbCwgdHlwZSwgZm4sIGNhcHR1cmUgKSB7XG4gICAgZWxbIGJpbmRpbmdNZXRob2QgXSggZXZlbnRQcmVmaXggKyB0eXBlLCBmbiwgY2FwdHVyZSB8fCBmYWxzZSApO1xuICAgIHJldHVybiBmbjtcbn1cblxuLyogbWF0Y2hpbmcgKi9cbnZhciB2ZW5kb3JNYXRjaCA9IEVsZW1lbnQucHJvdG90eXBlLm1hdGNoZXMgfHwgRWxlbWVudC5wcm90b3R5cGUud2Via2l0TWF0Y2hlc1NlbGVjdG9yIHx8IEVsZW1lbnQucHJvdG90eXBlLm1vek1hdGNoZXNTZWxlY3RvciB8fCBFbGVtZW50LnByb3RvdHlwZS5tc01hdGNoZXNTZWxlY3RvciB8fCBFbGVtZW50LnByb3RvdHlwZS5vTWF0Y2hlc1NlbGVjdG9yO1xuXG5mdW5jdGlvbiBtYXRjaGVzKCBlbCwgc2VsZWN0b3IgKSB7XG4gICAgaWYgKCAhZWwgfHwgZWwubm9kZVR5cGUgIT09IDEgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCB2ZW5kb3JNYXRjaCApIHtcbiAgICAgICAgcmV0dXJuIHZlbmRvck1hdGNoLmNhbGwoIGVsLCBzZWxlY3RvciApO1xuICAgIH1cbiAgICB2YXIgbm9kZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciwgZWwucGFyZW50Tm9kZSApO1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgKytpICkge1xuICAgICAgICBpZiAoIG5vZGVzWyBpIF0gPT09IGVsICkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7ICBcbiAgICAgICAgfSBcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKiBjbG9zZXN0ICovXG5cbmZ1bmN0aW9uIGNsb3Nlc3QoIGVsZW1lbnQsIHNlbGVjdG9yLCBjaGVja1NlbGYsIHJvb3QgKSB7XG4gICAgZWxlbWVudCA9IGNoZWNrU2VsZiA/IHtwYXJlbnROb2RlOiBlbGVtZW50fSA6IGVsZW1lbnQ7XG5cbiAgICByb290ID0gcm9vdCB8fCBkb2N1bWVudDtcblxuICAgIC8qIE1ha2Ugc3VyZSBgZWxlbWVudCAhPT0gZG9jdW1lbnRgIGFuZCBgZWxlbWVudCAhPSBudWxsYFxuICAgICAgIG90aGVyd2lzZSB3ZSBnZXQgYW4gaWxsZWdhbCBpbnZvY2F0aW9uICovXG4gICAgd2hpbGUgKCAoIGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudE5vZGUgKSAmJiBlbGVtZW50ICE9PSBkb2N1bWVudCApIHtcbiAgICAgICAgaWYgKCBtYXRjaGVzKCBlbGVtZW50LCBzZWxlY3RvciApICkge1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBBZnRlciBgbWF0Y2hlc2Agb24gdGhlIGVkZ2UgY2FzZSB0aGF0XG4gICAgICAgICAgIHRoZSBzZWxlY3RvciBtYXRjaGVzIHRoZSByb290XG4gICAgICAgICAgICh3aGVuIHRoZSByb290IGlzIG5vdCB0aGUgZG9jdW1lbnQpICovXG4gICAgICAgIGlmIChlbGVtZW50ID09PSByb290KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qXG4gICAgZW5kIGRlcGVuZGVuY2llc1xuKi9cblxuZnVuY3Rpb24gRW1pdCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgRXZlbnRFbWl0dGVyMi5jYWxsKCBzZWxmICk7XG5cbiAgICBzZWxmLnZhbGlkYXRvcnMgPSBbXTtcbiAgICBzZWxmLnRvdWNoTW92ZURlbHRhID0gMTA7XG4gICAgc2VsZi5pbml0aWFsVG91Y2hQb2ludCA9IG51bGw7XG5cbiAgICBiaW5kKCBkb2N1bWVudCwgJ3RvdWNoc3RhcnQnLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xuICAgIGJpbmQoIGRvY3VtZW50LCAndG91Y2htb3ZlJywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ3RvdWNoZW5kJywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ2NsaWNrJywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ2lucHV0Jywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ3N1Ym1pdCcsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG59XG5cbkVtaXQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggRXZlbnRFbWl0dGVyMi5wcm90b3R5cGUgKTtcblxuZnVuY3Rpb24gZ2V0VG91Y2hEZWx0YSggZXZlbnQsIGluaXRpYWwgKSB7XG4gICAgdmFyIGRlbHRhWCA9ICggZXZlbnQudG91Y2hlc1sgMCBdLnBhZ2VYIC0gaW5pdGlhbC54ICk7XG4gICAgdmFyIGRlbHRhWSA9ICggZXZlbnQudG91Y2hlc1sgMCBdLnBhZ2VZIC0gaW5pdGlhbC55ICk7XG4gICAgcmV0dXJuIE1hdGguc3FydCggKCBkZWx0YVggKiBkZWx0YVggKSArICggZGVsdGFZICogZGVsdGFZICkgKTtcbn1cblxuRW1pdC5wcm90b3R5cGUuaGFuZGxlRXZlbnQgPSBmdW5jdGlvbiggZXZlbnQgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHRvdWNoZXMgPSBldmVudC50b3VjaGVzO1xuICAgIHZhciBkZWx0YSA9IC0xO1xuXG4gICAgaWYgKCB0eXBlb2YgZXZlbnQucHJvcGFnYXRpb25TdG9wcGVkQXQgIT09ICdudW1iZXInIHx8IGlzTmFOKCBldmVudC5wcm9wYWdhdGlvblN0b3BwZWRBdCApICkge1xuICAgICAgICBldmVudC5wcm9wYWdhdGlvblN0b3BwZWRBdCA9IDEwMDsgLy8gaGlnaGVzdCBwb3NzaWJsZSB2YWx1ZVxuICAgIH1cblxuICAgIHN3aXRjaCAoIGV2ZW50LnR5cGUgKSB7XG4gICAgICAgIGNhc2UgJ3RvdWNoc3RhcnQnOlxuICAgICAgICAgICAgc2VsZi5pbml0aWFsVG91Y2hQb2ludCA9IHNlbGYubGFzdFRvdWNoUG9pbnQgPSB7XG4gICAgICAgICAgICAgICAgeDogdG91Y2hlcyAmJiB0b3VjaGVzLmxlbmd0aCA/IHRvdWNoZXNbIDAgXS5wYWdlWCA6IDAsXG4gICAgICAgICAgICAgICAgeTogdG91Y2hlcyAmJiB0b3VjaGVzLmxlbmd0aCA/IHRvdWNoZXNbIDAgXS5wYWdlWSA6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3RvdWNobW92ZSc6XG4gICAgICAgICAgICBpZiAoIHRvdWNoZXMgJiYgdG91Y2hlcy5sZW5ndGggJiYgc2VsZi5pbml0aWFsVG91Y2hQb2ludCApIHtcbiAgICAgICAgICAgICAgICBkZWx0YSA9IGdldFRvdWNoRGVsdGEoIGV2ZW50LCBzZWxmLmluaXRpYWxUb3VjaFBvaW50ICk7XG4gICAgICAgICAgICAgICAgaWYgKCBkZWx0YSA+IHNlbGYudG91Y2hNb3ZlRGVsdGEgKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYubGFzdFRvdWNoUG9pbnQgPSB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHRvdWNoZXNbIDAgXS5wYWdlWCxcbiAgICAgICAgICAgICAgICAgICAgeTogdG91Y2hlc1sgMCBdLnBhZ2VZXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnY2xpY2snOlxuICAgICAgICBjYXNlICd0b3VjaGVuZCc6XG4gICAgICAgIGNhc2UgJ2lucHV0JzpcbiAgICAgICAgY2FzZSAnc3VibWl0JzpcbiAgICAgICAgICAgIC8vIGVhdCBhbnkgbGF0ZS1maXJpbmcgY2xpY2sgZXZlbnRzIG9uIHRvdWNoIGRldmljZXNcbiAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSA9PT0gJ2NsaWNrJyAmJiBzZWxmLmxhc3RUb3VjaFBvaW50ICkge1xuICAgICAgICAgICAgICAgIGlmICggZXZlbnQudG91Y2hlcyAmJiBldmVudC50b3VjaGVzLmxlbmd0aCApIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsdGEgPSBnZXRUb3VjaERlbHRhKCBldmVudCwgc2VsZi5sYXN0VG91Y2hQb2ludCApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGRlbHRhIDwgc2VsZi50b3VjaE1vdmVEZWx0YSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaGFuZGxlIGNhbmNlbGluZyB0b3VjaGVzIHRoYXQgaGF2ZSBtb3ZlZCB0b28gbXVjaFxuICAgICAgICAgICAgaWYgKCBldmVudC50eXBlID09PSAndG91Y2hlbmQnICYmICFzZWxmLmluaXRpYWxUb3VjaFBvaW50ICkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHNlbGVjdG9yID0gJ2EsYnV0dG9uLGlucHV0LFtkYXRhLWVtaXRdJztcbiAgICAgICAgICAgIHZhciBvcmlnaW5hbEVsZW1lbnQgPSBldmVudC50YXJnZXQgfHwgZXZlbnQuc3JjRWxlbWVudDtcbiAgICAgICAgICAgIHZhciBlbCA9IG9yaWdpbmFsRWxlbWVudDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGRlcHRoID0gLTE7XG4gICAgICAgICAgICB2YXIgaGFuZGxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgd2hpbGUoIGVsICYmIGV2ZW50LnByb3BhZ2F0aW9uU3RvcHBlZEF0ID4gZGVwdGggJiYgKytkZXB0aCA8IDEwMCApIHtcbiAgICAgICAgICAgICAgICBldmVudC5lbWl0VGFyZ2V0ID0gZWw7XG4gICAgICAgICAgICAgICAgZXZlbnQuZGVwdGggPSBkZXB0aDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoICFlbC5oYXNBdHRyaWJ1dGUoICdkYXRhLWVtaXQnICkgKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIGl0J3MgYSBsaW5rLCBidXR0b24gb3IgaW5wdXQgYW5kIGl0IGhhcyBubyBlbWl0IGF0dHJpYnV0ZSwgYWxsb3cgdGhlIGV2ZW50IHRvIHBhc3NcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBlbC50YWdOYW1lID09PSAnQScgfHwgZWwudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGZvcmNlQWxsb3dEZWZhdWx0ID0gZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyAmJiAoIGVsLnR5cGUgPT09ICdjaGVja2JveCcgfHwgZWwudHlwZSA9PT0gJ3JhZGlvJyApO1xuXG4gICAgICAgICAgICAgICAgdmFyIHZhbGlkYXRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZm9yICggdmFyIHZhbGlkYXRvckluZGV4ID0gMDsgdmFsaWRhdG9ySW5kZXggPCBzZWxmLnZhbGlkYXRvcnMubGVuZ3RoOyArK3ZhbGlkYXRvckluZGV4ICkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoICFzZWxmLnZhbGlkYXRvcnNbIHZhbGlkYXRvckluZGV4IF0uY2FsbCggdGhpcywgZWwsIGV2ZW50ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZWF0IHRoZSBldmVudCBpZiBhIHZhbGlkYXRvciBmYWlsZWRcbiAgICAgICAgICAgICAgICBpZiAoICF2YWxpZGF0ZWQgKSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5wcm9wYWdhdGlvblN0b3BwZWRBdCA9IGRlcHRoO1xuICAgICAgICAgICAgICAgICAgICBlbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiggc2VsZi52YWxpZGF0ZSApID09PSAnZnVuY3Rpb24nICYmICFzZWxmLnZhbGlkYXRlLmNhbGwoIHNlbGYsIGVsICkgKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCBlbC50YWdOYW1lID09PSAnRk9STScgKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSAhPT0gJ3N1Ym1pdCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICggZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyB8fCBlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnICkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoICEoIGVsLnR5cGUgPT09ICdzdWJtaXQnIHx8IGVsLnR5cGUgPT09ICdjaGVja2JveCcgfHwgZWwudHlwZSA9PT0gJ3JhZGlvJyB8fCBlbC50eXBlID09PSAnZmlsZScgKSAmJiBldmVudC50eXBlICE9PSAnaW5wdXQnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBjbG9zZXN0KCBlbCwgc2VsZWN0b3IsIGZhbHNlLCBkb2N1bWVudCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoIGVsLnRhZ05hbWUgPT09ICdTRUxFQ1QnICkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgIT09ICdpbnB1dCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGhhbmRsZWQgfD0gc2VsZi5fZW1pdCggZWwsIGV2ZW50LCBmb3JjZUFsbG93RGVmYXVsdCApO1xuICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCAhaGFuZGxlZCApIHtcbiAgICAgICAgICAgICAgICBzZWxmLmVtaXQoICd1bmhhbmRsZWQnLCBldmVudCApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoIGRlcHRoID49IDEwMCApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoICdFeGNlZWRlZCBkZXB0aCBsaW1pdCBmb3IgRW1pdCBjYWxscy4nICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBudWxsO1xuXG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG5FbWl0LnByb3RvdHlwZS5fZW1pdCA9IGZ1bmN0aW9uKCBlbGVtZW50LCBldmVudCwgZm9yY2VEZWZhdWx0ICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBvcHRpb25TdHJpbmcgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdC1vcHRpb25zJyApO1xuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgdmFyIGlnbm9yZVN0cmluZyA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0LWlnbm9yZScgKTtcbiAgICB2YXIgaTtcblxuICAgIGlmICggaWdub3JlU3RyaW5nICYmIGlnbm9yZVN0cmluZy5sZW5ndGggKSB7XG4gICAgICAgIHZhciBpZ25vcmVkRXZlbnRzID0gaWdub3JlU3RyaW5nLnRvTG93ZXJDYXNlKCkuc3BsaXQoICcgJyApO1xuICAgICAgICBmb3IgKCBpID0gMDsgaSA8IGlnbm9yZWRFdmVudHMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgPT09IGlnbm9yZWRFdmVudHNbIGkgXSApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIG9wdGlvblN0cmluZyAmJiBvcHRpb25TdHJpbmcubGVuZ3RoICkge1xuICAgICAgICB2YXIgb3B0cyA9IG9wdGlvblN0cmluZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCAnICcgKTtcbiAgICAgICAgZm9yICggaSA9IDA7IGkgPCBvcHRzLmxlbmd0aDsgKytpICkge1xuICAgICAgICAgICAgb3B0aW9uc1sgb3B0c1sgaSBdIF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCAhZm9yY2VEZWZhdWx0ICYmICFvcHRpb25zLmFsbG93ZGVmYXVsdCApIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG5cbiAgICBpZiAoICFvcHRpb25zLmFsbG93cHJvcGFnYXRlICkge1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgZXZlbnQucHJvcGFnYXRpb25TdG9wcGVkQXQgPSBldmVudC5kZXB0aDtcbiAgICB9XG5cbiAgICB2YXIgZW1pc3Npb25MaXN0ID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnICk7XG4gICAgaWYgKCAhZW1pc3Npb25MaXN0ICkge1xuICAgICAgICAvLyBhbGxvdyBmb3IgZW1wdHkgYmVoYXZpb3JzIHRoYXQgY2F0Y2ggZXZlbnRzXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHZhciBlbWlzc2lvbnMgPSBlbWlzc2lvbkxpc3Quc3BsaXQoICcsJyApO1xuICAgIGlmICggb3B0aW9ucy5kZWJvdW5jZSApIHtcbiAgICAgICAgc2VsZi50aW1lb3V0cyA9IHNlbGYudGltZW91dHMgfHwge307XG4gICAgICAgIGlmICggc2VsZi50aW1lb3V0c1sgZWxlbWVudCBdICkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KCBzZWxmLnRpbWVvdXRzWyBlbGVtZW50IF0gKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgICAgIHZhciBfZW1pc3Npb25zID0gZW1pc3Npb25zO1xuICAgICAgICAgICAgdmFyIF9ldmVudCA9IGV2ZW50O1xuICAgICAgICAgICAgc2VsZi50aW1lb3V0c1sgZWxlbWVudCBdID0gc2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgX2VtaXNzaW9ucy5mb3JFYWNoKCBmdW5jdGlvbiggZW1pc3Npb24gKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuZW1pdCggZW1pc3Npb24sIF9ldmVudCApO1xuICAgICAgICAgICAgICAgIH0gKTtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoIHNlbGYudGltZW91dHNbIF9lbGVtZW50IF0gKTtcbiAgICAgICAgICAgICAgICBzZWxmLnRpbWVvdXRzWyBfZWxlbWVudCBdID0gbnVsbDtcbiAgICAgICAgICAgIH0sIDI1MCApO1xuICAgICAgICB9ICkoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgZW1pc3Npb25zLmZvckVhY2goIGZ1bmN0aW9uKCBlbWlzc2lvbiApIHtcbiAgICAgICAgc2VsZi5lbWl0KCBlbWlzc2lvbiwgZXZlbnQgKTtcbiAgICB9ICk7XG4gICAgXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5FbWl0LnByb3RvdHlwZS5hZGRWYWxpZGF0b3IgPSBmdW5jdGlvbiggdmFsaWRhdG9yICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBmb3VuZCA9IGZhbHNlO1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHNlbGYudmFsaWRhdG9ycy5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgaWYgKCBzZWxmLnZhbGlkYXRvcnNbIGkgXSA9PT0gdmFsaWRhdG9yICkge1xuICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIGZvdW5kICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgc2VsZi52YWxpZGF0b3JzLnB1c2goIHZhbGlkYXRvciApO1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuRW1pdC5wcm90b3R5cGUucmVtb3ZlVmFsaWRhdG9yID0gZnVuY3Rpb24oIHZhbGlkYXRvciApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgZm91bmQgPSBmYWxzZTtcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBzZWxmLnZhbGlkYXRvcnMubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgIGlmICggc2VsZi52YWxpZGF0b3JzWyBpIF0gPT09IHZhbGlkYXRvciApIHtcbiAgICAgICAgICAgIHNlbGYudmFsaWRhdG9ycy5zcGxpY2UoIGksIDEgKTtcbiAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZvdW5kO1xufTtcblxuRW1pdC5zaW5nbGV0b24gPSBFbWl0LnNpbmdsZXRvbiB8fCBuZXcgRW1pdCgpO1xuRW1pdC5zaW5nbGV0b24uRW1pdCA9IEVtaXQ7XG5cbm1vZHVsZS5leHBvcnRzID0gRW1pdC5zaW5nbGV0b247XG4iLCIvKiFcbiAqIEV2ZW50RW1pdHRlcjJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9oaWoxbngvRXZlbnRFbWl0dGVyMlxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMyBoaWoxbnhcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuOyFmdW5jdGlvbih1bmRlZmluZWQpIHtcblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgPyBBcnJheS5pc0FycmF5IDogZnVuY3Rpb24gX2lzQXJyYXkob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCI7XG4gIH07XG4gIHZhciBkZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbiAgZnVuY3Rpb24gaW5pdCgpIHtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBpZiAodGhpcy5fY29uZikge1xuICAgICAgY29uZmlndXJlLmNhbGwodGhpcywgdGhpcy5fY29uZik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY29uZmlndXJlKGNvbmYpIHtcbiAgICBpZiAoY29uZikge1xuXG4gICAgICB0aGlzLl9jb25mID0gY29uZjtcblxuICAgICAgY29uZi5kZWxpbWl0ZXIgJiYgKHRoaXMuZGVsaW1pdGVyID0gY29uZi5kZWxpbWl0ZXIpO1xuICAgICAgY29uZi5tYXhMaXN0ZW5lcnMgJiYgKHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBjb25mLm1heExpc3RlbmVycyk7XG4gICAgICBjb25mLndpbGRjYXJkICYmICh0aGlzLndpbGRjYXJkID0gY29uZi53aWxkY2FyZCk7XG4gICAgICBjb25mLm5ld0xpc3RlbmVyICYmICh0aGlzLm5ld0xpc3RlbmVyID0gY29uZi5uZXdMaXN0ZW5lcik7XG5cbiAgICAgIGlmICh0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJUcmVlID0ge307XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gRXZlbnRFbWl0dGVyKGNvbmYpIHtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICB0aGlzLm5ld0xpc3RlbmVyID0gZmFsc2U7XG4gICAgY29uZmlndXJlLmNhbGwodGhpcywgY29uZik7XG4gIH1cblxuICAvL1xuICAvLyBBdHRlbnRpb24sIGZ1bmN0aW9uIHJldHVybiB0eXBlIG5vdyBpcyBhcnJheSwgYWx3YXlzICFcbiAgLy8gSXQgaGFzIHplcm8gZWxlbWVudHMgaWYgbm8gYW55IG1hdGNoZXMgZm91bmQgYW5kIG9uZSBvciBtb3JlXG4gIC8vIGVsZW1lbnRzIChsZWFmcykgaWYgdGhlcmUgYXJlIG1hdGNoZXNcbiAgLy9cbiAgZnVuY3Rpb24gc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlLCBpKSB7XG4gICAgaWYgKCF0cmVlKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHZhciBsaXN0ZW5lcnM9W10sIGxlYWYsIGxlbiwgYnJhbmNoLCB4VHJlZSwgeHhUcmVlLCBpc29sYXRlZEJyYW5jaCwgZW5kUmVhY2hlZCxcbiAgICAgICAgdHlwZUxlbmd0aCA9IHR5cGUubGVuZ3RoLCBjdXJyZW50VHlwZSA9IHR5cGVbaV0sIG5leHRUeXBlID0gdHlwZVtpKzFdO1xuICAgIGlmIChpID09PSB0eXBlTGVuZ3RoICYmIHRyZWUuX2xpc3RlbmVycykge1xuICAgICAgLy9cbiAgICAgIC8vIElmIGF0IHRoZSBlbmQgb2YgdGhlIGV2ZW50KHMpIGxpc3QgYW5kIHRoZSB0cmVlIGhhcyBsaXN0ZW5lcnNcbiAgICAgIC8vIGludm9rZSB0aG9zZSBsaXN0ZW5lcnMuXG4gICAgICAvL1xuICAgICAgaWYgKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gW3RyZWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZWFmID0gMCwgbGVuID0gdHJlZS5fbGlzdGVuZXJzLmxlbmd0aDsgbGVhZiA8IGxlbjsgbGVhZisrKSB7XG4gICAgICAgICAgaGFuZGxlcnMgJiYgaGFuZGxlcnMucHVzaCh0cmVlLl9saXN0ZW5lcnNbbGVhZl0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbdHJlZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChjdXJyZW50VHlwZSA9PT0gJyonIHx8IGN1cnJlbnRUeXBlID09PSAnKionKSB8fCB0cmVlW2N1cnJlbnRUeXBlXSkge1xuICAgICAgLy9cbiAgICAgIC8vIElmIHRoZSBldmVudCBlbWl0dGVkIGlzICcqJyBhdCB0aGlzIHBhcnRcbiAgICAgIC8vIG9yIHRoZXJlIGlzIGEgY29uY3JldGUgbWF0Y2ggYXQgdGhpcyBwYXRjaFxuICAgICAgLy9cbiAgICAgIGlmIChjdXJyZW50VHlwZSA9PT0gJyonKSB7XG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzEpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcbiAgICAgIH0gZWxzZSBpZihjdXJyZW50VHlwZSA9PT0gJyoqJykge1xuICAgICAgICBlbmRSZWFjaGVkID0gKGkrMSA9PT0gdHlwZUxlbmd0aCB8fCAoaSsyID09PSB0eXBlTGVuZ3RoICYmIG5leHRUeXBlID09PSAnKicpKTtcbiAgICAgICAgaWYoZW5kUmVhY2hlZCAmJiB0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICAvLyBUaGUgbmV4dCBlbGVtZW50IGhhcyBhIF9saXN0ZW5lcnMsIGFkZCBpdCB0byB0aGUgaGFuZGxlcnMuXG4gICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIHR5cGVMZW5ndGgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBpZihicmFuY2ggPT09ICcqJyB8fCBicmFuY2ggPT09ICcqKicpIHtcbiAgICAgICAgICAgICAgaWYodHJlZVticmFuY2hdLl9saXN0ZW5lcnMgJiYgIWVuZFJlYWNoZWQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCB0eXBlTGVuZ3RoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSsyKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBObyBtYXRjaCBvbiB0aGlzIG9uZSwgc2hpZnQgaW50byB0aGUgdHJlZSBidXQgbm90IGluIHRoZSB0eXBlIGFycmF5LlxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XG4gICAgICB9XG5cbiAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2N1cnJlbnRUeXBlXSwgaSsxKSk7XG4gICAgfVxuXG4gICAgeFRyZWUgPSB0cmVlWycqJ107XG4gICAgaWYgKHhUcmVlKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgdGhlIGxpc3RlbmVyIHRyZWUgd2lsbCBhbGxvdyBhbnkgbWF0Y2ggZm9yIHRoaXMgcGFydCxcbiAgICAgIC8vIHRoZW4gcmVjdXJzaXZlbHkgZXhwbG9yZSBhbGwgYnJhbmNoZXMgb2YgdGhlIHRyZWVcbiAgICAgIC8vXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHhUcmVlLCBpKzEpO1xuICAgIH1cblxuICAgIHh4VHJlZSA9IHRyZWVbJyoqJ107XG4gICAgaWYoeHhUcmVlKSB7XG4gICAgICBpZihpIDwgdHlwZUxlbmd0aCkge1xuICAgICAgICBpZih4eFRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIC8vIElmIHdlIGhhdmUgYSBsaXN0ZW5lciBvbiBhICcqKicsIGl0IHdpbGwgY2F0Y2ggYWxsLCBzbyBhZGQgaXRzIGhhbmRsZXIuXG4gICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQnVpbGQgYXJyYXlzIG9mIG1hdGNoaW5nIG5leHQgYnJhbmNoZXMgYW5kIG90aGVycy5cbiAgICAgICAgZm9yKGJyYW5jaCBpbiB4eFRyZWUpIHtcbiAgICAgICAgICBpZihicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB4eFRyZWUuaGFzT3duUHJvcGVydHkoYnJhbmNoKSkge1xuICAgICAgICAgICAgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xuICAgICAgICAgICAgICAvLyBXZSBrbm93IHRoZSBuZXh0IGVsZW1lbnQgd2lsbCBtYXRjaCwgc28ganVtcCB0d2ljZS5cbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZihicmFuY2ggPT09IGN1cnJlbnRUeXBlKSB7XG4gICAgICAgICAgICAgIC8vIEN1cnJlbnQgbm9kZSBtYXRjaGVzLCBtb3ZlIGludG8gdGhlIHRyZWUuXG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlW2JyYW5jaF0sIGkrMSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaCA9IHt9O1xuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaFticmFuY2hdID0geHhUcmVlW2JyYW5jaF07XG4gICAgICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeyAnKionOiBpc29sYXRlZEJyYW5jaCB9LCBpKzEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgIC8vIFdlIGhhdmUgcmVhY2hlZCB0aGUgZW5kIGFuZCBzdGlsbCBvbiBhICcqKidcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWUsIHR5cGVMZW5ndGgpO1xuICAgICAgfSBlbHNlIGlmKHh4VHJlZVsnKiddICYmIHh4VHJlZVsnKiddLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbJyonXSwgdHlwZUxlbmd0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpc3RlbmVycztcbiAgfVxuXG4gIGZ1bmN0aW9uIGdyb3dMaXN0ZW5lclRyZWUodHlwZSwgbGlzdGVuZXIpIHtcblxuICAgIHR5cGUgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcblxuICAgIC8vXG4gICAgLy8gTG9va3MgZm9yIHR3byBjb25zZWN1dGl2ZSAnKionLCBpZiBzbywgZG9uJ3QgYWRkIHRoZSBldmVudCBhdCBhbGwuXG4gICAgLy9cbiAgICBmb3IodmFyIGkgPSAwLCBsZW4gPSB0eXBlLmxlbmd0aDsgaSsxIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmKHR5cGVbaV0gPT09ICcqKicgJiYgdHlwZVtpKzFdID09PSAnKionKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdHJlZSA9IHRoaXMubGlzdGVuZXJUcmVlO1xuICAgIHZhciBuYW1lID0gdHlwZS5zaGlmdCgpO1xuXG4gICAgd2hpbGUgKG5hbWUpIHtcblxuICAgICAgaWYgKCF0cmVlW25hbWVdKSB7XG4gICAgICAgIHRyZWVbbmFtZV0gPSB7fTtcbiAgICAgIH1cblxuICAgICAgdHJlZSA9IHRyZWVbbmFtZV07XG5cbiAgICAgIGlmICh0eXBlLmxlbmd0aCA9PT0gMCkge1xuXG4gICAgICAgIGlmICghdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gbGlzdGVuZXI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZih0eXBlb2YgdHJlZS5fbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gW3RyZWUuX2xpc3RlbmVycywgbGlzdGVuZXJdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzQXJyYXkodHJlZS5fbGlzdGVuZXJzKSkge1xuXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMud2FybmVkKSB7XG5cbiAgICAgICAgICAgIHZhciBtID0gZGVmYXVsdE1heExpc3RlbmVycztcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG0gPiAwICYmIHRyZWUuX2xpc3RlbmVycy5sZW5ndGggPiBtKSB7XG5cbiAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLndhcm5lZCA9IHRydWU7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuX2xpc3RlbmVycy5sZW5ndGgpO1xuICAgICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgbmFtZSA9IHR5cGUuc2hpZnQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuXG4gIC8vIDEwIGxpc3RlbmVycyBhcmUgYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaFxuICAvLyBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbiAgLy9cbiAgLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4gIC8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZGVsaW1pdGVyID0gJy4nO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG4gICAgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IG47XG4gICAgaWYgKCF0aGlzLl9jb25mKSB0aGlzLl9jb25mID0ge307XG4gICAgdGhpcy5fY29uZi5tYXhMaXN0ZW5lcnMgPSBuO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZXZlbnQgPSAnJztcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pIHtcbiAgICB0aGlzLm1hbnkoZXZlbnQsIDEsIGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm1hbnkgPSBmdW5jdGlvbihldmVudCwgdHRsLCBmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbWFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdGVuZXIoKSB7XG4gICAgICBpZiAoLS10dGwgPT09IDApIHtcbiAgICAgICAgc2VsZi5vZmYoZXZlbnQsIGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgbGlzdGVuZXIuX29yaWdpbiA9IGZuO1xuXG4gICAgdGhpcy5vbihldmVudCwgbGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIHR5cGUgPSBhcmd1bWVudHNbMF07XG5cbiAgICBpZiAodHlwZSA9PT0gJ25ld0xpc3RlbmVyJyAmJiAhdGhpcy5uZXdMaXN0ZW5lcikge1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgfVxuXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSAqX2FsbCogZnVuY3Rpb25zIGFuZCBpbnZva2UgdGhlbS5cbiAgICBpZiAodGhpcy5fYWxsKSB7XG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKGkgPSAwLCBsID0gdGhpcy5fYWxsLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgICAgdGhpcy5fYWxsW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuXG4gICAgICBpZiAoIXRoaXMuX2FsbCAmJlxuICAgICAgICAhdGhpcy5fZXZlbnRzLmVycm9yICYmXG4gICAgICAgICEodGhpcy53aWxkY2FyZCAmJiB0aGlzLmxpc3RlbmVyVHJlZS5lcnJvcikpIHtcblxuICAgICAgICBpZiAoYXJndW1lbnRzWzFdIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBhcmd1bWVudHNbMV07IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5jYXVnaHQsIHVuc3BlY2lmaWVkICdlcnJvcicgZXZlbnQuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlcjtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIGhhbmRsZXIgPSBbXTtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlciwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSlcbiAgICAgICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gc2xvd2VyXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBlbHNlIGlmIChoYW5kbGVyKSB7XG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICAgIHZhciBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XG4gICAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAobGlzdGVuZXJzLmxlbmd0aCA+IDApIHx8ICEhdGhpcy5fYWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiAhIXRoaXMuX2FsbDtcbiAgICB9XG5cbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcblxuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5vbkFueSh0eXBlKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignb24gb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuXG4gICAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PSBcIm5ld0xpc3RlbmVyc1wiISBCZWZvcmVcbiAgICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyc1wiLlxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICBncm93TGlzdGVuZXJUcmVlLmNhbGwodGhpcywgdHlwZSwgbGlzdGVuZXIpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHtcbiAgICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gICAgfVxuICAgIGVsc2UgaWYodHlwZW9mIHRoaXMuX2V2ZW50c1t0eXBlXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xuICAgICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG5cbiAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBtID0gdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuXG4gICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25BbnkgPSBmdW5jdGlvbihmbikge1xuXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbkFueSBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuXG4gICAgaWYoIXRoaXMuX2FsbCkge1xuICAgICAgdGhpcy5fYWxsID0gW107XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBmdW5jdGlvbiB0byB0aGUgZXZlbnQgbGlzdGVuZXIgY29sbGVjdGlvbi5cbiAgICB0aGlzLl9hbGwucHVzaChmbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUub247XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlTGlzdGVuZXIgb25seSB0YWtlcyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlcnMsbGVhZnM9W107XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBkb2VzIG5vdCB1c2UgbGlzdGVuZXJzKCksIHNvIG5vIHNpZGUgZWZmZWN0IG9mIGNyZWF0aW5nIF9ldmVudHNbdHlwZV1cbiAgICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm4gdGhpcztcbiAgICAgIGhhbmRsZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgbGVhZnMucHVzaCh7X2xpc3RlbmVyczpoYW5kbGVyc30pO1xuICAgIH1cblxuICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xuICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XG4gICAgICBoYW5kbGVycyA9IGxlYWYuX2xpc3RlbmVycztcbiAgICAgIGlmIChpc0FycmF5KGhhbmRsZXJzKSkge1xuXG4gICAgICAgIHZhciBwb3NpdGlvbiA9IC0xO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChoYW5kbGVyc1tpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5saXN0ZW5lciAmJiBoYW5kbGVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XG4gICAgICAgICAgICAoaGFuZGxlcnNbaV0uX29yaWdpbiAmJiBoYW5kbGVyc1tpXS5fb3JpZ2luID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb3NpdGlvbiA8IDApIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICBsZWFmLl9saXN0ZW5lcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0uc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChoYW5kbGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoaGFuZGxlcnMgPT09IGxpc3RlbmVyIHx8XG4gICAgICAgIChoYW5kbGVycy5saXN0ZW5lciAmJiBoYW5kbGVycy5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XG4gICAgICAgIChoYW5kbGVycy5fb3JpZ2luICYmIGhhbmRsZXJzLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmZBbnkgPSBmdW5jdGlvbihmbikge1xuICAgIHZhciBpID0gMCwgbCA9IDAsIGZucztcbiAgICBpZiAoZm4gJiYgdGhpcy5fYWxsICYmIHRoaXMuX2FsbC5sZW5ndGggPiAwKSB7XG4gICAgICBmbnMgPSB0aGlzLl9hbGw7XG4gICAgICBmb3IoaSA9IDAsIGwgPSBmbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmKGZuID09PSBmbnNbaV0pIHtcbiAgICAgICAgICBmbnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmY7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICF0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICB2YXIgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuXG4gICAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcbiAgICAgICAgdmFyIGxlYWYgPSBsZWFmc1tpTGVhZl07XG4gICAgICAgIGxlYWYuX2xpc3RlbmVycyA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgdmFyIGhhbmRsZXJzID0gW107XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXJzLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgICAgcmV0dXJuIGhhbmRsZXJzO1xuICAgIH1cblxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgdGhpcy5fZXZlbnRzW3R5cGVdID0gW107XG4gICAgaWYgKCFpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzQW55ID0gZnVuY3Rpb24oKSB7XG5cbiAgICBpZih0aGlzLl9hbGwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hbGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICB9O1xuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgLy8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBFdmVudEVtaXR0ZXI7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gQ29tbW9uSlNcbiAgICBleHBvcnRzLkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWwuXG4gICAgd2luZG93LkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XG4gIH1cbn0oKTtcbiIsIlxuLyogZ2xvYmFsIHVuZXNjYXBlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGltYWdlVG9VcmkgPSByZXF1aXJlKCAnaW1hZ2UtdG8tZGF0YS11cmknICk7XG5cbi8qXG4jIyBJbWFnZSB0byBibG9iXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5Db252ZXJ0cyByZW1vdGUgaW1hZ2UgdXJscyB0byBibG9icyB2aWEgY2FudmFzLiBcblxuYGBgamF2YXNjcmlwdFxudmFyIGltYWdlVG9CbG9iID0gcmVxdWlyZSggJ2ltYWdlLXRvLWJsb2InICk7XG5cbmltYWdlVG9CbG9iKCAnaHR0cDovL2Zvby5iYXIvYmF6LnBuZycsIGZ1bmN0aW9uKCBlcnIsIHVyaSApIHsgXG4gICAgY29uc29sZS5sb2coIHVyaSApOyBcbn0gKTtcbmltYWdlVG9CbG9iKCBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSggJ2ltZycgKVsgMCBdLCBmdW5jdGlvbiggZXJyLCB1cmkgKSB7IFxuICAgIGNvbnNvbGUubG9nKCB1cmkgKTsgXG59ICk7XG5gYGBcbiovXG5cbnZhciB0eXBlcyA9IHtcbiAgICAncG5nJzogJ2ltYWdlL3BuZycsXG4gICAgJ2pwZyc6ICdpbWFnZS9qcGVnJyxcbiAgICAnanBlZyc6ICdpbWFnZS9qcGVnJyxcbiAgICAnc3ZnJzogJ2ltYWdlL3N2Zyt4bWwnIC8vIHRoaXMgZ2V0cyBjb252ZXJ0ZWQgdG8gcG5nXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGltYWdlVG9CbG9iO1xubW9kdWxlLmV4cG9ydHMuZGF0YVVSSXRvQmxvYiA9IGRhdGFVUkl0b0Jsb2I7XG5tb2R1bGUuZXhwb3J0cy5faGFuZGxlSW1hZ2VUb1VSSSA9IGhhbmRsZUltYWdlVG9VUkk7XG5tb2R1bGUuZXhwb3J0cy5nZXRNaW1lVHlwZUZyb21VcmwgPSBnZXRUeXBlO1xuXG4vKlxuICAgIGltYWdlVG9CbG9iIC0gbWFpbiBmdW5jdGlvbiB0aGF0IGdldHMgZXhwb3NlZCwgY29udmVydHMgZWl0aGVyIGRvbSBub2RlIG9yIHVybCBvZiBpbWFnZSBpbnRvIGJsb2IgZGF0YVxuXG4gICAgcGFyYW1zXG4gICAgICAgIGltZyB7IE9iamVjdCB8IFN0cmluZyB9IC0gZWl0aGVyIGNhbiBiZSBhbiBJTUcgRE9NIG5vZGUgb3IgYSB1cmwgc3RyaW5nIHRoYXQgd2lsbCBsb2FkIHRoZSBpbWFnZVxuICAgICAgICBvcHRpb25zIHsgT2JqZWN0IH0gLSBvcHRpb25hbCwgYSBzZXQgb2Ygb3B0aW9ucyB0aGF0IHlvdSBjYW4gcGFzcyB0byB0aGUgaW1hZ2V0b2Jsb2IgdG8gY2hhbmdlIHRoZSBiZWhhdmlvclxuICAgICAgICBjYWxsYmFjayB7IEZ1bmN0aW9uIH0gLSBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBhZnRlciB0aGUgY29udmVyc2lvbiBpcyBjb21wbGV0ZWQuIFRoZSBjYWxsYmFjayB3aWxsIGdldCBwYXNzZWQgYW4gZXJyb3IgKCBpZiBvbmUgb2NjdXJlcyApIGFuZCB0aGUgYmxvYi5cblxuKi9cblxuZnVuY3Rpb24gaW1hZ2VUb0Jsb2IoIGltZywgb3B0aW9ucywgY2FsbGJhY2sgKSB7XG4gICAgXG4gICAgdmFyIHNyYztcblxuICAgIGlmICggdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYgKCAhaW1nICkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soIG5ldyBFcnJvciggJ1Bhc3MgaW4gYSBJTUcgRE9NIG5vZGUgb3IgYSB1cmwgYXMgZmlyc3QgcGFyYW0nICkgKTtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBpbWcgPT09ICdvYmplY3QnICYmIGltZy50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdpbWcnICkge1xuICAgICAgICBzcmMgPSBpbWcuc3JjO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIGltZyA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHNyYyA9IGltZztcbiAgICB9XG5cbiAgICBpZiAoIC9eZGF0YTovLnRlc3QoIHNyYyApICYmICFvcHRpb25zLmNvbnZlcnQgKSB7IC8vIGNoZWNrIHRvIHNlZSBpZiBpdHMgYSBkYXRhIHVyaVxuICAgICAgICBjYWxsYmFjayggbnVsbCwgZGF0YVVSSXRvQmxvYiggc3JjICkgKTsgLy8gc2NyaXB0IHRvIGRhdGF1cmkgY29udmVyc2lvblxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgb3B0aW9ucy50eXBlID0gdHlwZXNbIG9wdGlvbnMudHlwZSBdIHx8IGdldFR5cGUoIHNyYyApO1xuICAgIG9wdGlvbnMuc3JjID0gc3JjO1xuICAgIG9wdGlvbnMuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICBpZiAoICFvcHRpb25zLnR5cGUgKSB7XG5cbiAgICAgICAgY2FsbGJhY2soIG5ldyBFcnJvciggJ0ltYWdlIHR5cGUgaXMgbm90IHN1cHBvcnRlZCcgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaW1hZ2VUb1VyaSggc3JjLCBvcHRpb25zLnR5cGUsIGhhbmRsZUltYWdlVG9VUkkuYmluZCggbnVsbCwgb3B0aW9ucyApICk7IC8vIGF0dGVtcHQgaWYgd2UgaGF2ZSBhIFxufVxuXG4vKlxuICAgIGRhdGFVUkl0b0Jsb2IgLSB0YWtlcyBhIGRhdGF1cmkgYW5kIGNvbnZlcnRzIGl0IGludG8gYSBibG9iXG5cbiAgICBwYXJhbXNcbiAgICAgICAgdXJpIHsgU3RyaW5nIH0gLSBhIHZhbGlkIGRhdGF1cmlcblxuICAgIHJldHVybnNcbiAgICAgICAgYmxvYiB7IEJsb2IgT2JqZWN0IH0gLSBnZW5lcmF0ZWQgYmxvYiBvYmplY3RcblxuKi9cblxuXG5mdW5jdGlvbiBkYXRhVVJJdG9CbG9iKCB1cmkgKSB7XG4gICAgLy8gY29udmVydCBiYXNlNjQvVVJMRW5jb2RlZCBkYXRhIGNvbXBvbmVudCB0byByYXcgYmluYXJ5IGRhdGEgaGVsZCBpbiBhIHN0cmluZ1xuICAgIHZhciBieXRlU3RyaW5nLFxuICAgICAgICBtaW1lU3RyaW5nLFxuICAgICAgICBpYTtcblxuICAgIGlmICggdXJpLnNwbGl0KCAnLCcgKVswXS5pbmRleE9mKCAnYmFzZTY0JyApID49IDAgKSB7XG5cbiAgICAgICAgYnl0ZVN0cmluZyA9IGF0b2IoIHVyaS5zcGxpdCgnLCcpWzFdICk7XG4gICAgfVxuICAgIGVsc2Uge1xuXG4gICAgICAgIGJ5dGVTdHJpbmcgPSB1bmVzY2FwZSggdXJpLnNwbGl0KCcsJylbMV0gKTtcbiAgICB9XG5cbiAgICAvLyBzZXBhcmF0ZSBvdXQgdGhlIG1pbWUgY29tcG9uZW50XG4gICAgbWltZVN0cmluZyA9IHVyaS5zcGxpdCggJywnIClbIDAgXS5zcGxpdCggJzonIClbIDEgXS5zcGxpdCggJzsnIClbIDAgXTtcblxuICAgIC8vIHdyaXRlIHRoZSBieXRlcyBvZiB0aGUgc3RyaW5nIHRvIGEgdHlwZWQgYXJyYXlcbiAgICBpYSA9IG5ldyBVaW50OEFycmF5KCBieXRlU3RyaW5nLmxlbmd0aCApO1xuXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgYnl0ZVN0cmluZy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgXG4gICAgICAgIGlhWyBpIF0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoIGkgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJsb2IoIFsgaWEgXSwge1xuICAgICAgICB0eXBlOiBtaW1lU3RyaW5nXG4gICAgfSApO1xufVxuXG4vKlxuICAgIGhhbmRsZUltYWdlVG9VUkkgLSBoYW5kbGVzIGEgY2FsbGJhY2sgZnJvbSBpbWFnZVRvVVJJIGFuZCBnbHVlcyB0b2dldGhlciBkYXRhVVJJdG9CbG9iXG5cbiAgICBwYXJhbXNcbiAgICAgICAgb3B0aW9ucyB7IE9iamVjdCB9IC0gdGhlIG9wdGlvbnMgb2JqZWN0IHBhc3NlZCB0byB0aGUgbWFpbiBmbiB3aXRoIHRoZSBjYWxsYmFjayBhdHRhY2hlZCB0byBpdFxuICAgICAgICBlcnIgeyBFcnJvciBPYmplY3QgfSAtIGFuIGVycm9yIGlmIG9uZSBvY2N1cnMgaW4gdGhlIGltYWdlVG9VUkkgbWV0aG9kIFxuICAgICAgICB1cmkgeyBTdHJpbmcgfSAtIGEgdmFsaWQgZGF0YSB1cmxcblxuKi9cblxuZnVuY3Rpb24gaGFuZGxlSW1hZ2VUb1VSSSggb3B0aW9ucywgZXJyLCB1cmkgKSB7XG5cbiAgICBpZiAoIGVyciApIHtcbiAgICAgICAgb3B0aW9ucy5jYWxsYmFjayggZXJyICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvcHRpb25zLmNhbGxiYWNrKCBudWxsLCBkYXRhVVJJdG9CbG9iKCB1cmkgKSApO1xuXG59XG5cbi8qXG4gICAgZ2V0VHlwZSAtIHNtYWxsIHV0aWwgdG8gZ2V0IHR5cGUgZnJvbSB1cmwgaWYgb25lIGlzIHByZXNlbnQgaW4gdHlwZXMgbGlzdFxuXG4gICAgcGFyYW1zXG4gICAgICAgIHVybCB7IFN0cmluZyB9IC0gYSB1cmwgdG8gcGFyc2UgdGhlIGZpbGUgZXh0ZW5zaW9uIGZyb21cblxuICAgIHJldHVybnNcbiAgICAgICAgdHlwZSB7IFN0cmluZyB9IC0gYSBtaW1lIHR5cGUgaWYgdHlwZSBpcyBzdXBwb3J0ZWQsIGlmIG5vdCB1bmRlZmluZWQgaXMgcmV0dXJuZWRcblxuKi9cblxuZnVuY3Rpb24gZ2V0VHlwZSggdXJsICkge1xuICAgIHJldHVybiB1cmwgPyB0eXBlc1sgdXJsLnNwbGl0KCAnPycgKS5zaGlmdCggKS5zcGxpdCggJy4nICkucG9wKCApIF0gOiBudWxsIDtcbn1cbiIsIi8vIGNvbnZlcnRzIGEgVVJMIG9mIGFuIGltYWdlIGludG8gYSBkYXRhVVJJXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh1cmwsIG1pbWVUeXBlLCBjYikge1xuICAgIC8vIENyZWF0ZSBhbiBlbXB0eSBjYW52YXMgYW5kIGltYWdlIGVsZW1lbnRzXG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpLFxuICAgICAgICBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcblxuICAgIGlmICggdHlwZW9mIG1pbWVUeXBlID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICBjYiA9IG1pbWVUeXBlO1xuICAgICAgICBtaW1lVHlwZSA9IG51bGw7XG4gICAgfVxuXG4gICAgbWltZVR5cGUgPSBtaW1lVHlwZSB8fCAnaW1hZ2UvcG5nJztcblxuICAgIC8vIGFsbG93IGZvciBjcm9zcyBvcmlnaW4gdGhhdCBoYXMgY29ycmVjdCBoZWFkZXJzXG4gICAgaW1nLmNyb3NzT3JpZ2luID0gXCJBbm9ueW1vdXNcIjsgXG5cbiAgICBpbWcub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIC8vIG1hdGNoIHNpemUgb2YgaW1hZ2VcbiAgICAgICAgY2FudmFzLndpZHRoID0gaW1nLndpZHRoO1xuICAgICAgICBjYW52YXMuaGVpZ2h0ID0gaW1nLmhlaWdodDtcblxuICAgICAgICAvLyBDb3B5IHRoZSBpbWFnZSBjb250ZW50cyB0byB0aGUgY2FudmFzXG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoaW1nLCAwLCAwKTtcblxuICAgICAgICAvLyBHZXQgdGhlIGRhdGEtVVJJIGZvcm1hdHRlZCBpbWFnZVxuICAgICAgICBjYiggbnVsbCwgY2FudmFzLnRvRGF0YVVSTCggbWltZVR5cGUgKSApO1xuICAgIH07XG5cbiAgICBpbWcub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2IobmV3IEVycm9yKCdGYWlsZWRUb0xvYWRJbWFnZScpKTtcbiAgICB9O1xuXG4gICAgLy8gY2FudmFzIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICBpZiAoIWNhbnZhcy5nZXRDb250ZXh0KSB7XG4gICAgICAgIGNiKG5ldyBFcnJvcignQ2FudmFzSXNOb3RTdXBwb3J0ZWQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW1nLnNyYyA9IHVybDtcbiAgICB9XG59O1xuIiwiLyohXHJcbiAqIEBuYW1lIEphdmFTY3JpcHQvTm9kZUpTIE1lcmdlIHYxLjIuMFxyXG4gKiBAYXV0aG9yIHllaWtvc1xyXG4gKiBAcmVwb3NpdG9yeSBodHRwczovL2dpdGh1Yi5jb20veWVpa29zL2pzLm1lcmdlXHJcblxyXG4gKiBDb3B5cmlnaHQgMjAxNCB5ZWlrb3MgLSBNSVQgbGljZW5zZVxyXG4gKiBodHRwczovL3Jhdy5naXRodWIuY29tL3llaWtvcy9qcy5tZXJnZS9tYXN0ZXIvTElDRU5TRVxyXG4gKi9cclxuXHJcbjsoZnVuY3Rpb24oaXNOb2RlKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIG9uZSBvciBtb3JlIG9iamVjdHMgXHJcblx0ICogQHBhcmFtIGJvb2w/IGNsb25lXHJcblx0ICogQHBhcmFtIG1peGVkLC4uLiBhcmd1bWVudHNcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHR2YXIgUHVibGljID0gZnVuY3Rpb24oY2xvbmUpIHtcclxuXHJcblx0XHRyZXR1cm4gbWVyZ2UoY2xvbmUgPT09IHRydWUsIGZhbHNlLCBhcmd1bWVudHMpO1xyXG5cclxuXHR9LCBwdWJsaWNOYW1lID0gJ21lcmdlJztcclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9yIG1vcmUgb2JqZWN0cyByZWN1cnNpdmVseSBcclxuXHQgKiBAcGFyYW0gYm9vbD8gY2xvbmVcclxuXHQgKiBAcGFyYW0gbWl4ZWQsLi4uIGFyZ3VtZW50c1xyXG5cdCAqIEByZXR1cm4gb2JqZWN0XHJcblx0ICovXHJcblxyXG5cdFB1YmxpYy5yZWN1cnNpdmUgPSBmdW5jdGlvbihjbG9uZSkge1xyXG5cclxuXHRcdHJldHVybiBtZXJnZShjbG9uZSA9PT0gdHJ1ZSwgdHJ1ZSwgYXJndW1lbnRzKTtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2xvbmUgdGhlIGlucHV0IHJlbW92aW5nIGFueSByZWZlcmVuY2VcclxuXHQgKiBAcGFyYW0gbWl4ZWQgaW5wdXRcclxuXHQgKiBAcmV0dXJuIG1peGVkXHJcblx0ICovXHJcblxyXG5cdFB1YmxpYy5jbG9uZSA9IGZ1bmN0aW9uKGlucHV0KSB7XHJcblxyXG5cdFx0dmFyIG91dHB1dCA9IGlucHV0LFxyXG5cdFx0XHR0eXBlID0gdHlwZU9mKGlucHV0KSxcclxuXHRcdFx0aW5kZXgsIHNpemU7XHJcblxyXG5cdFx0aWYgKHR5cGUgPT09ICdhcnJheScpIHtcclxuXHJcblx0XHRcdG91dHB1dCA9IFtdO1xyXG5cdFx0XHRzaXplID0gaW5wdXQubGVuZ3RoO1xyXG5cclxuXHRcdFx0Zm9yIChpbmRleD0wO2luZGV4PHNpemU7KytpbmRleClcclxuXHJcblx0XHRcdFx0b3V0cHV0W2luZGV4XSA9IFB1YmxpYy5jbG9uZShpbnB1dFtpbmRleF0pO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpIHtcclxuXHJcblx0XHRcdG91dHB1dCA9IHt9O1xyXG5cclxuXHRcdFx0Zm9yIChpbmRleCBpbiBpbnB1dClcclxuXHJcblx0XHRcdFx0b3V0cHV0W2luZGV4XSA9IFB1YmxpYy5jbG9uZShpbnB1dFtpbmRleF0pO1xyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gb3V0cHV0O1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSB0d28gb2JqZWN0cyByZWN1cnNpdmVseVxyXG5cdCAqIEBwYXJhbSBtaXhlZCBpbnB1dFxyXG5cdCAqIEBwYXJhbSBtaXhlZCBleHRlbmRcclxuXHQgKiBAcmV0dXJuIG1peGVkXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIG1lcmdlX3JlY3Vyc2l2ZShiYXNlLCBleHRlbmQpIHtcclxuXHJcblx0XHRpZiAodHlwZU9mKGJhc2UpICE9PSAnb2JqZWN0JylcclxuXHJcblx0XHRcdHJldHVybiBleHRlbmQ7XHJcblxyXG5cdFx0Zm9yICh2YXIga2V5IGluIGV4dGVuZCkge1xyXG5cclxuXHRcdFx0aWYgKHR5cGVPZihiYXNlW2tleV0pID09PSAnb2JqZWN0JyAmJiB0eXBlT2YoZXh0ZW5kW2tleV0pID09PSAnb2JqZWN0Jykge1xyXG5cclxuXHRcdFx0XHRiYXNlW2tleV0gPSBtZXJnZV9yZWN1cnNpdmUoYmFzZVtrZXldLCBleHRlbmRba2V5XSk7XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRiYXNlW2tleV0gPSBleHRlbmRba2V5XTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGJhc2U7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9yIG1vcmUgb2JqZWN0c1xyXG5cdCAqIEBwYXJhbSBib29sIGNsb25lXHJcblx0ICogQHBhcmFtIGJvb2wgcmVjdXJzaXZlXHJcblx0ICogQHBhcmFtIGFycmF5IGFyZ3ZcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiBtZXJnZShjbG9uZSwgcmVjdXJzaXZlLCBhcmd2KSB7XHJcblxyXG5cdFx0dmFyIHJlc3VsdCA9IGFyZ3ZbMF0sXHJcblx0XHRcdHNpemUgPSBhcmd2Lmxlbmd0aDtcclxuXHJcblx0XHRpZiAoY2xvbmUgfHwgdHlwZU9mKHJlc3VsdCkgIT09ICdvYmplY3QnKVxyXG5cclxuXHRcdFx0cmVzdWx0ID0ge307XHJcblxyXG5cdFx0Zm9yICh2YXIgaW5kZXg9MDtpbmRleDxzaXplOysraW5kZXgpIHtcclxuXHJcblx0XHRcdHZhciBpdGVtID0gYXJndltpbmRleF0sXHJcblxyXG5cdFx0XHRcdHR5cGUgPSB0eXBlT2YoaXRlbSk7XHJcblxyXG5cdFx0XHRpZiAodHlwZSAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIga2V5IGluIGl0ZW0pIHtcclxuXHJcblx0XHRcdFx0dmFyIHNpdGVtID0gY2xvbmUgPyBQdWJsaWMuY2xvbmUoaXRlbVtrZXldKSA6IGl0ZW1ba2V5XTtcclxuXHJcblx0XHRcdFx0aWYgKHJlY3Vyc2l2ZSkge1xyXG5cclxuXHRcdFx0XHRcdHJlc3VsdFtrZXldID0gbWVyZ2VfcmVjdXJzaXZlKHJlc3VsdFtrZXldLCBzaXRlbSk7XHJcblxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdFx0cmVzdWx0W2tleV0gPSBzaXRlbTtcclxuXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCB0eXBlIG9mIHZhcmlhYmxlXHJcblx0ICogQHBhcmFtIG1peGVkIGlucHV0XHJcblx0ICogQHJldHVybiBzdHJpbmdcclxuXHQgKlxyXG5cdCAqIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vdHlwZW9mdmFyXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIHR5cGVPZihpbnB1dCkge1xyXG5cclxuXHRcdHJldHVybiAoe30pLnRvU3RyaW5nLmNhbGwoaW5wdXQpLnNsaWNlKDgsIC0xKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuXHR9XHJcblxyXG5cdGlmIChpc05vZGUpIHtcclxuXHJcblx0XHRtb2R1bGUuZXhwb3J0cyA9IFB1YmxpYztcclxuXHJcblx0fSBlbHNlIHtcclxuXHJcblx0XHR3aW5kb3dbcHVibGljTmFtZV0gPSBQdWJsaWM7XHJcblxyXG5cdH1cclxuXHJcbn0pKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZSAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKTsiLCJ2YXIgZW1pdCA9IHJlcXVpcmUoICdlbWl0LWJpbmRpbmdzJyApLFxuICAgIGF0dHJpYnV0ZXMgPSB7XG4gICAgICAgIG5hbWUgOiAncHJldmlldycsXG4gICAgICAgIGhpZGU6IHRydWVcbiAgICB9O1xuXG5cbmZ1bmN0aW9uIFByZXZpZXcoIGF0dHJzICl7IFxuICAgIHRoaXMuYXR0cmlidXRlcyA9IGF0dHJzO1xufVxuXG5QcmV2aWV3LnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbiggbWV0YSwgc2tvbGwsIGRvbmUgKXtcbiAgICAgICAgdmFyIGZpbGVzID0gbWV0YS5ldmVudC5maWxlcy5maWx0ZXIoIGZpbHRlclVybHMgKSxcbiAgICAgICAgICAgIHNpemUgPSBmaWxlcy5sZW5ndGgsXG4gICAgICAgICAgICBjb3VudCA9IDAsXG4gICAgICAgICAgICByZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKCB0aGlzICksXG4gICAgICAgICAgICBfZmlsZXMgPSBbXTtcblxuXG4gICAgICAgIGZ1bmN0aW9uIG5leHQoIGVyciwgVVJJICkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgYnRucywgYmFjaztcblxuICAgICAgICAgICAgY291bnQgKys7XG5cbiAgICAgICAgICAgIGlmICggIWVyciAmJiBVUkkgKSB7IFxuICAgICAgICAgICAgICAgIF9maWxlcy5wdXNoKCBVUkkgKTsgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICggY291bnQgPT09IHNpemUgKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyKCBfZmlsZXMsIGRvbmUgKTtcblxuICAgICAgICAgICAgICAgIGJhY2sgPSBPYmplY3QuY3JlYXRlKCB7IG1ldGE6IG1ldGEgfSApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIHNrb2xsLnByZXZQbHVnaW4gPT09ICdvYmplY3QnICkge1xuICAgICAgICAgICAgICAgICAgICBiYWNrLnBsdWdpbiA9IHNrb2xsLnByZXZQbHVnaW4uYXR0cmlidXRlcy5uYW1lOyAvLyB0aGlzIGFsbG93cyBmb3Igc2tvbGwgdG8gYmFjayB0byBwcmlvciBwbHVnaW5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlbWl0Lm9uKCAnc2tvbGwucHJldmlldy5jYW5jZWwnLCBza29sbC5vcGVuLmJpbmQoIHNrb2xsLCBiYWNrICkgKTtcbiAgICAgICAgICAgICAgICBlbWl0Lm9uKCAnc2tvbGwucHJldmlldy51c2UnLCBza29sbC51cGxvYWQuYmluZCggc2tvbGwsIG1ldGEuZXZlbnQgKSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCAhc2l6ZSApIHtcbiAgICAgICAgICAgIGRvbmUoIG51bGwsICcnICk7IC8vIGNhbGwgZXZlbnRcbiAgICAgICAgICAgIHNrb2xsLnVwbG9hZCggbWV0YS5ldmVudCApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBmaWxlcyBydW4gdGhyb3VnaCBlYWNoXG4gICAgICAgIGZpbGVzLmZvckVhY2goIGZ1bmN0aW9uKCBmaWxlICl7XG4gICAgICAgICAgICAgICAgcmVhZEZpbGUoIGZpbGUsIG5leHQgKTsgXG4gICAgICAgICAgICB9ICk7ICAgIFxuXG4gICAgfSxcbiAgICB0ZWFyZG93bjogZnVuY3Rpb24oKXtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC5wcmV2aWV3LmNhbmNlbCcgKTtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC5wcmV2aWV3LnVzZScgKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24oIGZpbGVzLCBjYWxsYmFjayApIHtcbiAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApLFxuICAgICAgICAgICAgdXNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKSxcbiAgICAgICAgICAgIGNhbmNlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICksXG4gICAgICAgICAgICBpbWFnZXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApLFxuICAgICAgICAgICAgYnV0dG9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cbiAgICAgICAgd3JhcHBlci5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtcHJldmlldy13cmFwcGVyJyApO1xuICAgICAgICBpbWFnZXMuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXByZXZpZXctaW1hZ2VzJyApO1xuICAgICAgICBidXR0b25zLmNsYXNzTGlzdC5hZGQoICdza29sbC1wcmV2aWV3LWJ1dHRvbnMnICk7XG5cbiAgICAgICAgdXNlLnRleHRDb250ZW50ID0gJ1VzZSc7XG4gICAgICAgIHVzZS5zZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnLCAnc2tvbGwucHJldmlldy51c2UnICk7XG4gICAgICAgIHVzZS5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtYnV0dG9uJyApO1xuXG4gICAgICAgIGNhbmNlbC50ZXh0Q29udGVudCA9ICdDYW5jZWwnO1xuICAgICAgICBjYW5jZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0JywgJ3Nrb2xsLnByZXZpZXcuY2FuY2VsJyApO1xuICAgICAgICBjYW5jZWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLWJ1dHRvbicgKTtcblxuICAgICAgICBpZiggZmlsZXMubGVuZ3RoID09PSAxICkge1xuICAgICAgICAgICAgLy8gZGlzcGxheSBhIGxhcmdlIGltYWdlXG4gICAgICAgICAgICB2YXIgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2ltZycgKTtcbiAgICAgICAgICAgIGltZy5zcmMgPSBmaWxlc1sgMCBdO1xuICAgICAgICAgICAgaW1nLmNsYXNzTGlzdC5hZGQoICdza29sbC1wcmV2aWV3LWltYWdlLWxhcmdlJyk7XG4gICAgICAgICAgICBpbWFnZXMuYXBwZW5kQ2hpbGQoIGltZyApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZmlsZXMuZm9yRWFjaCggY3JlYXRlRWxlbWVudEFuZEFwcGVuZCggaW1hZ2VzICkgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQoIGltYWdlcyApO1xuICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKCBidXR0b25zICk7XG4gICAgICAgIGJ1dHRvbnMuYXBwZW5kQ2hpbGQoIGNhbmNlbCApO1xuICAgICAgICBidXR0b25zLmFwcGVuZENoaWxkKCB1c2UgKTtcblxuICAgICAgICBjYWxsYmFjayggbnVsbCwgd3JhcHBlciApO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IFByZXZpZXcoIGF0dHJpYnV0ZXMgKTtcbm1vZHVsZS5leHBvcnRzLlBsdWdpbiA9IFByZXZpZXc7IC8vIGV4cG9ydCBvdXQgcGx1Z2luIGZvciBleHRlbmRpbmdcblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudEFuZEFwcGVuZCggY29udGFpbmVyICkge1xuICAgIHJldHVybiBmdW5jdGlvbiggZmlsZSApIHtcbiAgICAgICAgdmFyIGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgIGltZy5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtcHJldmlldy1pbWFnZScgKTtcbiAgICAgICAgaW1nLnNldEF0dHJpYnV0ZSggJ3N0eWxlJywgJ2JhY2tncm91bmQtaW1hZ2U6IHVybCgnICsgZmlsZSArICcpOycgKTtcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKCBpbWcgKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZpbHRlclVybHMoIGZpbGUgKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBmaWxlLnVybCAhPT0gJ3N0cmluZyc7XG59XG5cbmZ1bmN0aW9uIHJlYWRGaWxlKCBmaWxlLCBjYWxsYmFjayApIHtcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblxuICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbiggKSB7XG4gICAgICAgIGNhbGxiYWNrKCBudWxsLCByZWFkZXIucmVzdWx0ICk7XG4gICAgfTtcblxuICAgIHJlYWRlci5vbmVycm9yID0gZnVuY3Rpb24oIGVyciApIHtcbiAgICAgICAgY2FsbGJhY2soIGVyciApO1xuICAgIH07XG5cbiAgICByZWFkZXIucmVhZEFzRGF0YVVSTCggZmlsZSApO1xufSIsIlxudmFyIGVtaXQgPSByZXF1aXJlKCAnZW1pdC1iaW5kaW5ncycgKTtcblxuZnVuY3Rpb24gVXBsb2FkKCBhdHRycyApeyBcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSBhdHRycztcbn1cblxuVXBsb2FkLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbiggbWV0YSwgc2tvbGwsIGRvbmUgKSB7XG4gICAgICAgIHRoaXMuc2tvbGwgPSBza29sbDtcbiAgICAgICAgZW1pdC5vbiggJ3Nrb2xsLnVwbG9hZC5zdWJtaXQnLCB0aGlzLm9uU3VibWl0LmJpbmQoIHRoaXMgKSApO1xuICAgICAgICBlbWl0Lm9uKCAnc2tvbGwudXBsb2FkLnRyaWdnZXInLCB0aGlzLm9uVHJpZ2dlci5iaW5kKCB0aGlzICkgKTtcbiAgICAgICAgdGhpcy5yZW5kZXIoIG1ldGEsIGRvbmUgKTtcbiAgICB9LFxuICAgIHRlYXJkb3duOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gY2xlYXIgb3V0IHNvbWUgY2FjaGVcbiAgICAgICAgdGhpcy51cGxvYWQgPSBudWxsO1xuICAgICAgICB0aGlzLmlucHV0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBudWxsO1xuICAgICAgICB0aGlzLnNrb2xsID0gbnVsbDtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC51cGxvYWQuc3VibWl0JyApO1xuICAgICAgICBlbWl0LnJlbW92ZUFsbExpc3RlbmVycyggJ3Nrb2xsLnVwbG9hZC50cmlnZ2VyJyApO1xuICAgIH0sXG4gICAgb25TdWJtaXQ6IGZ1bmN0aW9uKCBlICkge1xuXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICB2YXIgaW5wdXQgPSB0aGlzLmlucHV0LFxuICAgICAgICAgICAgdmFsdWUgPSBpbnB1dC52YWx1ZSxcbiAgICAgICAgICAgIGV2ZW50ID0ge1xuICAgICAgICAgICAgICAgIGZpbGVzOiBbe1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHZhbHVlXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5za29sbC5wcmV2aWV3KCBldmVudCApO1xuICAgIH0sXG4gICAgb25DaGFuZ2U6IGZ1bmN0aW9uKCBlICkge1xuICAgICAgICB0aGlzLnNrb2xsLnByZXZpZXcoIGUudGFyZ2V0ICk7XG4gICAgfSxcbiAgICBvblRyaWdnZXI6IGZ1bmN0aW9uKCBlICkge1xuICAgICAgICB0aGlzLnVwbG9hZC5kaXNwYXRjaEV2ZW50KCBuZXcgTW91c2VFdmVudCggJ2NsaWNrJyApICk7IC8vIHByb3h5IGV2ZW50IHRvIHVwbG9hZFxuICAgIH0sXG4gICAgYXR0YWNoTGlzdGVuZXJzOiBmdW5jdGlvbiggKSB7XG5cbiAgICAgICAgdmFyIGxlYXZlQnVmZmVyLFxuICAgICAgICAgICAgY2xhc3NMaXN0ID0gdGhpcy5kcm9wem9uZS5jbGFzc0xpc3Q7XG5cbiAgICAgICAgZnVuY3Rpb24gZHJhZ092ZXIoKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoIGxlYXZlQnVmZmVyICk7XG4gICAgICAgICAgICBpZiAoIGNsYXNzTGlzdC5jb250YWlucyggJ3Nrb2xsLXVwbG9hZC1kcmFnLW92ZXInICkgKSByZXR1cm47XG4gICAgICAgICAgICBjbGFzc0xpc3QuYWRkKCAnc2tvbGwtdXBsb2FkLWRyYWctb3ZlcicgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRyYWdMZWF2ZSgpIHtcbiAgICAgICAgICAgIGNsYXNzTGlzdC5yZW1vdmUoICdza29sbC11cGxvYWQtZHJhZy1vdmVyJyApO1xuICAgICAgICAgICAgY2xhc3NMaXN0LnJlbW92ZSggJ3Nrb2xsLXVwbG9hZC1zaG93JyApO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc2hvd092ZXIoKSB7XG4gICAgICAgICAgICBpZiAoIGNsYXNzTGlzdC5yZW1vdmUoICdza29sbC11cGxvYWQtc2hvdycgKSApIHJldHVybjtcbiAgICAgICAgICAgIGNsYXNzTGlzdC5hZGQoICdza29sbC11cGxvYWQtc2hvdycgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZHJvcHpvbmUuYWRkRXZlbnRMaXN0ZW5lciggJ2RyYWdvdmVyJywgZHJhZ092ZXIgKTtcbiAgICAgICAgdGhpcy5kcm9wem9uZS5hZGRFdmVudExpc3RlbmVyKCAnZHJhZ2xlYXZlJywgZHJhZ0xlYXZlICk7XG4gICAgICAgIHRoaXMuZHJvcHpvbmUuYWRkRXZlbnRMaXN0ZW5lciggJ2Ryb3AnLCBkcmFnTGVhdmUgKTtcblxuICAgICAgICB0aGlzLnNrb2xsLmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdkcmFnb3ZlcicsIHNob3dPdmVyICk7XG4gICAgICAgIHRoaXMuc2tvbGwuZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2RyYWdvdmVyJywgc2hvd092ZXIgKTtcblxuICAgICAgICB0aGlzLnVwbG9hZC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdGhpcy5vbkNoYW5nZS5iaW5kKCB0aGlzICkgKTtcblxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiggbWV0YSwgZG9uZSApIHtcblxuICAgICAgICB2YXIgaHRtbCA9IFxuICAgICAgICAnPGRpdiBjbGFzcz1cInNrb2xsLXVwbG9hZC11cmxcIj4nICsgXG4gICAgICAgICAgICAnPGJ1dHRvbiBjbGFzcz1cInNrb2xsLWJ1dHRvblwiIGRhdGEtZW1pdD1cInNrb2xsLnVwbG9hZC50cmlnZ2VyXCI+VXBsb2FkIEEgRmlsZTwvYnV0dG9uPicgK1xuICAgICAgICAnPC9kaXY+JyArXG4gICAgICAgICc8aHI+JyArXG4gICAgICAgICc8Zm9ybSBjbGFzcz1cInNrb2xsLXVwbG9hZC1mb3JtXCIgZGF0YS1lbWl0PVwic2tvbGwudXBsb2FkLnN1Ym1pdFwiPicgKyBcbiAgICAgICAgICAgICc8cD5Vc2UgYW4gVVJMOjwvcD4nICsgXG4gICAgICAgICAgICAnPGlucHV0IHR5cGU9XCJ1cmxcIiAvPicgKyBcbiAgICAgICAgICAgICc8YnV0dG9uIGNsYXNzPVwic2tvbGwtYnV0dG9uXCI+U3VibWl0PC9idXR0b24+JyArXG4gICAgICAgICc8L2Zvcm0+JyArXG4gICAgICAgICc8ZGl2IGNsYXNzPVwic2tvbGwtdXBsb2FkLWRyb3B6b25lXCI+JyArXG4gICAgICAgICAgICAnPHA+RHJvcCB5b3UgaW1hZ2VzIGhlcmUhPC9wPicgK1xuICAgICAgICAgICAgJzxpbnB1dCBjbGFzcz1cInNrb2xsLXVwbG9hZC1pbnB1dFwiIHR5cGU9XCJmaWxlXCIgLz4nICtcbiAgICAgICAgJzwvZGl2Pic7XG5cbiAgICAgICAgdGhpcy5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgIHRoaXMuZWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXVwbG9hZC1wbHVnaW4nICk7XG4gICAgICAgIHRoaXMuZWwuaW5uZXJIVE1MID0gaHRtbDtcblxuICAgICAgICB0aGlzLmRyb3B6b25lID0gdGhpcy5lbC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCAnc2tvbGwtdXBsb2FkLWRyb3B6b25lJyApWyAwIF07XG4gICAgICAgIHRoaXMudXBsb2FkID0gdGhpcy5kcm9wem9uZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCAnc2tvbGwtdXBsb2FkLWlucHV0JyApWyAwIF07XG4gICAgICAgIHRoaXMuaW5wdXQgPSB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3IoICcuc2tvbGwtdXBsb2FkLWZvcm0gaW5wdXQnICk7XG5cbiAgICAgICAgaWYgKCBtZXRhLm11bHRpcGxlICkge1xuICAgICAgICAgICAgdGhpcy51cGxvYWQuc2V0QXR0cmlidXRlKCAnbXVsdGlwbGUnLCB0cnVlICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIG1ldGEudXJsICkge1xuICAgICAgICAgICAgdGhpcy5pbnB1dC52YWx1ZSA9IG1ldGEudXJsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hdHRhY2hMaXN0ZW5lcnMoICk7XG5cbiAgICAgICAgZG9uZSggbnVsbCwgdGhpcy5lbCApO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IFVwbG9hZCgge1xuICAgIG5hbWU6ICd1cGxvYWQnXG59ICk7IiwiXG4ndXNlIHN0cmljdCc7XG5cbnZhciBpbWFnZVRvQmxvYiA9IHJlcXVpcmUoICdpbWFnZS10by1ibG9iJyApLFxuICAgIHV0aWxzID0gcmVxdWlyZSggJy4vdXRpbHMnICk7XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlVXBsb2FkRXZlbnQ7XG5cbmZ1bmN0aW9uIGNyZWF0ZVVwbG9hZEV2ZW50ICggZXZlbnRkYXRhLCBjYWxsYmFjayApIHtcbiAgICBfZ2V0QmxvYkRhdGEoIGV2ZW50ZGF0YSwgZnVuY3Rpb24oIGVyciwgZmlsZXMgKSB7IFxuICAgICAgICBpZiAoIGVyciApIHJldHVybiBjYWxsYmFjayggZXJyICk7XG4gICAgICAgIGV2ZW50ZGF0YS5maWxlcyA9IGZpbGVzO1xuXG4gICAgICAgIGNhbGxiYWNrKCBudWxsLCBldmVudGRhdGEgKTtcbiAgICB9ICk7ICAgIFxufVxuIFxuZnVuY3Rpb24gX2dldEJsb2JEYXRhICggZXZlbnRkYXRhLCBjYWxsYmFjayApIHtcbiAgICB2YXIgZmlsZXMgPSB1dGlscy5tYWtlQXJyYXkoIGV2ZW50ZGF0YS5maWxlcyApLFxuICAgICAgICBzaXplID0gZmlsZXMubGVuZ3RoLFxuICAgICAgICBjb3VudCA9IDA7XG5cbiAgICBmdW5jdGlvbiBkb25lICggKSB7XG4gICAgICAgIGNvdW50ICsrO1xuICAgICAgICBpZiAoIGNvdW50ID09PSBzaXplICkge1xuICAgICAgICAgICAgY2FsbGJhY2soIG51bGwsIGZpbGVzICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCbG9iRGF0YSggZmlsZSwgaW5kZXggKSB7XG4gICAgICAgIGlmICggZmlsZSBpbnN0YW5jZW9mIEJsb2IgKSB7XG4gICAgICAgICAgICBkb25lKCk7IC8vIGlmIGl0cyBhbHJlYWR5IGEgYmxvYiBubyBuZWVkIHRvIGRvIGFueXRoaW5nXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGZpbGUudXJsIHx8IGZpbGUuZGF0YSApIHsgLy8gaWYgdGhlIGZpbGUgdXJsIGlzIHNldCBvZiB0aGUgZmlsZSBkYXRhIG1lYW5pbmcgYSBkYXRhdXJpXG4gICAgICAgICAgICBpbWFnZVRvQmxvYiggZmlsZS51cmwgfHwgZmlsZS5kYXRhLCBmdW5jdGlvbiggZXJyLCBibG9iICkge1xuICAgICAgICAgICAgICAgIGlmICggZXJyICkgcmV0dXJuIGRvbmUoKTsgLy8gdW5hYmxlIHRvIGNvbnZlcnQgc28gc2VuZCBpbiByYXcgZm9ybVxuICAgICAgICAgICAgICAgIGZpbGVzWyBpbmRleCBdID0gYmxvYjtcbiAgICAgICAgICAgICAgICBkb25lKCApO1xuICAgICAgICAgICAgfSApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGRvbmUoICk7XG4gICAgfVxuXG4gICAgZmlsZXMuZm9yRWFjaCggZ2V0QmxvYkRhdGEgKTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cy5tYWtlQXJyYXkgPSBmdW5jdGlvbiAoIGFyciApIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyciwgMCApO1xufTsiXX0=
