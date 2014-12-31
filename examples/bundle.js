(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/jacob/Projects/Hone/skoll/examples/foo.js":[function(require,module,exports){

var plugin = module.exports = {
    open: function( meta, skoll, done ) {
        done( null, "<h1>Hello World</h1>" );
    },
    teardown: function() { },
    attributes: {
        'name' : 'foo'
    }
}

},{}],"/home/jacob/Projects/Hone/skoll/examples/index.js":[function(require,module,exports){
var skoll = require( '..' ),
    emit = require( 'emit-bindings' ),
    foo = require( './foo' );

emit.on( 'open.skoll', skoll.open.bind( skoll ) );

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
},{"..":"/home/jacob/Projects/Hone/skoll/index.js","./foo":"/home/jacob/Projects/Hone/skoll/examples/foo.js","emit-bindings":"/home/jacob/Projects/Hone/skoll/node_modules/emit-bindings/index.js"}],"/home/jacob/Projects/Hone/skoll/index.js":[function(require,module,exports){

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

},{"./src/plugins/preview":"/home/jacob/Projects/Hone/skoll/src/plugins/preview.js","./src/plugins/upload":"/home/jacob/Projects/Hone/skoll/src/plugins/upload.js","./src/upload-event":"/home/jacob/Projects/Hone/skoll/src/upload-event.js","./src/utils":"/home/jacob/Projects/Hone/skoll/src/utils.js","emit-bindings":"/home/jacob/Projects/Hone/skoll/node_modules/emit-bindings/index.js","eventemitter2":"/home/jacob/Projects/Hone/skoll/node_modules/eventemitter2/lib/eventemitter2.js","image-to-blob":"/home/jacob/Projects/Hone/skoll/node_modules/image-to-blob/index.js","merge":"/home/jacob/Projects/Hone/skoll/node_modules/merge/merge.js"}],"/home/jacob/Projects/Hone/skoll/node_modules/emit-bindings/index.js":[function(require,module,exports){
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
},{"eventemitter2":"/home/jacob/Projects/Hone/skoll/node_modules/eventemitter2/lib/eventemitter2.js"}],"/home/jacob/Projects/Hone/skoll/node_modules/eventemitter2/lib/eventemitter2.js":[function(require,module,exports){
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

},{}],"/home/jacob/Projects/Hone/skoll/node_modules/image-to-blob/index.js":[function(require,module,exports){

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

},{"image-to-data-uri":"/home/jacob/Projects/Hone/skoll/node_modules/image-to-blob/node_modules/image-to-data-uri/image-to-data-uri.js"}],"/home/jacob/Projects/Hone/skoll/node_modules/image-to-blob/node_modules/image-to-data-uri/image-to-data-uri.js":[function(require,module,exports){
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

},{}],"/home/jacob/Projects/Hone/skoll/node_modules/merge/merge.js":[function(require,module,exports){
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
},{}],"/home/jacob/Projects/Hone/skoll/src/plugins/preview.js":[function(require,module,exports){
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
},{"emit-bindings":"/home/jacob/Projects/Hone/skoll/node_modules/emit-bindings/index.js"}],"/home/jacob/Projects/Hone/skoll/src/plugins/upload.js":[function(require,module,exports){

var emit = require( 'emit-bindings' );

function Upload( attrs ){ 
    this.attributes = attrs;
}

Upload.prototype = {
    open: function( meta, skoll, done ) {
        this.skoll = skoll;
        emit.on( 'skoll.upload.submit', this.onSubmit.bind( this ) );
        emit.on( 'skoll.upload.trigger', this.onTrigger.bind( this ) );
        this.render( done );
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
    render: function( done ) {

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
            '<input class="skoll-upload-input" type="file" multiple />' +
        '</div>';

        this.el = document.createElement( 'div' );
        this.el.classList.add( 'skoll-upload-plugin' );
        this.el.innerHTML = html;

        this.dropzone = this.el.getElementsByClassName( 'skoll-upload-dropzone' )[ 0 ];
        this.upload = this.dropzone.getElementsByClassName( 'skoll-upload-input' )[ 0 ];
        this.input = this.el.querySelector( '.skoll-upload-form input' );

        this.attachListeners( );

        done( null, this.el );
    }
};

module.exports = new Upload( {
    name: 'upload'
} );
},{"emit-bindings":"/home/jacob/Projects/Hone/skoll/node_modules/emit-bindings/index.js"}],"/home/jacob/Projects/Hone/skoll/src/upload-event.js":[function(require,module,exports){

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

},{"./utils":"/home/jacob/Projects/Hone/skoll/src/utils.js","image-to-blob":"/home/jacob/Projects/Hone/skoll/node_modules/image-to-blob/index.js"}],"/home/jacob/Projects/Hone/skoll/src/utils.js":[function(require,module,exports){

'use strict';

module.exports.makeArray = function ( arr ) {
    return Array.prototype.slice.call( arr, 0 );
};
},{}]},{},["/home/jacob/Projects/Hone/skoll/examples/index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiZXhhbXBsZXMvZm9vLmpzIiwiZXhhbXBsZXMvaW5kZXguanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lbWl0LWJpbmRpbmdzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliL2V2ZW50ZW1pdHRlcjIuanMiLCJub2RlX21vZHVsZXMvaW1hZ2UtdG8tYmxvYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pbWFnZS10by1ibG9iL25vZGVfbW9kdWxlcy9pbWFnZS10by1kYXRhLXVyaS9pbWFnZS10by1kYXRhLXVyaS5qcyIsIm5vZGVfbW9kdWxlcy9tZXJnZS9tZXJnZS5qcyIsInNyYy9wbHVnaW5zL3ByZXZpZXcuanMiLCJzcmMvcGx1Z2lucy91cGxvYWQuanMiLCJzcmMvdXBsb2FkLWV2ZW50LmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG52YXIgcGx1Z2luID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oIG1ldGEsIHNrb2xsLCBkb25lICkge1xuICAgICAgICBkb25lKCBudWxsLCBcIjxoMT5IZWxsbyBXb3JsZDwvaDE+XCIgKTtcbiAgICB9LFxuICAgIHRlYXJkb3duOiBmdW5jdGlvbigpIHsgfSxcbiAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICAgICduYW1lJyA6ICdmb28nXG4gICAgfVxufVxuIiwidmFyIHNrb2xsID0gcmVxdWlyZSggJy4uJyApLFxuICAgIGVtaXQgPSByZXF1aXJlKCAnZW1pdC1iaW5kaW5ncycgKSxcbiAgICBmb28gPSByZXF1aXJlKCAnLi9mb28nICk7XG5cbmVtaXQub24oICdvcGVuLnNrb2xsJywgc2tvbGwub3Blbi5iaW5kKCBza29sbCApICk7XG5cbnNrb2xsLm9uKCAnZXJyb3InLCBmdW5jdGlvbiggZXJyICkge1xuICAgIGNvbnNvbGUuZXJyb3IoIGVyci5tZXNzYWdlICk7XG4gICAgY29uc29sZS5lcnJvciggZXJyLnN0YWNrICk7XG59ICk7XG5cbnNrb2xsLmFkZFBsdWdpbiggZm9vICk7XG5cbnNrb2xsLnVzZVRvVXBsb2FkKCBmdW5jdGlvbiggZXZlbnQgKXtcbiAgICBjb25zb2xlLmxvZyggZXZlbnQgKTtcbn0pO1xuXG53aW5kb3cuc2tvbGwgPSBza29sbDtcblxuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggc2tvbGwuZWwgKTsiLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIG1lcmdlID0gcmVxdWlyZSggJ21lcmdlJyApLFxuICAgIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCAnZXZlbnRlbWl0dGVyMicgKS5FdmVudEVtaXR0ZXIyLFxuICAgIGVtaXQgPSByZXF1aXJlKCAnZW1pdC1iaW5kaW5ncycgKSxcbiAgICBVcGxvYWRFdmVudCA9IHJlcXVpcmUoICcuL3NyYy91cGxvYWQtZXZlbnQnKSxcbiAgICB1dGlscyA9IHJlcXVpcmUoICcuL3NyYy91dGlscycgKSxcbiAgICB1cGxvYWRQbHVnaW4gPSByZXF1aXJlKCAnLi9zcmMvcGx1Z2lucy91cGxvYWQnICksXG4gICAgcHJldmlld1BsdWdpbiA9IHJlcXVpcmUoICcuL3NyYy9wbHVnaW5zL3ByZXZpZXcnICk7XG5cbi8qXG4jIyMgU2tvbGwgLSBDb25zdHJ1Y3RvclxuXG5UaGlzIGlzIGEgYmFzaWMgQ29uc3RydWN0b3IgdGhhdCB3aWxsIGp1c3QgaW5pdGlhbGl6ZSBzb21lIGJhc2ljIGRhdGEgc3RydWN0dXJlcyBuZWVkZWQgdG8gY2hhbmdlIHRoZSBzdGF0ZSBvZiB0aGUgZmlsZVVwbG9hZCB0aGlzIHNob3VsZCBub3QgZHVlIG11Y2ggZHVlIHRvIHRoZSBmYWN0IHRoYXQgdGhpcyB3aWxsIGhhcHBlbiBpbml0aWFsbHkgaW5zaWRlIG9mIHRoZSBtb2R1bGUgZm9yIHRoZSBzaW5nbGV0b24uIFRoaXMgc2hvdWxkIGFsc28gYmUgYWNjZXNzYWJsZSB2aWEgYW4gZXhwb3J0LlxuXG5gYGBqYXZhc2NyaXB0XG52YXIgU2tvbGwgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKS5Ta29sbCxcbiAgICBTa29sbCA9IG5ldyBTa29sbCgpO1xuYGBgXG4qL1xuXG5mdW5jdGlvbiBTa29sbCgpIHtcblxuICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgIHZpZXc6IDBcbiAgICB9O1xuICAgIHRoaXMucGx1Z2lucyA9IHsgfTtcbiAgICB0aGlzLmRlZmF1bHRzID0ge1xuICAgICAgICBwbHVnaW4gOiAndXBsb2FkJyxcbiAgICAgICAgY2xvc2VPblVwbG9hZDogdHJ1ZVxuICAgIH07XG5cbiAgICBFdmVudEVtaXR0ZXIyLmNhbGwoIHRoaXMgKTtcbiAgICBzZXRUaW1lb3V0KCB0aGlzLl9pbml0LmJpbmQoIHRoaXMgKSwgMCApO1xufVxuXG5Ta29sbC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBFdmVudEVtaXR0ZXIyLnByb3RvdHlwZSwge1xuICAgICAgICBwbHVnaW5MaXN0OiB7IC8vIGRlc2NyaXB0b3JcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCApIHsgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBwbHVnaW5zID0gT2JqZWN0LmtleXMoIHRoaXMucGx1Z2lucyApO1xuICAgICAgICAgICAgICAgIHJldHVybiBwbHVnaW5zLm1hcCggU2tvbGwubWFwUGx1Z2lucyggdGhpcy5wbHVnaW5zICkgKVxuICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKCBTa29sbC5wbHVnaW5WaXNpYmxlIClcbiAgICAgICAgICAgICAgICAgICAgLm1hcCggU2tvbGwucGx1Z2luTGlzdEVsKCB0aGlzLmN1cnJlbnRQbHVnaW4gKSApXG4gICAgICAgICAgICAgICAgICAgIC5yZXZlcnNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4pO1xuXG5Ta29sbC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBTa29sbDtcbi8qXG4jIyMgU2tvbGw6Om9wZW5cblxuVGhpcyB3aWxsIGp1c3QgYXBwbHkgYSBjbGFzcywgYHNob3dgLCB0byB0aGUgdXBsb2FkZXIgbW9kYWwgY29udGFpbmVyIHRvIHNob3cgdGhlIG1vZGFsLiBTaW5jZSBvbmx5IGV4YW1wbGUgQ1NTIGlzIHByb3ZpZGVkIGVpdGhlciB0aGUgZXhhbXBsZSBjc3MgbmVlZHMgdG8gYmUgaW50ZXJncmF0ZWQgaW50byB0aGUgY29kZSBvciB5b3Ugd2lsbCBuZWVkIHRvIHByb3ZpZGUgdGhhdCBmdW5jdGlvbmFsaXR5LiBUaGlzIHdpbGwgYWxzbyBzZXQgdGhlIHZpZXcgc3RhdGUgb2YgdGhlIGBTa29sbGAgb2JqZWN0IHRvIGAxYCB0byBpbmRpY2F0ZSB0aGF0IHRoZSBtb2RhbCBpcyBvcGVuLlxuXG5gYGBqYXZhc2NyaXB0XG52YXIgU2tvbGwgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKTtcblxuU2tvbGwub3BlbigpO1xuXG5pZiAoIFNrb2xsLnN0YXRlLnZpZXcgPT09IDEgKSB7XG4gICAgY29uc29sZS5sb2coICdTa29sbCBpcyBvcGVuJyApO1xufVxuXG5gYGBcblxuX19wYXJhbXNfX1xuXG4tIG9wdGlvbnMgeyBPYmplY3QgfSAtIEFuIG9iamVjdCB0aGF0IHdpbGwgc3RvcmUgc29tZSBpbmZvcm1hdGlvbiB0aGF0IHBlcnRhaW5zIHRvIHRoZSB2aWV3IG9uY2UgYmVpbmcgb3BlbmVkLlxuICAgIC0gb3B0aW9ucy5tZXRhIHsgT2JqZWN0IH0gLSBBbiBvYmplY3QgdGhhdCBob2xkcyBkYXRhIGFib3V0IGN1cnJlbnQgc3RhdGUgb2YgYXBwIHRoYXQgaXMgb3BlbmluZyB2aWV3IGNldGFpbiBwbHVnaW5zLCBvciB0YWJzLCB0YWtlIGRpZmZlcm50IHR5cGVzIG9mIGluZm9ybWF0aW9uIGluIHRoaXMgYXJlYSB0byBmdW5jdGlvbiBwcm9wZXJseS4gX1NlZSBzcGVjaWZpYyBwbHVnaW5fIGBQbHVnaW46Om9wZW4gLT4gb3B0aW9uc2AgZm9yIG1vcmUgc3BlY2lmaWMgZGV0YWlscyBzaW5jZSBgb3B0aW9ucy5tZXRhYCBpcyBnZW5lcmFseSBqdXN0IHBhc3NlZCB0byB0aGUgcGx1Z2luIGFzIHRoYXQgb2JqZWN0LlxuICAgIC0gb3B0aW9ucy5wbHVnaW4geyBTdHJpbmcgfSAtIHRoaXMgaXMgdGhlIG5hbWUgb2YgdGhlIHBsdWdpbiB0byBoYXZlIG9wZW4gd2hlbiBjYWxsaW5nIHRoZSBvcGVuIGZuLiBUaGlzIHdpbGwgYWxzbyB0cmlnZ2VyIGEgYFBsdWdpbjo6b3BlbmAuIFNpbmNlIG1vc3Qgb2YgdGhlIGJhc2ljIGZ1bmN0aW9uYWxpdHkgaXMgd3JpdHRlbiBhcyBhIHBsdWdpbiB0aGlzIGNhbiBiZSB1c2VkIHRvIG9wZW4gZGVmYXVsdCB2aWV3cy4gQWxzbyBpZiBubyBuYW1lIGlzIGdpdmVuIHRoZW4gaXQgZGVmYXVsdHMgdG8gdGhlIG1haW4gYHVwbG9hZC1waG90b2AgcGx1Z2luLlxuXG5fX3JldHVybnNfX1xuXG4tIFBsdWdpbiB7IE9iamVjdCB9IC0gcGx1Z2luIHRoYXQgaXMgb3BlbmVkXG5cbmBgYGphdmFzY3JpcHRcbnZhciBTa29sbCA9IHJlcXVpcmUoICdmaWxlLXVwbG9hZGVyJyApO1xuXG5Ta29sbC5vcGVuKCB7XG4gICAgbWV0YToge1xuICAgICAgICBkZXNjcmlwdGlvbjogJ0F3ZXNvbWUgY2F0cyBhbmQgcGl6emFcXCdzIGluIHNwYWNlJ1xuICAgIH0sXG4gICAgcGx1Z2luOiAnZ2lwaHktc2VhcmNoJyAgXG59ICk7IFxuXG5gYGBcbiovXG5cblNrb2xsLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHZhciBkZWZhdWx0UGx1Z2luID0gdGhpcy5kZWZhdWx0cy5wbHVnaW4sXG4gICAgICAgIHBsdWdpbk5hbWUgPSAgb3B0aW9ucy5wbHVnaW4gfHwgZGVmYXVsdFBsdWdpbixcbiAgICAgICAgcGx1Z2luID0gdGhpcy5wbHVnaW5zWyBwbHVnaW5OYW1lIF0gfHwgdGhpcy5wbHVnaW5zWyBkZWZhdWx0UGx1Z2luIF0sXG4gICAgICAgIGNsb3NlID0gdGhpcy5jbG9zZS5iaW5kKCB0aGlzICk7XG5cbiAgICBvcHRpb25zLnBsdWdpbiA9IHBsdWdpbk5hbWU7XG4gICAgdGhpcy5wcmV2UGx1Z2luID0gdGhpcy5jdXJyZW50UGx1Z2luO1xuICAgIHRoaXMuY3VycmVudFBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLm1ldGEgPSBvcHRpb25zLm1ldGEgfHwge307XG5cbiAgICAvLyB1cGRhdGUgbGlua3NcbiAgICB0aGlzLmxpc3RFbC5pbm5lckhUTUwgPSAnJztcblxuICAgIHRoaXMucGx1Z2luTGlzdC5mb3JFYWNoKCB0aGlzLmxpc3RFbC5hcHBlbmRDaGlsZC5iaW5kKCB0aGlzLmxpc3RFbCApICk7XG5cbiAgICB0aGlzLmVsLmNsYXNzTGlzdC5hZGQoICdzaG93JyApO1xuICAgIHRoaXMuc3RhdGUudmlldyA9IDE7XG4gICAgLy8gb3BlbiBwbHVnaW5cbiAgICBpZiAoICFwbHVnaW4gKSB7XG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAnTm8gUGx1Z2luIGlzIGZvdW5kIHdpdGggdGhlIG5hbWUgJyArIHBsdWdpbk5hbWUgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHBsdWdpbi5vcGVuKCBvcHRpb25zLm1ldGEgfHwge30sIHRoaXMsIHRoaXMuX2hhbmRsZVBsdWdpbk9wZW4uYmluZCggdGhpcywgb3B0aW9ucyApICk7XG4gICAgLy8gbmVlZCB0byB1bmJpbmQgdGhpc1xuICAgIC8vIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXl1cCcsIGZ1bmN0aW9uKCBlICkge1xuICAgIC8vICAgIHZhciBjb2RlID0gZS5rZXlDb2RlIHx8IGUud2hpY2g7XG4gICAgLy8gICAgIGNsb3NlKCk7XG4gICAgLy8gfSApO1xuXG4gICAgdGhpcy5lbWl0KCAnb3BlbicsIHBsdWdpbiApOyBcblxufTtcblxuXG4vKlxuIyMjIFNrb2xsOjpjbG9zZVxuXG5UaGlzIHdpbGwgcmVtb3ZlIHRoZSBgc2hvd2AgZnJvbSB0aGUgdXBsb2FkZXIgbW9kYWwgY29udGFpbmVyLiBUaGlzIHdpbGwgYWxzbyB0cmlnZ2VyIGBQbHVnaW46OnRlYXJkb3duYCB0byB0aGUgY3VycmVjdCBhY3RpdmUgcGx1Z2luLlxuXG5gYGBqYXZhc2NyaXB0XG52YXIgU2tvbGwgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKTtcblxuU2tvbGwub3BlbigpO1xuZmlsZVVwbGFkZXIuY2xvc2UoKTtcblxuaWYgKCAhU2tvbGwuc3RhdGUudmlldyApIHtcbiAgICBjb25zb2xlLmxvZyggJ1Nrb2xsIGlzIGNsb3NlZCcgKTtcbn1cblxuYGBgXG4qL1xuXG5Ta29sbC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcblxuICAgIHRoaXMuZWwuY2xhc3NMaXN0LnJlbW92ZSggJ3Nob3cnICk7XG4gICAgdGhpcy5zdGF0ZS52aWV3ID0gMDtcblxuICAgIHRoaXMuY29udGVudEVsLmlubmVySFRNTCA9ICcnO1xuICAgIGlmICggdGhpcy5jdXJyZW50UGx1Z2luICYmIHR5cGVvZiB0aGlzLmN1cnJlbnRQbHVnaW4udGVhcmRvd24gPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFBsdWdpbi50ZWFyZG93bigpO1xuICAgICAgICB0aGlzLmN1cnJlbnRQbHVnaW4gPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuZW1pdCggJ2Nsb3NlJyApO1xuXG59O1xuXG4vKlxuIyMjIFNrb2xsOjp1cGxvYWRcblxuVXBsb2FkIG1ldGhvZCBpcyBhIHByb3h5IHRvIHRoZSBVcGxvYWQgYWRhcHRlciB0aGF0IHNob3VsZCBiZSBwcm92aWRlZC4gVGhpcyBpcyB1c2VkIG1haW5seSB0byBub3JtYWxpemUgc29tZSBvZiB0aGUgZXZlbnQgZGF0YSBhbGxvd2luZyBpdCB0byBiZSBpbiBhIGNvbW1vbiBmb3JtYXQgdGhhdCB1cGxvYWRlciBhZGFwdGVycyBjYW4gZWFzaWx5IGRlYWwgd2l0aC4gVGhpcyBpcyBtYWlubHkgdG8gYmUgdXNlZCBpbnNpZGUgb2YgcGx1Z2luc1xuXG5fX3BhcmFtc19fXG5cbi0gdGFyZ2V0IHsgT2JqZWN0IH0gLSBUaGlzIGlzIGEgb2JqZWN0IHRoYXQgd2lsbCBoYXZlIHRoZSBrZXkgRmlsZXMgaW4gaXQuIEl0IGlzIHNvbWV0aGluZyBzaW1pbGlhciB0byB0aGUgYGV2ZW50LnRhcmdldGAgb2JqZWN0IHlvdSB3b3VsZCBnZXQgb24gYSBjaGFuZ2UgZXZlbnQgb2YgYSBmaWxlIHR5cGUgaW5wdXQuXG4gICAgLSB0YXJnZXQuZmlsZXMgeyBBcnJheSB9IC0gVGhpcyBjYW4gYmUgYSBgQmxvYmAgb3IgYW4gb2JqZWN0IHdpdGggdGhlIGtleSBgdXJsYCBpbnNpZGUgb2YgaXQuIGVnLiBgW3sgdXJsOiBodHRwczovL3Bicy50d2ltZy5jb20vcHJvZmlsZV9pbWFnZXMvNTQ0MDM5NzI4NDYzMzUxODA4L05rb1JkQkJMX2JpZ2dlci5wbmcgfV1gLiBXaGVuIGNyZWF0aW5nIGFuIGV2ZW50IHRoaXMgd2lsbCBhdHRlbXB0IHRvIGNvbnZlcnQgdGhpcyB1cmwgaW50byBhIGJsb2IgaWYgaXQgaXMgYW4gaW1hZ2UsIG90aGVyd2lzZSBpdCB3aWxsIGp1c3QgcGFzcyB0aGUgb2JqZWN0IHRvIHRoZSB1cGxvYWQgYWRhcHRlci5cbiovXG5cblxuU2tvbGwucHJvdG90eXBlLnVwbG9hZCA9IGZ1bmN0aW9uKCB0YXJnZXQgKSB7IFxuXG4gICAgaWYgKCB0eXBlb2YgdGFyZ2V0LmZpbGVzICE9PSAnb2JqZWN0JyApIHsgLy8gZGVmYXVsdCB1cGxvYWQgZXZlbnRzIGFyZSBub3QgYSB0cnVlIGFycmF5XG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAndGFyZ2V0IHBhc3NlZCB0byBTa29sbDo6dXBsb2FkIGRvZXMgbm90IGhhdmUgZmlsZXMgYXJyYXknICkgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIHRoaXMudXBsb2FkRm4gIT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIC8vIGVycm9yXG4gICAgICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAnTm8gdXBsb2FkIGZ1bmN0aW9uIGFkZGVkIHVzaW5nIFNrb2xsOjp1c2VUb1VwbG9hZCcgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGNsb3NlID0gdGhpcy5jbG9zZS5iaW5kKCB0aGlzICksXG4gICAgICAgIHVwbG9hZEZuID0gdGhpcy51cGxvYWRGbixcbiAgICAgICAgY2xvc2VPblVwbG9hZCA9IHRoaXMuZGVmYXVsdHMuY2xvc2VPblVwbG9hZCxcbiAgICAgICAgZXJyb3IgPSB0aGlzLmVtaXQuYmluZCggdGhpcywgJ2Vycm9yJyApO1xuXG4gICAgdGhpcy5fY3JlYXRlRXZlbnQoIHRhcmdldCwgZnVuY3Rpb24oIGVyciwgdXBsb2FkRXZlbnQgKSB7XG4gICAgICAgIGlmICggZXJyICkge1xuICAgICAgICAgICAgZXJyb3IoIGVyciApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdXBsb2FkRm4oIHVwbG9hZEV2ZW50IHx8IF9ldmVudCApO1xuICAgICAgICBpZiAoIGNsb3NlT25VcGxvYWQgKSB7IC8vIHRoaXMgc2hvdWxkIGJlIGNoYW5nYWJsZVxuICAgICAgICAgICAgY2xvc2UoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH0gKTtcbn07XG5cbi8qXG4jIyMgU2tvbGw6OnByZXZpZXdcblxucHJldmlldyBtZXRob2QgaXMgYSBlYXN5IHdheSB0byBvcGVuIHVwIHRoZSB1c2Ugb3IgY2FuY2VsIGRpYWxvZy4gVGhpcyB3aWxsIG9wZW4gdXAgdGhlIHByZXZpZXcgcGx1Z2luIHRoYXQgaXMgcmVnaXN0ZXJlZCB3aXRoIHRoZSBzeXN0ZW0gdG8gcHJldmlldyB0aGUgc2VsZWN0aW9uLiBcblxuX19wYXJhbXNfX1xuXG4tIHRhcmdldCB7IE9iamVjdCB9IC0gVGhpcyBpcyBhIG9iamVjdCB0aGF0IHdpbGwgaGF2ZSB0aGUga2V5IEZpbGVzIGluIGl0LiBJdCBpcyBzb21ldGhpbmcgc2ltaWxpYXIgdG8gdGhlIGBldmVudC50YXJnZXRgIG9iamVjdCB5b3Ugd291bGQgZ2V0IG9uIGEgY2hhbmdlIGV2ZW50IG9mIGEgZmlsZSB0eXBlIGlucHV0LlxuICAgIC0gdGFyZ2V0LmZpbGVzIHsgQXJyYXkgfSAtIFRoaXMgY2FuIGJlIGEgYEJsb2JgIG9yIGFuIG9iamVjdCB3aXRoIHRoZSBrZXkgYHVybGAgaW5zaWRlIG9mIGl0LiBlZy4gYFt7IHVybDogaHR0cHM6Ly9wYnMudHdpbWcuY29tL3Byb2ZpbGVfaW1hZ2VzLzU0NDAzOTcyODQ2MzM1MTgwOC9Oa29SZEJCTF9iaWdnZXIucG5nIH1dYC4gV2hlbiBjcmVhdGluZyBhbiBldmVudCB0aGlzIHdpbGwgYXR0ZW1wdCB0byBjb252ZXJ0IHRoaXMgdXJsIGludG8gYSBibG9iIGlmIGl0IGlzIGFuIGltYWdlLCBvdGhlcndpc2UgaXQgd2lsbCBqdXN0IHBhc3MgdGhlIG9iamVjdCB0byB0aGUgdXBsb2FkIGFkYXB0ZXIuXG4qL1xuXG5cblNrb2xsLnByb3RvdHlwZS5wcmV2aWV3ID0gZnVuY3Rpb24oIHRhcmdldCApIHtcbiAgICBcbiAgICBpZiAoIHR5cGVvZiB0YXJnZXQuZmlsZXMgIT09ICdvYmplY3QnICkgeyAvLyBkZWZhdWx0IHVwbG9hZCBldmVudHMgYXJlIG5vdCBhIHRydWUgYXJyYXlcbiAgICAgICAgdGhpcy5lbWl0KCAnZXJyb3InLCBuZXcgRXJyb3IoICd0YXJnZXQgcGFzc2VkIHRvIFNrb2xsOjp1cGxvYWQgZG9lcyBub3QgaGF2ZSBmaWxlcyBhcnJheScgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIG9wZW4gPSB0aGlzLm9wZW4uYmluZCggdGhpcyApLFxuICAgICAgICBtZXRhID0gdGhpcy5tZXRhO1xuXG4gICAgdGhpcy5fY3JlYXRlRXZlbnQoIHRhcmdldCwgZnVuY3Rpb24oIGVyciwgdXBsb2FkRXZlbnQgKSB7XG4gICAgICAgIG1ldGEuZXZlbnQgPSB1cGxvYWRFdmVudDtcbiAgICAgICAgb3BlbiggeyBcbiAgICAgICAgICAgIG1ldGE6IG1ldGEsXG4gICAgICAgICAgICBwbHVnaW46ICdwcmV2aWV3JyBcbiAgICAgICAgfSApO1xuICAgIH0gKTtcblxufTtcblxuXG4vKlxuX19wYXJhbXNfX1xuXG4tIHRhcmdldCB7IE9iamVjdCB9IC0gVGhpcyBpcyBhIG9iamVjdCB0aGF0IHdpbGwgaGF2ZSB0aGUga2V5IEZpbGVzIGluIGl0LiBJdCBpcyBzb21ldGhpbmcgc2ltaWxpYXIgdG8gdGhlIGBldmVudC50YXJnZXRgIG9iamVjdCB5b3Ugd291bGQgZ2V0IG9uIGEgY2hhbmdlIGV2ZW50IG9mIGEgZmlsZSB0eXBlIGlucHV0LlxuICAgIC0gdGFyZ2V0LmZpbGVzIHsgQXJyYXkgfSAtIFRoaXMgY2FuIGJlIGEgYEJsb2JgIG9yIGFuIG9iamVjdCB3aXRoIHRoZSBrZXkgYHVybGAgaW5zaWRlIG9mIGl0LiBlZy4gYFt7IHVybDogaHR0cHM6Ly9wYnMudHdpbWcuY29tL3Byb2ZpbGVfaW1hZ2VzLzU0NDAzOTcyODQ2MzM1MTgwOC9Oa29SZEJCTF9iaWdnZXIucG5nIH1dYC4gV2hlbiBjcmVhdGluZyBhbiBldmVudCB0aGlzIHdpbGwgYXR0ZW1wdCB0byBjb252ZXJ0IHRoaXMgdXJsIGludG8gYSBibG9iIGlmIGl0IGlzIGFuIGltYWdlLCBvdGhlcndpc2UgaXQgd2lsbCBqdXN0IHBhc3MgdGhlIG9iamVjdCB0byB0aGUgdXBsb2FkIGFkYXB0ZXIuXG4qL1xuXG4vKlxuIyMjIFNrb2xsOjphZGRQbHVnaW5cblxuVGhpcyB3aWxsIGFkZCBhIHBsdWdpbiB0byB0aGUgbGlzdCBvZiBhdmFpbGFibGUgcGx1Z2lucy4gTWVhbmluZyB0aGF0IGl0IHdpbGwgYWxzbyBhZGQgdGhlIHBsdWdpbiBuYW1lIHRvIHRoZSBsaXN0IG9mIF90YWJhYmxlXyBwbHVnaW5zLCBhbmQgdGFyZ2V0cyB0byBvcGVuIHdoZW4gb3BlbmluZyB0aGUgYFNrb2xsYC5cblxuX19wYXJhbXNfX1xuXG4tIHBsdWdpbiB7IE9iamVjdCB9IC0gQSBgUGx1Z2luYCBvYmplY3QgdGhhdCBoYXMgYSBudW1iZXIgb2YgZGlmZmVybnQgYXR0cmlidXRlcyBvbiB0aGUgcGx1Z2luIHRvIGFsbG93IHRoZSBgU2tvbGxgIHRvIHJlYWQgYW5kIGludGVyYWN0IHdpdGggdGhlIHBsdWdpbi4gSWYgc29tZSByZXF1aXJlZCBtZXRob2RzIGFyZSBub3QgcHJvdmlkZWQgdGhlIHBsdWdpbiB3aWxsIG5vdCBiZSBhZGRlZCBhbmQgYW4gYGVycm9yYCBldmVudCB3aWxsIGJlIGVtaXR0ZWQgZnJvbSB0aGUgU2tvbGwuXG5cbi0gb3B0aW9ucyB7IE9iamVjdCB9IC0gX09wdGlvbmFsXyBBIG9wdGlvbmFsIG9iamVjdCB0aGF0IGNhbiBzcGVjaWZ5IHRoZSBiZWhhdmlvciBpbiB3aGljaCB0aGUgYFNrb2xsYCBiZWhhdmVzIHdpdGggcGx1Z2luLiBcbiAgLSBvcHRpb25zLm1lbnVJdGVtIHsgQm9vbGVhbiB9IC0gX09wdGlvbmFsXyBBIGZsYWcgdG8gc3BlY2lmeSBpZiB0aGUgcGx1Z2luIHNob3VsZCBiZSBsaW5rZWQgdG8gaW4gYSBsaXN0IG9mIHBsdWdpbnMuXG5cbl9fcmV0dXJuc19fXG5cbi0gcGx1Z2luIHsgT2JqZWN0IH0gLSBBIGNvcHkgb2YgdGhlIGBQbHVnaW5gIG9iamVjdCBiYWNrIHdpdGggdGhlIGBpc0FkZGVkYCBwcm9wZXJ0eSBzZXQgdG8gdHJ1ZSBpZiBzdWNjZXNzZnVsbCBhZGRlZCB0byB0aGUgYFNrb2xsYFxuXG5gYGBqYXZhc2NyaXB0XG52YXIgU2tvbGwgPSByZXF1aXJlKCAnZmlsZS11cGxvYWRlcicgKSxcbiAgICBmb28gPSB7XG4gICAgICAgIG9wZW46IGZ1bmN0aW9uKCl7fVxuICAgIH0sXG4gICAgYmFyID0ge1xuICAgICAgICBvcGVuOiBmdW5jdGlvbigpe30sXG4gICAgICAgIHRlYXJkb3duOiBmdW5jdGlvbigpe30sXG4gICAgICAgIGF0dHJpYnV0ZXM6IHtcbiAgICAgICAgICAgIG5hbWU6ICdCYXInXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHBsdWdpbkZvbyA9IFNrb2xsLmFkZFBsdWdpbiggZm9vICksXG4gICAgcGx1Z2luQmFyID0gU2tvbGwuYWRkUGx1Z2luKCBiYXIgKTtcblxucGx1Z2luRm9vLmlzQWRkZWQgLy8gZmFsc2UgLSBtaXNzaW5nIHNvbWUgcmVxdWlyZWQgbWV0aG9kc1xucGx1Z2luQmFyLmlzQWRkZWQgLy8gdHJ1ZVxuYGBgXG4qL1xuXG5Ta29sbC5wcm90b3R5cGUuYWRkUGx1Z2luID0gZnVuY3Rpb24oIHBsdWdpbiwgb3B0aW9ucyApIHtcbiAgICBcbiAgICB2YXIgX3BsdWdpbiA9IG1lcmdlKCB0cnVlLCB7fSwgcGx1Z2luIHx8IHt9ICk7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICBpZiAoICFTa29sbC5pc1BsdWdpbiggcGx1Z2luICkgKXtcbiAgICAgICAgX3BsdWdpbi5pc0FkZGVkID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBfcGx1Z2luO1xuICAgIH0gIFxuXG4gICAgdGhpcy5wbHVnaW5zWyBfcGx1Z2luLmF0dHJpYnV0ZXMubmFtZSBdID0gX3BsdWdpbjtcbiAgICBfcGx1Z2luLmlzQWRkZWQgPSB0cnVlO1xuICAgIHJldHVybiBfcGx1Z2luO1xuXG59O1xuXG4vKlxuIyMjIFNrb2xsOjp1c2VUb1VwbG9hZFxuXG5UaGlzIGlzIGEgd2F5IHRvIGV4dGVuZCB0aGUgZmlsZSB1cGxvYWRlciB0byBhbGxvdyBmb3IgY3VzdG9tIHdheXMgdG8gdXBsb2FkIGZpbGVzIHRvIHlvdXIgc2VydmVyLiBcblxuX19wYXJhbXNfX1xuXG4tIHVwbG9hZEZuIHsgRnVuY3Rpb24gfSAtIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIGV2ZXIgYW4gYXNzZXQgaXMgYXR0ZW1wdGVkIHRvIGJlIHVwbG9hZGVkLiBEdWUgdG8gdGhlIHBsdWdnYWJsaXR5IG9mIHRoaXMgbW9kYWwgdGhpcyBjYW4gYmUgYSBudW1iZXIgb2YgdGhpbmdzIGRlcGVuZGluZyBvbiB0aGUgbmF0dXJlIG9mIHRoZSBwbHVnaW4uIFRoaXMgY2FuIGFsc28gYmUgdXNlZCB0byBzYXZlIGluZm9ybWF0aW9uIHRvIHlvdSBkYXRhYmFzZSBhYm91dCB0aGUgZGF0YSBiZWluZyB1cGxvYWRlZC5cblxudXBsb2FkRm4gaXMgcGFzc2VkIGFuIFVwbG9hZEV2ZW50IG9iamVjdCB0aGF0IGhhcyBhIG51bWJlciBvZiBob29rcyB0aGF0IHlvdSBjYW4gdGllIHlvdXIgdXBsb2FkZXIgaW50byB0byBhbGxvdyBmb3IgYW4gaW50ZXJhY3RpdmUgZXhwZXJpZW5jZSB3aGlsZSB1cGxvYWRpbmcgcGhvdG9zLiBTZWUgYFVwbG9hZEV2ZW50YCBvYmplY3Qgc3BlY2lmaWNhdGlvbiB0byBzZWUgaG93IHRvIGhvb2sgaW50byB0aGlzIGZ1bmN0aW9uYWxpdHlcblxuYGBgamF2YXNjcmlwdFxudmFyIFNrb2xsID0gcmVxdWlyZSggJ2ZpbGUtdXBsb2FkZXInICk7XG5cblNrb2xsLnVzZVRvVXBsb2FkKCBmdW5jdGlvbiggPFVwbG9hZEV2ZW50PiApIHtcbiAgICB2YXIgZmlsZXMgPSBldmVudC5maWxlczsgLy8gdGhpcyBpcyBjb21taXRpbmcgZnJvbSBhIGlucHV0IGZpbGUgZXZlbnRcbiAgICAvLyBibGFoIGJsYWggdXBsb2FkXG4gICAgZmVlZGJhY2tGbnMuZG9uZSh7XG4gICAgICAgIGZpbGVzW3sgdXJsOiAnaHR0cDovL2Zvby5iYXIvYmF6LnBuZycgfV1cbiAgICB9KVxufSApO1xuYGBgXG4qL1xuXG5Ta29sbC5wcm90b3R5cGUudXNlVG9VcGxvYWQgPSBmdW5jdGlvbiggZm4gKSB7XG4gICAgaWYgKCB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIHRoaXMudXBsb2FkRm4gPSBmbjtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuZW1pdCggJ2Vycm9yJywgbmV3IEVycm9yKCAndXNlVG9VcGxvYWQgbmVlZHMgdG8gYmUgcGFzc2VkIGEgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IHBhcmFtZXRlciwgJyArIHR5cGVvZiBmbiArICcgZ2l2ZW4uJyApICk7XG59O1xuXG5cbi8vIHN0YXJ0IHByaXZhdGUgbWV0aG9kc1xuXG5Ta29sbC5wcm90b3R5cGUuX2NyZWF0ZUV2ZW50ID0gZnVuY3Rpb24oIHRhcmdldCwgY2FsbGJhY2sgKSB7IFxuXG4gICAgdmFyIF9ldmVudCA9IHt9LFxuICAgICAgICBlcnJvciA9IHRoaXMuZW1pdC5iaW5kKCB0aGlzLCAnZXJyb3InICk7XG5cbiAgICBfZXZlbnQuZmlsZXMgPSB0YXJnZXQuZmlsZXM7XG4gICAgX2V2ZW50Lm9yaWdpbmFsRXZlbnQgPSB0YXJnZXQ7XG5cbiAgICAvLyB3YXlzIHRvIGdpdmUgZmVlZGJhY2sgdG8gU2tvbGxcbiAgICBfZXZlbnQuZG9uZSA9IHRoaXMuZW1pdC5iaW5kKCB0aGlzLCAnZG9uZScgKTtcbiAgICBfZXZlbnQuZXJyb3IgPSBlcnJvcjtcblxuICAgIG5ldyBVcGxvYWRFdmVudCggX2V2ZW50LCBjYWxsYmFjayApO1xuXG59O1xuXG5Ta29sbC5pc1BsdWdpbiA9IGZ1bmN0aW9uKCBwbHVnaW4gKSB7XG5cbiAgICBpZiAoICFwbHVnaW4gfHwgdHlwZW9mIHBsdWdpbiAhPT0gJ29iamVjdCcgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBwbHVnaW4ub3BlbiAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgcGx1Z2luLnRlYXJkb3duICE9PSAnZnVuY3Rpb24nICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCAhcGx1Z2luLmF0dHJpYnV0ZXMgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIHR5cGVvZiBwbHVnaW4uYXR0cmlidXRlcy5uYW1lICE9PSAnc3RyaW5nJyApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuU2tvbGwucGx1Z2luVmlzaWJsZSA9IGZ1bmN0aW9uKCBwbHVnaW4gKSB7XG4gICAgcmV0dXJuICFwbHVnaW4uYXR0cmlidXRlcy5oaWRlO1xufTtcblxuU2tvbGwubWFwUGx1Z2lucyA9IGZ1bmN0aW9uKCBwbHVnaW5zICkge1xuICAgIHJldHVybiBmdW5jdGlvbiggcGx1Z2luTmFtZSApIHtcbiAgICAgICAgcmV0dXJuIHBsdWdpbnNbIHBsdWdpbk5hbWUgXTtcbiAgICB9XG59O1xuXG5Ta29sbC5wbHVnaW5MaXN0RWwgPSBmdW5jdGlvbiggY3VycmVudFBsdWdpbiApIHtcblxuICAgIHZhciBjdXJyZW50UGx1Z2luTmFtZSA9IGN1cnJlbnRQbHVnaW4uYXR0cmlidXRlcy5uYW1lOyBcblxuICAgIHJldHVybiBmdW5jdGlvbiggcGx1Z2luICkge1xuICAgICAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGknICksXG4gICAgICAgICAgICBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICksXG4gICAgICAgICAgICBuYW1lID0gcGx1Z2luLmF0dHJpYnV0ZXMubmFtZTtcblxuICAgICAgICAvLyBjb25zaWRlciBzb21lIHdheSB0byB1c2UgaWNvbnNcbiAgICAgICAgc3Bhbi5pbm5lclRleHQgPSBuYW1lO1xuICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLXBsdWdpbi1uYW1lJywgbmFtZSApO1xuICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnLCAnc2tvbGwucGx1Z2luLm9wZW4nICk7XG4gICAgICAgIGVsLmFwcGVuZENoaWxkKCBzcGFuICk7XG4gICAgICAgIGlmICggbmFtZSA9PT0gY3VycmVudFBsdWdpbk5hbWUgKSB7XG4gICAgICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLXBsdWdpbi1zZWxlY3RlZCcsIHRydWUgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbDsgICAgICAgIFxuICAgIH1cblxufTtcblxuU2tvbGwucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24oICkge1xuXG4gICAgLy8gdGhpcy5lbCBpcyBidWlsdCBpbiB0aGUgY29uc3RydWN0b3JcbiAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudC5iaW5kKCBkb2N1bWVudCwgJ2RpdicgKTsgXG5cbiAgICB0aGlzLnRhYmxlRWwgPSBkaXYoKTtcbiAgICB0aGlzLmNlbGxFbCA9IGRpdigpO1xuICAgIHRoaXMubW9kYWxFbCA9IGRpdigpO1xuICAgIHRoaXMuY29udGVudEVsID0gZGl2KCk7XG4gICAgdGhpcy5jbG9zZUVsID0gZGl2KCk7XG4gICAgdGhpcy5saXN0RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAndWwnICk7XG4gICAgLy8gY2xhc3Npbmcgc3RydWN0dXJlXG4gICAgdGhpcy5lbC5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtbW9kYWwtb3ZlcmxheScgKTtcbiAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcsICdza29sbC5jbG9zZScgKTtcbiAgICB0aGlzLnRhYmxlRWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsLXRhYmxlJyApOyAvLyB0aGlzIGlzIGhlcmUgdG8gYWxsb3cgdmVydGljYWwgY2VudGVyaW5nXG4gICAgdGhpcy5jZWxsRWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsLWNlbGwnICk7XG4gICAgdGhpcy5jbG9zZUVsLmNsYXNzTGlzdC5hZGQoICdza29sbC1tb2RhbC1jbG9zZScgKTtcbiAgICB0aGlzLmNsb3NlRWwuc2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0JywgJ3Nrb2xsLmNsb3NlJyApO1xuICAgIHRoaXMubW9kYWxFbC5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtbW9kYWwnICk7XG4gICAgdGhpcy5tb2RhbEVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcsICdza29sbC5tb2RhbC5zdG9wUHJvcGFnYXRpb24nICk7XG4gICAgdGhpcy5jb250ZW50RWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsLWNvbnRlbnQnICk7XG4gICAgdGhpcy5saXN0RWwuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLW1vZGFsLWxpc3QnICk7XG4gICAgLy8gYWRkaW5nIHRoZW0gYWxsIHRvZ2V0aGVyXG4gICAgdGhpcy5lbC5hcHBlbmRDaGlsZCggdGhpcy50YWJsZUVsICk7XG4gICAgdGhpcy50YWJsZUVsLmFwcGVuZENoaWxkKCB0aGlzLmNlbGxFbCApO1xuICAgIHRoaXMuY2VsbEVsLmFwcGVuZENoaWxkKCB0aGlzLm1vZGFsRWwgKTtcbiAgICB0aGlzLm1vZGFsRWwuYXBwZW5kQ2hpbGQoIHRoaXMubGlzdEVsICk7XG4gICAgdGhpcy5tb2RhbEVsLmFwcGVuZENoaWxkKCB0aGlzLmNsb3NlRWwgKTtcbiAgICB0aGlzLm1vZGFsRWwuYXBwZW5kQ2hpbGQoIHRoaXMuY29udGVudEVsICk7XG5cbiAgICAvKiBIVE1MIHJlcGVzZW50YXRpb25cbiAgICBcbiAgICA8ZGl2IGNsYXNzPVwic2tvbGwtbW9kYWwtb3ZlcmxheVwiID5cbiAgICAgICAgPGRpdiBjbGFzcz1cInNrb2xsLW1vZGFsLXRhYmxlXCIgPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNrb2xsLW1vZGFsLWNlbGxcIiA+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNrb2xsLW1vZGFsXCIgPlxuICAgICAgICAgICAgICAgICAgICA8dWwgY2xhc3M9XCJza29sbC1tb2RhbC1saXN0XCI+PC91bD5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNrb2xsLW1vZGFsLWNsb3NlXCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJza29sbC1tb2RhbC1jb250ZW50XCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgKi9cblxuICAgIC8vIGJpbmQgc29tZSBldmVudHMgdG8gZG9tXG4gICAgZW1pdC5vbiggJ3Nrb2xsLmNsb3NlJywgdGhpcy5jbG9zZS5iaW5kKCB0aGlzICkgKTtcbiAgICBlbWl0Lm9uKCAnc2tvbGwucGx1Z2luLm9wZW4nLCB0aGlzLl9vblBsdWdpbk9wZW4uYmluZCggdGhpcyApICk7XG5cbiAgICAvLyBhdHRhY2ggZGVmYXVsdCBwbHVnaW5cbiAgICB0aGlzLmFkZFBsdWdpbiggdXBsb2FkUGx1Z2luICk7XG4gICAgdGhpcy5hZGRQbHVnaW4oIHByZXZpZXdQbHVnaW4gKTtcblxufTtcblxuU2tvbGwucHJvdG90eXBlLl9vblBsdWdpbk9wZW4gPSBmdW5jdGlvbiggZSApIHtcbiAgICB2YXIgZWwgPSBlLmVtaXRUYXJnZXQ7XG4gICAgdGhpcy5vcGVuKCB7XG4gICAgICAgIG1ldGE6IHRoaXMubWV0YSwgXG4gICAgICAgIHBsdWdpbjogZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1wbHVnaW4tbmFtZScgKSBcbiAgICB9ICk7XG59O1xuXG5Ta29sbC5wcm90b3R5cGUuX2hhbmRsZVBsdWdpbk9wZW4gPSBmdW5jdGlvbiggb3B0aW9ucywgZXJyLCBlbCApIHtcblxuICAgIHZhciBkZWZhdWx0UGx1Z2luID0gdGhpcy5kZWZhdWx0cy5wbHVnaW4sXG4gICAgICAgIG9wZW5EZWZhdWx0ID0gdGhpcy5vcGVuLmJpbmQoIHRoaXMsIG1lcmdlKCBvcHRpb25zLCB7IFxuICAgICAgICAgICAgcGx1Z2luOiBkZWZhdWx0UGx1Z2luXG4gICAgICAgIH0gKSApO1xuXG4gICAgaWYgKCB0aGlzLnByZXZQbHVnaW4gKSB7XG4gICAgICAgIHRoaXMucHJldlBsdWdpbi50ZWFyZG93bigpO1xuICAgIH1cblxuICAgIGlmICggZXJyICkge1xuICAgICAgICB0aGlzLmVtaXQoICdlcnJvcicsIGVyciApO1xuICAgICAgICBpZiAoIG9wdGlvbnMucGx1Z2luICE9PSBkZWZhdWx0UGx1Z2luICkge1xuICAgICAgICAgICAgb3BlbkRlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgZWwgPT09ICdzdHJpbmcnICkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5pbm5lckhUTUwgPSBlbDtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIGVsID09PSAnb2JqZWN0JyAmJiBlbC50YWdOYW1lICkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgdGhpcy5jb250ZW50RWwuYXBwZW5kQ2hpbGQoIGVsICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvcGVuRGVmYXVsdCgpOyAvLyBqdXN0IHRyeSB0byBvcGVuIGRlZmF1bHQgd2hlbiBubyBjb250ZW50IGlzIGdpdmVuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBTa29sbCgpO1xubW9kdWxlLmV4cG9ydHMuU2tvbGwgPSBTa29sbDtcbm1vZHVsZS5leHBvcnRzLlVwbG9hZEV2ZW50ID0gVXBsb2FkRXZlbnQ7XG5tb2R1bGUuZXhwb3J0cy5pbWFnZVRvQmxvYiA9IHJlcXVpcmUoICdpbWFnZS10by1ibG9iJyApO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZlbnRFbWl0dGVyMiA9IHJlcXVpcmUoICdldmVudGVtaXR0ZXIyJyApLkV2ZW50RW1pdHRlcjI7XG5cbi8qXG4gICAgZGVwZW5kZW5jaWVzXG4qL1xuXG4vKiBiaW5kaW5nICovXG52YXIgYmluZGluZ01ldGhvZCA9IHdpbmRvdy5hZGRFdmVudExpc3RlbmVyID8gJ2FkZEV2ZW50TGlzdGVuZXInIDogJ2F0dGFjaEV2ZW50JztcbnZhciBldmVudFByZWZpeCA9IGJpbmRpbmdNZXRob2QgIT09ICdhZGRFdmVudExpc3RlbmVyJyA/ICdvbicgOiAnJztcblxuZnVuY3Rpb24gYmluZCggZWwsIHR5cGUsIGZuLCBjYXB0dXJlICkge1xuICAgIGVsWyBiaW5kaW5nTWV0aG9kIF0oIGV2ZW50UHJlZml4ICsgdHlwZSwgZm4sIGNhcHR1cmUgfHwgZmFsc2UgKTtcbiAgICByZXR1cm4gZm47XG59XG5cbi8qIG1hdGNoaW5nICovXG52YXIgdmVuZG9yTWF0Y2ggPSBFbGVtZW50LnByb3RvdHlwZS5tYXRjaGVzIHx8IEVsZW1lbnQucHJvdG90eXBlLndlYmtpdE1hdGNoZXNTZWxlY3RvciB8fCBFbGVtZW50LnByb3RvdHlwZS5tb3pNYXRjaGVzU2VsZWN0b3IgfHwgRWxlbWVudC5wcm90b3R5cGUubXNNYXRjaGVzU2VsZWN0b3IgfHwgRWxlbWVudC5wcm90b3R5cGUub01hdGNoZXNTZWxlY3RvcjtcblxuZnVuY3Rpb24gbWF0Y2hlcyggZWwsIHNlbGVjdG9yICkge1xuICAgIGlmICggIWVsIHx8IGVsLm5vZGVUeXBlICE9PSAxICkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICggdmVuZG9yTWF0Y2ggKSB7XG4gICAgICAgIHJldHVybiB2ZW5kb3JNYXRjaC5jYWxsKCBlbCwgc2VsZWN0b3IgKTtcbiAgICB9XG4gICAgdmFyIG5vZGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IsIGVsLnBhcmVudE5vZGUgKTtcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgaWYgKCBub2Rlc1sgaSBdID09IGVsICkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7ICBcbiAgICAgICAgfSBcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKiBjbG9zZXN0ICovXG5cbmZ1bmN0aW9uIGNsb3Nlc3QoIGVsZW1lbnQsIHNlbGVjdG9yLCBjaGVja1NlbGYsIHJvb3QgKSB7XG4gICAgZWxlbWVudCA9IGNoZWNrU2VsZiA/IHtwYXJlbnROb2RlOiBlbGVtZW50fSA6IGVsZW1lbnQ7XG5cbiAgICByb290ID0gcm9vdCB8fCBkb2N1bWVudDtcblxuICAgIC8qIE1ha2Ugc3VyZSBgZWxlbWVudCAhPT0gZG9jdW1lbnRgIGFuZCBgZWxlbWVudCAhPSBudWxsYFxuICAgICAgIG90aGVyd2lzZSB3ZSBnZXQgYW4gaWxsZWdhbCBpbnZvY2F0aW9uICovXG4gICAgd2hpbGUgKCAoIGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudE5vZGUgKSAmJiBlbGVtZW50ICE9PSBkb2N1bWVudCApIHtcbiAgICAgICAgaWYgKCBtYXRjaGVzKCBlbGVtZW50LCBzZWxlY3RvciApICkge1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBBZnRlciBgbWF0Y2hlc2Agb24gdGhlIGVkZ2UgY2FzZSB0aGF0XG4gICAgICAgICAgIHRoZSBzZWxlY3RvciBtYXRjaGVzIHRoZSByb290XG4gICAgICAgICAgICh3aGVuIHRoZSByb290IGlzIG5vdCB0aGUgZG9jdW1lbnQpICovXG4gICAgICAgIGlmIChlbGVtZW50ID09PSByb290KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qXG4gICAgZW5kIGRlcGVuZGVuY2llc1xuKi9cblxuZnVuY3Rpb24gRW1pdCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgRXZlbnRFbWl0dGVyMi5jYWxsKCBzZWxmICk7XG5cbiAgICBzZWxmLnZhbGlkYXRvcnMgPSBbXTtcbiAgICBzZWxmLnRvdWNoTW92ZURlbHRhID0gMTA7XG4gICAgc2VsZi5pbml0aWFsVG91Y2hQb2ludCA9IG51bGw7XG5cbiAgICBiaW5kKCBkb2N1bWVudCwgJ3RvdWNoc3RhcnQnLCBzZWxmLmhhbmRsZUV2ZW50LmJpbmQoIHNlbGYgKSApO1xuICAgIGJpbmQoIGRvY3VtZW50LCAndG91Y2htb3ZlJywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ3RvdWNoZW5kJywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ2NsaWNrJywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ2lucHV0Jywgc2VsZi5oYW5kbGVFdmVudC5iaW5kKCBzZWxmICkgKTtcbiAgICBiaW5kKCBkb2N1bWVudCwgJ3N1Ym1pdCcsIHNlbGYuaGFuZGxlRXZlbnQuYmluZCggc2VsZiApICk7XG59XG5cbkVtaXQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggRXZlbnRFbWl0dGVyMi5wcm90b3R5cGUgKTtcblxuZnVuY3Rpb24gdCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cbmZ1bmN0aW9uIGYoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBnZXRUb3VjaERlbHRhKCBldmVudCwgaW5pdGlhbCApIHtcbiAgICB2YXIgZGVsdGFYID0gKCBldmVudC50b3VjaGVzWyAwIF0ucGFnZVggLSBpbml0aWFsLnggKTtcbiAgICB2YXIgZGVsdGFZID0gKCBldmVudC50b3VjaGVzWyAwIF0ucGFnZVkgLSBpbml0aWFsLnkgKTtcbiAgICByZXR1cm4gTWF0aC5zcXJ0KCAoIGRlbHRhWCAqIGRlbHRhWCApICsgKCBkZWx0YVkgKiBkZWx0YVkgKSApO1xufVxuXG5FbWl0LnByb3RvdHlwZS5oYW5kbGVFdmVudCA9IGZ1bmN0aW9uKCBldmVudCApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoIHR5cGVvZiggZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQgKSA9PSAndW5kZWZpbmVkJyApIHtcbiAgICAgICAgZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQgPSBmO1xuICAgIH1cblxuICAgIHZhciB0b3VjaGVzID0gZXZlbnQudG91Y2hlcztcbiAgICB2YXIgZGVsdGEgPSAtMTtcbiAgICBzd2l0Y2ggKCBldmVudC50eXBlICkge1xuICAgICAgICBjYXNlICd0b3VjaHN0YXJ0JzpcbiAgICAgICAgICAgIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgPSBzZWxmLmxhc3RUb3VjaFBvaW50ID0ge1xuICAgICAgICAgICAgICAgIHg6IHRvdWNoZXMgJiYgdG91Y2hlcy5sZW5ndGggPyB0b3VjaGVzWyAwIF0ucGFnZVggOiAwLFxuICAgICAgICAgICAgICAgIHk6IHRvdWNoZXMgJiYgdG91Y2hlcy5sZW5ndGggPyB0b3VjaGVzWyAwIF0ucGFnZVkgOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd0b3VjaG1vdmUnOlxuICAgICAgICAgICAgaWYgKCB0b3VjaGVzICYmIHRvdWNoZXMubGVuZ3RoICYmIHNlbGYuaW5pdGlhbFRvdWNoUG9pbnQgKSB7XG4gICAgICAgICAgICAgICAgZGVsdGEgPSBnZXRUb3VjaERlbHRhKCBldmVudCwgc2VsZi5pbml0aWFsVG91Y2hQb2ludCApO1xuICAgICAgICAgICAgICAgIGlmICggZGVsdGEgPiBzZWxmLnRvdWNoTW92ZURlbHRhICkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmluaXRpYWxUb3VjaFBvaW50ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWxmLmxhc3RUb3VjaFBvaW50ID0ge1xuICAgICAgICAgICAgICAgICAgICB4OiB0b3VjaGVzWyAwIF0ucGFnZVgsXG4gICAgICAgICAgICAgICAgICAgIHk6IHRvdWNoZXNbIDAgXS5wYWdlWVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2NsaWNrJzpcbiAgICAgICAgY2FzZSAndG91Y2hlbmQnOlxuICAgICAgICBjYXNlICdpbnB1dCc6XG4gICAgICAgIGNhc2UgJ3N1Ym1pdCc6XG4gICAgICAgICAgICAvLyBlYXQgYW55IGxhdGUtZmlyaW5nIGNsaWNrIGV2ZW50cyBvbiB0b3VjaCBkZXZpY2VzXG4gICAgICAgICAgICBpZiAoIGV2ZW50LnR5cGUgPT09ICdjbGljaycgJiYgc2VsZi5sYXN0VG91Y2hQb2ludCApIHtcbiAgICAgICAgICAgICAgICBpZiAoIGV2ZW50LnRvdWNoZXMgJiYgZXZlbnQudG91Y2hlcy5sZW5ndGggKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbHRhID0gZ2V0VG91Y2hEZWx0YSggZXZlbnQsIHNlbGYubGFzdFRvdWNoUG9pbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBkZWx0YSA8IHNlbGYudG91Y2hNb3ZlRGVsdGEgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBjYW5jZWxpbmcgdG91Y2hlcyB0aGF0IGhhdmUgbW92ZWQgdG9vIG11Y2hcbiAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSA9PT0gJ3RvdWNoZW5kJyAmJiAhc2VsZi5pbml0aWFsVG91Y2hQb2ludCApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzZWxlY3RvciA9ICdbZGF0YS1lbWl0XSc7XG4gICAgICAgICAgICB2YXIgb3JpZ2luYWxFbGVtZW50ID0gZXZlbnQudGFyZ2V0IHx8IGV2ZW50LnNyY0VsZW1lbnQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIGlmIGl0J3MgYSBsaW5rIGFuZCBpdCBoYXMgbm8gZW1pdCBhdHRyaWJ1dGUsIGFsbG93IHRoZSBldmVudCB0byBwYXNzXG4gICAgICAgICAgICBpZiAoICFvcmlnaW5hbEVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0JyApICYmICggb3JpZ2luYWxFbGVtZW50LnRhZ05hbWUgPT09ICdBJyB8fCBvcmlnaW5hbEVsZW1lbnQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgb3JpZ2luYWxFbGVtZW50LnRhZ05hbWUgPT09ICdJTlBVVCcgKSApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBmb3JjZUFsbG93RGVmYXVsdCA9IG9yaWdpbmFsRWxlbWVudC50YWdOYW1lID09ICdJTlBVVCcgJiYgKCBvcmlnaW5hbEVsZW1lbnQudHlwZSA9PSAnY2hlY2tib3gnIHx8IG9yaWdpbmFsRWxlbWVudC50eXBlID09ICdyYWRpbycgKTtcbiAgICAgICAgICAgIHZhciBlbCA9IGNsb3Nlc3QoIG9yaWdpbmFsRWxlbWVudCwgc2VsZWN0b3IsIHRydWUsIGRvY3VtZW50ICk7XG5cbiAgICAgICAgICAgIGlmICggZWwgKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlcHRoID0gLTE7XG4gICAgICAgICAgICAgICAgd2hpbGUgKCBlbCAmJiAhZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQoKSAmJiArK2RlcHRoIDwgMTAwICkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdmFsaWRhdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICggdmFyIHZhbGlkYXRvckluZGV4ID0gMDsgdmFsaWRhdG9ySW5kZXggPCBzZWxmLnZhbGlkYXRvcnMubGVuZ3RoOyArK3ZhbGlkYXRvckluZGV4ICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhc2VsZi52YWxpZGF0b3JzWyB2YWxpZGF0b3JJbmRleCBdLmNhbGwoIHRoaXMsIGVsLCBldmVudCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZWF0IHRoZSBldmVudCBpZiBhIHZhbGlkYXRvciBmYWlsZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAhdmFsaWRhdGVkICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiggZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQgKSAhPSAnZnVuY3Rpb24nIHx8ICFldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCgpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LmlzUHJvcGFnYXRpb25TdG9wcGVkID0gdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgZWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiggc2VsZi52YWxpZGF0ZSApID09ICdmdW5jdGlvbicgJiYgIXNlbGYudmFsaWRhdGUuY2FsbCggc2VsZiwgZWwgKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCBlbC50YWdOYW1lID09ICdGT1JNJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSAhPSAnc3VibWl0JyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoIGVsLnRhZ05hbWUgPT0gJ0lOUFVUJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggISggZWwudHlwZSA9PSAnc3VibWl0JyB8fCBlbC50eXBlID09ICdjaGVja2JveCcgfHwgZWwudHlwZSA9PSAncmFkaW8nIHx8IGVsLnR5cGUgPT0gJ2ZpbGUnICkgJiYgZXZlbnQudHlwZSAhPSAnaW5wdXQnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICggZWwudGFnTmFtZSA9PSAnU0VMRUNUJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSAhPSAnaW5wdXQnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gY2xvc2VzdCggZWwsIHNlbGVjdG9yLCBmYWxzZSwgZG9jdW1lbnQgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LmVtaXRUYXJnZXQgPSBlbDtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fZW1pdCggZWwsIGV2ZW50LCBmb3JjZUFsbG93RGVmYXVsdCApO1xuICAgICAgICAgICAgICAgICAgICBlbCA9IGNsb3Nlc3QoIGVsLCBzZWxlY3RvciwgZmFsc2UsIGRvY3VtZW50ICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCBkZXB0aCA+PSAxMDAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciggJ0V4Y2VlZGVkIGRlcHRoIGxpbWl0IGZvciBFbWl0IGNhbGxzLicgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLmVtaXQoICd1bmhhbmRsZWQnLCBldmVudCApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLmluaXRpYWxUb3VjaFBvaW50ID0gbnVsbDtcblxuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuRW1pdC5wcm90b3R5cGUuX2VtaXQgPSBmdW5jdGlvbiggZWxlbWVudCwgZXZlbnQsIGZvcmNlRGVmYXVsdCApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG9wdGlvblN0cmluZyA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0LW9wdGlvbnMnICk7XG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgICB2YXIgaWdub3JlU3RyaW5nID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQtaWdub3JlJyApO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKCBpZ25vcmVTdHJpbmcgJiYgaWdub3JlU3RyaW5nLmxlbmd0aCApIHtcbiAgICAgICAgdmFyIGlnbm9yZWRFdmVudHMgPSBpZ25vcmVTdHJpbmcudG9Mb3dlckNhc2UoKS5zcGxpdCggJyAnICk7XG4gICAgICAgIGZvciAoIGkgPSAwOyBpIDwgaWdub3JlZEV2ZW50cy5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgICAgIGlmICggZXZlbnQudHlwZSA9PSBpZ25vcmVkRXZlbnRzWyBpIF0gKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCBvcHRpb25TdHJpbmcgJiYgb3B0aW9uU3RyaW5nLmxlbmd0aCApIHtcbiAgICAgICAgdmFyIG9wdHMgPSBvcHRpb25TdHJpbmcudG9Mb3dlckNhc2UoKS5zcGxpdCggJyAnICk7XG4gICAgICAgIGZvciAoIGkgPSAwOyBpIDwgb3B0cy5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgICAgIG9wdGlvbnNbIG9wdHNbIGkgXSBdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICggIWZvcmNlRGVmYXVsdCAmJiAhb3B0aW9ucy5hbGxvd2RlZmF1bHQgKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuXG4gICAgaWYgKCAhb3B0aW9ucy5hbGxvd3Byb3BhZ2F0ZSApIHtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgICBpZiAoIHR5cGVvZiggZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQgKSAhPSAnZnVuY3Rpb24nIHx8ICFldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCgpICkge1xuICAgICAgICAgICAgZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQgPSB0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGVtaXNzaW9uTGlzdCA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbWl0JyApO1xuICAgIGlmICggIWVtaXNzaW9uTGlzdCApIHtcbiAgICAgICAgLy8gYWxsb3cgZm9yIGVtcHR5IGJlaGF2aW9ycyB0aGF0IGNhdGNoIGV2ZW50c1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGVtaXNzaW9ucyA9IGVtaXNzaW9uTGlzdC5zcGxpdCggJywnICk7XG4gICAgaWYgKCBvcHRpb25zLmRlYm91bmNlICkge1xuICAgICAgICBzZWxmLnRpbWVvdXRzID0gc2VsZi50aW1lb3V0cyB8fCB7fTtcbiAgICAgICAgaWYgKCBzZWxmLnRpbWVvdXRzWyBlbGVtZW50IF0gKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoIHNlbGYudGltZW91dHNbIGVsZW1lbnQgXSApO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgX2VsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgICAgICAgdmFyIF9lbWlzc2lvbnMgPSBlbWlzc2lvbnM7XG4gICAgICAgICAgICB2YXIgX2V2ZW50ID0gZXZlbnQ7XG4gICAgICAgICAgICBzZWxmLnRpbWVvdXRzWyBlbGVtZW50IF0gPSBzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBfZW1pc3Npb25zLmZvckVhY2goIGZ1bmN0aW9uKCBlbWlzc2lvbiApIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5lbWl0KCBlbWlzc2lvbiwgX2V2ZW50ICk7XG4gICAgICAgICAgICAgICAgfSApO1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCggc2VsZi50aW1lb3V0c1sgX2VsZW1lbnQgXSApO1xuICAgICAgICAgICAgICAgIHNlbGYudGltZW91dHNbIF9lbGVtZW50IF0gPSBudWxsO1xuICAgICAgICAgICAgfSwgMjUwICk7XG4gICAgICAgIH0gKSgpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgZW1pc3Npb25zLmZvckVhY2goIGZ1bmN0aW9uKCBlbWlzc2lvbiApIHtcbiAgICAgICAgc2VsZi5lbWl0KCBlbWlzc2lvbiwgZXZlbnQgKTtcbiAgICB9ICk7XG59O1xuXG5FbWl0LnByb3RvdHlwZS5hZGRWYWxpZGF0b3IgPSBmdW5jdGlvbiggdmFsaWRhdG9yICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBmb3VuZCA9IGZhbHNlO1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHNlbGYudmFsaWRhdG9ycy5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgaWYgKCBzZWxmLnZhbGlkYXRvcnNbIGkgXSA9PSB2YWxpZGF0b3IgKSB7XG4gICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICggZm91bmQgKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBzZWxmLnZhbGlkYXRvcnMucHVzaCggdmFsaWRhdG9yICk7XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5FbWl0LnByb3RvdHlwZS5yZW1vdmVWYWxpZGF0b3IgPSBmdW5jdGlvbiggdmFsaWRhdG9yICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBmb3VuZCA9IGZhbHNlO1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHNlbGYudmFsaWRhdG9ycy5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgaWYgKCBzZWxmLnZhbGlkYXRvcnNbIGkgXSA9PSB2YWxpZGF0b3IgKSB7XG4gICAgICAgICAgICBzZWxmLnZhbGlkYXRvcnMuc3BsaWNlKCBpLCAxICk7XG4gICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmb3VuZDtcbn07XG5cbkVtaXQuc2luZ2xldG9uID0gRW1pdC5zaW5nbGV0b24gfHwgbmV3IEVtaXQoKTtcbkVtaXQuc2luZ2xldG9uLkVtaXQgPSBFbWl0O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVtaXQuc2luZ2xldG9uOyIsIi8qIVxuICogRXZlbnRFbWl0dGVyMlxuICogaHR0cHM6Ly9naXRodWIuY29tL2hpajFueC9FdmVudEVtaXR0ZXIyXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIGhpajFueFxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICovXG47IWZ1bmN0aW9uKHVuZGVmaW5lZCkge1xuXG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSA/IEFycmF5LmlzQXJyYXkgOiBmdW5jdGlvbiBfaXNBcnJheShvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcbiAgfTtcbiAgdmFyIGRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuICBmdW5jdGlvbiBpbml0KCkge1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGlmICh0aGlzLl9jb25mKSB7XG4gICAgICBjb25maWd1cmUuY2FsbCh0aGlzLCB0aGlzLl9jb25mKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjb25maWd1cmUoY29uZikge1xuICAgIGlmIChjb25mKSB7XG5cbiAgICAgIHRoaXMuX2NvbmYgPSBjb25mO1xuXG4gICAgICBjb25mLmRlbGltaXRlciAmJiAodGhpcy5kZWxpbWl0ZXIgPSBjb25mLmRlbGltaXRlcik7XG4gICAgICBjb25mLm1heExpc3RlbmVycyAmJiAodGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IGNvbmYubWF4TGlzdGVuZXJzKTtcbiAgICAgIGNvbmYud2lsZGNhcmQgJiYgKHRoaXMud2lsZGNhcmQgPSBjb25mLndpbGRjYXJkKTtcbiAgICAgIGNvbmYubmV3TGlzdGVuZXIgJiYgKHRoaXMubmV3TGlzdGVuZXIgPSBjb25mLm5ld0xpc3RlbmVyKTtcblxuICAgICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lclRyZWUgPSB7fTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBFdmVudEVtaXR0ZXIoY29uZikge1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHRoaXMubmV3TGlzdGVuZXIgPSBmYWxzZTtcbiAgICBjb25maWd1cmUuY2FsbCh0aGlzLCBjb25mKTtcbiAgfVxuXG4gIC8vXG4gIC8vIEF0dGVudGlvbiwgZnVuY3Rpb24gcmV0dXJuIHR5cGUgbm93IGlzIGFycmF5LCBhbHdheXMgIVxuICAvLyBJdCBoYXMgemVybyBlbGVtZW50cyBpZiBubyBhbnkgbWF0Y2hlcyBmb3VuZCBhbmQgb25lIG9yIG1vcmVcbiAgLy8gZWxlbWVudHMgKGxlYWZzKSBpZiB0aGVyZSBhcmUgbWF0Y2hlc1xuICAvL1xuICBmdW5jdGlvbiBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIGkpIHtcbiAgICBpZiAoIXRyZWUpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgdmFyIGxpc3RlbmVycz1bXSwgbGVhZiwgbGVuLCBicmFuY2gsIHhUcmVlLCB4eFRyZWUsIGlzb2xhdGVkQnJhbmNoLCBlbmRSZWFjaGVkLFxuICAgICAgICB0eXBlTGVuZ3RoID0gdHlwZS5sZW5ndGgsIGN1cnJlbnRUeXBlID0gdHlwZVtpXSwgbmV4dFR5cGUgPSB0eXBlW2krMV07XG4gICAgaWYgKGkgPT09IHR5cGVMZW5ndGggJiYgdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgYXQgdGhlIGVuZCBvZiB0aGUgZXZlbnQocykgbGlzdCBhbmQgdGhlIHRyZWUgaGFzIGxpc3RlbmVyc1xuICAgICAgLy8gaW52b2tlIHRob3NlIGxpc3RlbmVycy5cbiAgICAgIC8vXG4gICAgICBpZiAodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBbdHJlZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxlYWYgPSAwLCBsZW4gPSB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoOyBsZWFmIDwgbGVuOyBsZWFmKyspIHtcbiAgICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVyc1tsZWFmXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGN1cnJlbnRUeXBlID09PSAnKicgfHwgY3VycmVudFR5cGUgPT09ICcqKicpIHx8IHRyZWVbY3VycmVudFR5cGVdKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgdGhlIGV2ZW50IGVtaXR0ZWQgaXMgJyonIGF0IHRoaXMgcGFydFxuICAgICAgLy8gb3IgdGhlcmUgaXMgYSBjb25jcmV0ZSBtYXRjaCBhdCB0aGlzIHBhdGNoXG4gICAgICAvL1xuICAgICAgaWYgKGN1cnJlbnRUeXBlID09PSAnKicpIHtcbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xuICAgICAgfSBlbHNlIGlmKGN1cnJlbnRUeXBlID09PSAnKionKSB7XG4gICAgICAgIGVuZFJlYWNoZWQgPSAoaSsxID09PSB0eXBlTGVuZ3RoIHx8IChpKzIgPT09IHR5cGVMZW5ndGggJiYgbmV4dFR5cGUgPT09ICcqJykpO1xuICAgICAgICBpZihlbmRSZWFjaGVkICYmIHRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIC8vIFRoZSBuZXh0IGVsZW1lbnQgaGFzIGEgX2xpc3RlbmVycywgYWRkIGl0IHRvIHRoZSBoYW5kbGVycy5cbiAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgdHlwZUxlbmd0aCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gJyonIHx8IGJyYW5jaCA9PT0gJyoqJykge1xuICAgICAgICAgICAgICBpZih0cmVlW2JyYW5jaF0uX2xpc3RlbmVycyAmJiAhZW5kUmVhY2hlZCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIHR5cGVMZW5ndGgpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzIpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIE5vIG1hdGNoIG9uIHRoaXMgb25lLCBzaGlmdCBpbnRvIHRoZSB0cmVlIGJ1dCBub3QgaW4gdGhlIHR5cGUgYXJyYXkuXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcbiAgICAgIH1cblxuICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbY3VycmVudFR5cGVdLCBpKzEpKTtcbiAgICB9XG5cbiAgICB4VHJlZSA9IHRyZWVbJyonXTtcbiAgICBpZiAoeFRyZWUpIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiB0aGUgbGlzdGVuZXIgdHJlZSB3aWxsIGFsbG93IGFueSBtYXRjaCBmb3IgdGhpcyBwYXJ0LFxuICAgICAgLy8gdGhlbiByZWN1cnNpdmVseSBleHBsb3JlIGFsbCBicmFuY2hlcyBvZiB0aGUgdHJlZVxuICAgICAgLy9cbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeFRyZWUsIGkrMSk7XG4gICAgfVxuXG4gICAgeHhUcmVlID0gdHJlZVsnKionXTtcbiAgICBpZih4eFRyZWUpIHtcbiAgICAgIGlmKGkgPCB0eXBlTGVuZ3RoKSB7XG4gICAgICAgIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIGxpc3RlbmVyIG9uIGEgJyoqJywgaXQgd2lsbCBjYXRjaCBhbGwsIHNvIGFkZCBpdHMgaGFuZGxlci5cbiAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCdWlsZCBhcnJheXMgb2YgbWF0Y2hpbmcgbmV4dCBicmFuY2hlcyBhbmQgb3RoZXJzLlxuICAgICAgICBmb3IoYnJhbmNoIGluIHh4VHJlZSkge1xuICAgICAgICAgIGlmKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHh4VHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XG4gICAgICAgICAgICAgIC8vIFdlIGtub3cgdGhlIG5leHQgZWxlbWVudCB3aWxsIG1hdGNoLCBzbyBqdW1wIHR3aWNlLlxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gY3VycmVudFR5cGUpIHtcbiAgICAgICAgICAgICAgLy8gQ3VycmVudCBub2RlIG1hdGNoZXMsIG1vdmUgaW50byB0aGUgdHJlZS5cbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsxKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoID0ge307XG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoW2JyYW5jaF0gPSB4eFRyZWVbYnJhbmNoXTtcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB7ICcqKic6IGlzb2xhdGVkQnJhbmNoIH0sIGkrMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgLy8gV2UgaGF2ZSByZWFjaGVkIHRoZSBlbmQgYW5kIHN0aWxsIG9uIGEgJyoqJ1xuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XG4gICAgICB9IGVsc2UgaWYoeHhUcmVlWycqJ10gJiYgeHhUcmVlWycqJ10uX2xpc3RlbmVycykge1xuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVsnKiddLCB0eXBlTGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlzdGVuZXJzO1xuICB9XG5cbiAgZnVuY3Rpb24gZ3Jvd0xpc3RlbmVyVHJlZSh0eXBlLCBsaXN0ZW5lcikge1xuXG4gICAgdHlwZSA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuXG4gICAgLy9cbiAgICAvLyBMb29rcyBmb3IgdHdvIGNvbnNlY3V0aXZlICcqKicsIGlmIHNvLCBkb24ndCBhZGQgdGhlIGV2ZW50IGF0IGFsbC5cbiAgICAvL1xuICAgIGZvcih2YXIgaSA9IDAsIGxlbiA9IHR5cGUubGVuZ3RoOyBpKzEgPCBsZW47IGkrKykge1xuICAgICAgaWYodHlwZVtpXSA9PT0gJyoqJyAmJiB0eXBlW2krMV0gPT09ICcqKicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB0cmVlID0gdGhpcy5saXN0ZW5lclRyZWU7XG4gICAgdmFyIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XG5cbiAgICB3aGlsZSAobmFtZSkge1xuXG4gICAgICBpZiAoIXRyZWVbbmFtZV0pIHtcbiAgICAgICAgdHJlZVtuYW1lXSA9IHt9O1xuICAgICAgfVxuXG4gICAgICB0cmVlID0gdHJlZVtuYW1lXTtcblxuICAgICAgaWYgKHR5cGUubGVuZ3RoID09PSAwKSB7XG5cbiAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBsaXN0ZW5lcjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBbdHJlZS5fbGlzdGVuZXJzLCBsaXN0ZW5lcl07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXNBcnJheSh0cmVlLl9saXN0ZW5lcnMpKSB7XG5cbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG5cbiAgICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycy53YXJuZWQpIHtcblxuICAgICAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobSA+IDAgJiYgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCA+IG0pIHtcblxuICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMud2FybmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBuYW1lID0gdHlwZS5zaGlmdCgpO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW5cbiAgLy8gMTAgbGlzdGVuZXJzIGFyZSBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoXG4gIC8vIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuICAvL1xuICAvLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3NcbiAgLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5kZWxpbWl0ZXIgPSAnLic7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gbjtcbiAgICBpZiAoIXRoaXMuX2NvbmYpIHRoaXMuX2NvbmYgPSB7fTtcbiAgICB0aGlzLl9jb25mLm1heExpc3RlbmVycyA9IG47XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5ldmVudCA9ICcnO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBmbikge1xuICAgIHRoaXMubWFueShldmVudCwgMSwgZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubWFueSA9IGZ1bmN0aW9uKGV2ZW50LCB0dGwsIGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaXN0ZW5lcigpIHtcbiAgICAgIGlmICgtLXR0bCA9PT0gMCkge1xuICAgICAgICBzZWxmLm9mZihldmVudCwgbGlzdGVuZXIpO1xuICAgICAgfVxuICAgICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBsaXN0ZW5lci5fb3JpZ2luID0gZm47XG5cbiAgICB0aGlzLm9uKGV2ZW50LCBsaXN0ZW5lcik7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbigpIHtcblxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICB2YXIgdHlwZSA9IGFyZ3VtZW50c1swXTtcblxuICAgIGlmICh0eXBlID09PSAnbmV3TGlzdGVuZXInICYmICF0aGlzLm5ld0xpc3RlbmVyKSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcikgeyByZXR1cm4gZmFsc2U7IH1cbiAgICB9XG5cbiAgICAvLyBMb29wIHRocm91Z2ggdGhlICpfYWxsKiBmdW5jdGlvbnMgYW5kIGludm9rZSB0aGVtLlxuICAgIGlmICh0aGlzLl9hbGwpIHtcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoaSA9IDAsIGwgPSB0aGlzLl9hbGwubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgICB0aGlzLl9hbGxbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICAgIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG5cbiAgICAgIGlmICghdGhpcy5fYWxsICYmXG4gICAgICAgICF0aGlzLl9ldmVudHMuZXJyb3IgJiZcbiAgICAgICAgISh0aGlzLndpbGRjYXJkICYmIHRoaXMubGlzdGVuZXJUcmVlLmVycm9yKSkge1xuXG4gICAgICAgIGlmIChhcmd1bWVudHNbMV0gaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIHRocm93IGFyZ3VtZW50c1sxXTsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmNhdWdodCwgdW5zcGVjaWZpZWQgJ2Vycm9yJyBldmVudC5cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBoYW5kbGVyO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgaGFuZGxlciA9IFtdO1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVyLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKVxuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBzbG93ZXJcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKGhhbmRsZXIpIHtcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgICAgdmFyIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChsaXN0ZW5lcnMubGVuZ3RoID4gMCkgfHwgISF0aGlzLl9hbGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuICEhdGhpcy5fYWxsO1xuICAgIH1cblxuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuXG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLm9uQW55KHR5cGUpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbiBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09IFwibmV3TGlzdGVuZXJzXCIhIEJlZm9yZVxuICAgIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJzXCIuXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIGdyb3dMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCB0eXBlLCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkge1xuICAgICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgICB9XG4gICAgZWxzZSBpZih0eXBlb2YgdGhpcy5fZXZlbnRzW3R5cGVdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XG4gICAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG5cbiAgICAgIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcblxuICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG5cbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbkFueSA9IGZ1bmN0aW9uKGZuKSB7XG5cbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uQW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBpZighdGhpcy5fYWxsKSB7XG4gICAgICB0aGlzLl9hbGwgPSBbXTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGZ1bmN0aW9uIHRvIHRoZSBldmVudCBsaXN0ZW5lciBjb2xsZWN0aW9uLlxuICAgIHRoaXMuX2FsbC5wdXNoKGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbjtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZW1vdmVMaXN0ZW5lciBvbmx5IHRha2VzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVycyxsZWFmcz1bXTtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIGRvZXMgbm90IHVzZSBsaXN0ZW5lcnMoKSwgc28gbm8gc2lkZSBlZmZlY3Qgb2YgY3JlYXRpbmcgX2V2ZW50c1t0eXBlXVxuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xuICAgICAgaGFuZGxlcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICBsZWFmcy5wdXNoKHtfbGlzdGVuZXJzOmhhbmRsZXJzfSk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XG4gICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcbiAgICAgIGhhbmRsZXJzID0gbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgaWYgKGlzQXJyYXkoaGFuZGxlcnMpKSB7XG5cbiAgICAgICAgdmFyIHBvc2l0aW9uID0gLTE7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGhhbmRsZXJzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKGhhbmRsZXJzW2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLmxpc3RlbmVyICYmIGhhbmRsZXJzW2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5fb3JpZ2luICYmIGhhbmRsZXJzW2ldLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xuICAgICAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvc2l0aW9uIDwgMCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgIGxlYWYuX2xpc3RlbmVycy5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhbmRsZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChoYW5kbGVycyA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgKGhhbmRsZXJzLmxpc3RlbmVyICYmIGhhbmRsZXJzLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcbiAgICAgICAgKGhhbmRsZXJzLl9vcmlnaW4gJiYgaGFuZGxlcnMuX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZkFueSA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgdmFyIGkgPSAwLCBsID0gMCwgZm5zO1xuICAgIGlmIChmbiAmJiB0aGlzLl9hbGwgJiYgdGhpcy5fYWxsLmxlbmd0aCA+IDApIHtcbiAgICAgIGZucyA9IHRoaXMuX2FsbDtcbiAgICAgIGZvcihpID0gMCwgbCA9IGZucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgaWYoZm4gPT09IGZuc1tpXSkge1xuICAgICAgICAgIGZucy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYWxsID0gW107XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZjtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgIXRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHZhciBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG5cbiAgICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xuICAgICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcbiAgICAgICAgbGVhZi5fbGlzdGVuZXJzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgaGFuZGxlcnMgPSBbXTtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlcnMsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgICByZXR1cm4gaGFuZGxlcnM7XG4gICAgfVxuXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB0aGlzLl9ldmVudHNbdHlwZV0gPSBbXTtcbiAgICBpZiAoIWlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9ldmVudHNbdHlwZV07XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnNBbnkgPSBmdW5jdGlvbigpIHtcblxuICAgIGlmKHRoaXMuX2FsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gIH07XG5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEV2ZW50RW1pdHRlcjtcbiAgICB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBDb21tb25KU1xuICAgIGV4cG9ydHMuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbC5cbiAgICB3aW5kb3cuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbiAgfVxufSgpO1xuIiwiXG4vKiBnbG9iYWwgdW5lc2NhcGUgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1hZ2VUb1VyaSA9IHJlcXVpcmUoICdpbWFnZS10by1kYXRhLXVyaScgKTtcblxuLypcbiMjIEltYWdlIHRvIGJsb2Jcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbkNvbnZlcnRzIHJlbW90ZSBpbWFnZSB1cmxzIHRvIGJsb2JzIHZpYSBjYW52YXMuIFxuXG5gYGBqYXZhc2NyaXB0XG52YXIgaW1hZ2VUb0Jsb2IgPSByZXF1aXJlKCAnaW1hZ2UtdG8tYmxvYicgKTtcblxuaW1hZ2VUb0Jsb2IoICdodHRwOi8vZm9vLmJhci9iYXoucG5nJywgZnVuY3Rpb24oIGVyciwgdXJpICkgeyBcbiAgICBjb25zb2xlLmxvZyggdXJpICk7IFxufSApO1xuaW1hZ2VUb0Jsb2IoIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCAnaW1nJyApWyAwIF0sIGZ1bmN0aW9uKCBlcnIsIHVyaSApIHsgXG4gICAgY29uc29sZS5sb2coIHVyaSApOyBcbn0gKTtcbmBgYFxuKi9cblxudmFyIHR5cGVzID0ge1xuICAgICdwbmcnOiAnaW1hZ2UvcG5nJyxcbiAgICAnanBnJzogJ2ltYWdlL2pwZWcnLFxuICAgICdqcGVnJzogJ2ltYWdlL2pwZWcnLFxuICAgICdzdmcnOiAnaW1hZ2Uvc3ZnK3htbCcgLy8gdGhpcyBnZXRzIGNvbnZlcnRlZCB0byBwbmdcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW1hZ2VUb0Jsb2I7XG5tb2R1bGUuZXhwb3J0cy5kYXRhVVJJdG9CbG9iID0gZGF0YVVSSXRvQmxvYjtcbm1vZHVsZS5leHBvcnRzLl9oYW5kbGVJbWFnZVRvVVJJID0gaGFuZGxlSW1hZ2VUb1VSSTtcbm1vZHVsZS5leHBvcnRzLmdldE1pbWVUeXBlRnJvbVVybCA9IGdldFR5cGU7XG5cbi8qXG4gICAgaW1hZ2VUb0Jsb2IgLSBtYWluIGZ1bmN0aW9uIHRoYXQgZ2V0cyBleHBvc2VkLCBjb252ZXJ0cyBlaXRoZXIgZG9tIG5vZGUgb3IgdXJsIG9mIGltYWdlIGludG8gYmxvYiBkYXRhXG5cbiAgICBwYXJhbXNcbiAgICAgICAgaW1nIHsgT2JqZWN0IHwgU3RyaW5nIH0gLSBlaXRoZXIgY2FuIGJlIGFuIElNRyBET00gbm9kZSBvciBhIHVybCBzdHJpbmcgdGhhdCB3aWxsIGxvYWQgdGhlIGltYWdlXG4gICAgICAgIG9wdGlvbnMgeyBPYmplY3QgfSAtIG9wdGlvbmFsLCBhIHNldCBvZiBvcHRpb25zIHRoYXQgeW91IGNhbiBwYXNzIHRvIHRoZSBpbWFnZXRvYmxvYiB0byBjaGFuZ2UgdGhlIGJlaGF2aW9yXG4gICAgICAgIGNhbGxiYWNrIHsgRnVuY3Rpb24gfSAtIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBjb252ZXJzaW9uIGlzIGNvbXBsZXRlZC4gVGhlIGNhbGxiYWNrIHdpbGwgZ2V0IHBhc3NlZCBhbiBlcnJvciAoIGlmIG9uZSBvY2N1cmVzICkgYW5kIHRoZSBibG9iLlxuXG4qL1xuXG5mdW5jdGlvbiBpbWFnZVRvQmxvYiggaW1nLCBvcHRpb25zLCBjYWxsYmFjayApIHtcbiAgICBcbiAgICB2YXIgc3JjO1xuXG4gICAgaWYgKCB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICBpZiAoICFpbWcgKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayggbmV3IEVycm9yKCAnUGFzcyBpbiBhIElNRyBET00gbm9kZSBvciBhIHVybCBhcyBmaXJzdCBwYXJhbScgKSApO1xuICAgIH1cblxuICAgIGlmICggdHlwZW9mIGltZyA9PT0gJ29iamVjdCcgJiYgaW1nLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2ltZycgKSB7XG4gICAgICAgIHNyYyA9IGltZy5zcmM7XG4gICAgfVxuXG4gICAgaWYgKCB0eXBlb2YgaW1nID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgc3JjID0gaW1nO1xuICAgIH1cblxuICAgIGlmICggL15kYXRhOi8udGVzdCggc3JjICkgKSB7IC8vIGNoZWNrIHRvIHNlZSBpZiBpdHMgYSBkYXRhIHVyaVxuICAgICAgICBjYWxsYmFjayggbnVsbCwgZGF0YVVSSXRvQmxvYiggc3JjICkgKTsgLy8gc2NyaXB0IHRvIGRhdGF1cmkgY29udmVyc2lvblxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgb3B0aW9ucy50eXBlID0gdHlwZXNbIG9wdGlvbnMudHlwZSBdIHx8IGdldFR5cGUoIHNyYyApO1xuICAgIG9wdGlvbnMuc3JjID0gc3JjO1xuICAgIG9wdGlvbnMuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICBpZiAoICFvcHRpb25zLnR5cGUgKSB7XG5cbiAgICAgICAgY2FsbGJhY2soIG5ldyBFcnJvciggJ0ltYWdlIHR5cGUgaXMgbm90IHN1cHBvcnRlZCcgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaW1hZ2VUb1VyaSggc3JjLCBvcHRpb25zLnR5cGUsIGhhbmRsZUltYWdlVG9VUkkuYmluZCggbnVsbCwgb3B0aW9ucyApICk7IC8vIGF0dGVtcHQgaWYgd2UgaGF2ZSBhIFxufVxuXG4vKlxuICAgIGRhdGFVUkl0b0Jsb2IgLSB0YWtlcyBhIGRhdGF1cmkgYW5kIGNvbnZlcnRzIGl0IGludG8gYSBibG9iXG5cbiAgICBwYXJhbXNcbiAgICAgICAgdXJpIHsgU3RyaW5nIH0gLSBhIHZhbGlkIGRhdGF1cmlcblxuICAgIHJldHVybnNcbiAgICAgICAgYmxvYiB7IEJsb2IgT2JqZWN0IH0gLSBnZW5lcmF0ZWQgYmxvYiBvYmplY3RcblxuKi9cblxuXG5mdW5jdGlvbiBkYXRhVVJJdG9CbG9iKCB1cmkgKSB7XG4gICAgLy8gY29udmVydCBiYXNlNjQvVVJMRW5jb2RlZCBkYXRhIGNvbXBvbmVudCB0byByYXcgYmluYXJ5IGRhdGEgaGVsZCBpbiBhIHN0cmluZ1xuICAgIHZhciBieXRlU3RyaW5nLFxuICAgICAgICBtaW1lU3RyaW5nLFxuICAgICAgICBpYTtcblxuICAgIGlmICggdXJpLnNwbGl0KCAnLCcgKVswXS5pbmRleE9mKCAnYmFzZTY0JyApID49IDAgKSB7XG5cbiAgICAgICAgYnl0ZVN0cmluZyA9IGF0b2IoIHVyaS5zcGxpdCgnLCcpWzFdICk7XG4gICAgfVxuICAgIGVsc2Uge1xuXG4gICAgICAgIGJ5dGVTdHJpbmcgPSB1bmVzY2FwZSggdXJpLnNwbGl0KCcsJylbMV0gKTtcbiAgICB9XG5cbiAgICAvLyBzZXBhcmF0ZSBvdXQgdGhlIG1pbWUgY29tcG9uZW50XG4gICAgbWltZVN0cmluZyA9IHVyaS5zcGxpdCggJywnIClbIDAgXS5zcGxpdCggJzonIClbIDEgXS5zcGxpdCggJzsnIClbIDAgXTtcblxuICAgIC8vIHdyaXRlIHRoZSBieXRlcyBvZiB0aGUgc3RyaW5nIHRvIGEgdHlwZWQgYXJyYXlcbiAgICBpYSA9IG5ldyBVaW50OEFycmF5KCBieXRlU3RyaW5nLmxlbmd0aCApO1xuXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgYnl0ZVN0cmluZy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgXG4gICAgICAgIGlhWyBpIF0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoIGkgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJsb2IoIFsgaWEgXSwge1xuICAgICAgICB0eXBlOiBtaW1lU3RyaW5nXG4gICAgfSApO1xufVxuXG4vKlxuICAgIGhhbmRsZUltYWdlVG9VUkkgLSBoYW5kbGVzIGEgY2FsbGJhY2sgZnJvbSBpbWFnZVRvVVJJIGFuZCBnbHVlcyB0b2dldGhlciBkYXRhVVJJdG9CbG9iXG5cbiAgICBwYXJhbXNcbiAgICAgICAgb3B0aW9ucyB7IE9iamVjdCB9IC0gdGhlIG9wdGlvbnMgb2JqZWN0IHBhc3NlZCB0byB0aGUgbWFpbiBmbiB3aXRoIHRoZSBjYWxsYmFjayBhdHRhY2hlZCB0byBpdFxuICAgICAgICBlcnIgeyBFcnJvciBPYmplY3QgfSAtIGFuIGVycm9yIGlmIG9uZSBvY2N1cnMgaW4gdGhlIGltYWdlVG9VUkkgbWV0aG9kIFxuICAgICAgICB1cmkgeyBTdHJpbmcgfSAtIGEgdmFsaWQgZGF0YSB1cmxcblxuKi9cblxuZnVuY3Rpb24gaGFuZGxlSW1hZ2VUb1VSSSggb3B0aW9ucywgZXJyLCB1cmkgKSB7XG5cbiAgICBpZiAoIGVyciApIHtcbiAgICAgICAgb3B0aW9ucy5jYWxsYmFjayggZXJyICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvcHRpb25zLmNhbGxiYWNrKCBudWxsLCBkYXRhVVJJdG9CbG9iKCB1cmkgKSApO1xuXG59XG5cbi8qXG4gICAgZ2V0VHlwZSAtIHNtYWxsIHV0aWwgdG8gZ2V0IHR5cGUgZnJvbSB1cmwgaWYgb25lIGlzIHByZXNlbnQgaW4gdHlwZXMgbGlzdFxuXG4gICAgcGFyYW1zXG4gICAgICAgIHVybCB7IFN0cmluZyB9IC0gYSB1cmwgdG8gcGFyc2UgdGhlIGZpbGUgZXh0ZW5zaW9uIGZyb21cblxuICAgIHJldHVybnNcbiAgICAgICAgdHlwZSB7IFN0cmluZyB9IC0gYSBtaW1lIHR5cGUgaWYgdHlwZSBpcyBzdXBwb3J0ZWQsIGlmIG5vdCB1bmRlZmluZWQgaXMgcmV0dXJuZWRcblxuKi9cblxuZnVuY3Rpb24gZ2V0VHlwZSggdXJsICkge1xuICAgIHJldHVybiB1cmwgPyB0eXBlc1sgdXJsLnNwbGl0KCAnPycgKS5zaGlmdCggKS5zcGxpdCggJy4nICkucG9wKCApIF0gOiBudWxsIDtcbn1cbiIsIi8vIGNvbnZlcnRzIGEgVVJMIG9mIGFuIGltYWdlIGludG8gYSBkYXRhVVJJXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh1cmwsIG1pbWVUeXBlLCBjYikge1xuICAgIC8vIENyZWF0ZSBhbiBlbXB0eSBjYW52YXMgYW5kIGltYWdlIGVsZW1lbnRzXG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpLFxuICAgICAgICBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcblxuICAgIGlmICggdHlwZW9mIG1pbWVUeXBlID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICBjYiA9IG1pbWVUeXBlO1xuICAgICAgICBtaW1lVHlwZSA9IG51bGw7XG4gICAgfVxuXG4gICAgbWltZVR5cGUgPSBtaW1lVHlwZSB8fCAnaW1hZ2UvcG5nJztcblxuICAgIC8vIGFsbG93IGZvciBjcm9zcyBvcmlnaW4gdGhhdCBoYXMgY29ycmVjdCBoZWFkZXJzXG4gICAgaW1nLmNyb3NzT3JpZ2luID0gXCJBbm9ueW1vdXNcIjsgXG5cbiAgICBpbWcub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIC8vIG1hdGNoIHNpemUgb2YgaW1hZ2VcbiAgICAgICAgY2FudmFzLndpZHRoID0gaW1nLndpZHRoO1xuICAgICAgICBjYW52YXMuaGVpZ2h0ID0gaW1nLmhlaWdodDtcblxuICAgICAgICAvLyBDb3B5IHRoZSBpbWFnZSBjb250ZW50cyB0byB0aGUgY2FudmFzXG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoaW1nLCAwLCAwKTtcblxuICAgICAgICAvLyBHZXQgdGhlIGRhdGEtVVJJIGZvcm1hdHRlZCBpbWFnZVxuICAgICAgICBjYiggbnVsbCwgY2FudmFzLnRvRGF0YVVSTCggbWltZVR5cGUgKSApO1xuICAgIH07XG5cbiAgICBpbWcub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2IobmV3IEVycm9yKCdGYWlsZWRUb0xvYWRJbWFnZScpKTtcbiAgICB9O1xuXG4gICAgLy8gY2FudmFzIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICBpZiAoIWNhbnZhcy5nZXRDb250ZXh0KSB7XG4gICAgICAgIGNiKG5ldyBFcnJvcignQ2FudmFzSXNOb3RTdXBwb3J0ZWQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW1nLnNyYyA9IHVybDtcbiAgICB9XG59O1xuIiwiLyohXHJcbiAqIEBuYW1lIEphdmFTY3JpcHQvTm9kZUpTIE1lcmdlIHYxLjIuMFxyXG4gKiBAYXV0aG9yIHllaWtvc1xyXG4gKiBAcmVwb3NpdG9yeSBodHRwczovL2dpdGh1Yi5jb20veWVpa29zL2pzLm1lcmdlXHJcblxyXG4gKiBDb3B5cmlnaHQgMjAxNCB5ZWlrb3MgLSBNSVQgbGljZW5zZVxyXG4gKiBodHRwczovL3Jhdy5naXRodWIuY29tL3llaWtvcy9qcy5tZXJnZS9tYXN0ZXIvTElDRU5TRVxyXG4gKi9cclxuXHJcbjsoZnVuY3Rpb24oaXNOb2RlKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIG9uZSBvciBtb3JlIG9iamVjdHMgXHJcblx0ICogQHBhcmFtIGJvb2w/IGNsb25lXHJcblx0ICogQHBhcmFtIG1peGVkLC4uLiBhcmd1bWVudHNcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHR2YXIgUHVibGljID0gZnVuY3Rpb24oY2xvbmUpIHtcclxuXHJcblx0XHRyZXR1cm4gbWVyZ2UoY2xvbmUgPT09IHRydWUsIGZhbHNlLCBhcmd1bWVudHMpO1xyXG5cclxuXHR9LCBwdWJsaWNOYW1lID0gJ21lcmdlJztcclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9yIG1vcmUgb2JqZWN0cyByZWN1cnNpdmVseSBcclxuXHQgKiBAcGFyYW0gYm9vbD8gY2xvbmVcclxuXHQgKiBAcGFyYW0gbWl4ZWQsLi4uIGFyZ3VtZW50c1xyXG5cdCAqIEByZXR1cm4gb2JqZWN0XHJcblx0ICovXHJcblxyXG5cdFB1YmxpYy5yZWN1cnNpdmUgPSBmdW5jdGlvbihjbG9uZSkge1xyXG5cclxuXHRcdHJldHVybiBtZXJnZShjbG9uZSA9PT0gdHJ1ZSwgdHJ1ZSwgYXJndW1lbnRzKTtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2xvbmUgdGhlIGlucHV0IHJlbW92aW5nIGFueSByZWZlcmVuY2VcclxuXHQgKiBAcGFyYW0gbWl4ZWQgaW5wdXRcclxuXHQgKiBAcmV0dXJuIG1peGVkXHJcblx0ICovXHJcblxyXG5cdFB1YmxpYy5jbG9uZSA9IGZ1bmN0aW9uKGlucHV0KSB7XHJcblxyXG5cdFx0dmFyIG91dHB1dCA9IGlucHV0LFxyXG5cdFx0XHR0eXBlID0gdHlwZU9mKGlucHV0KSxcclxuXHRcdFx0aW5kZXgsIHNpemU7XHJcblxyXG5cdFx0aWYgKHR5cGUgPT09ICdhcnJheScpIHtcclxuXHJcblx0XHRcdG91dHB1dCA9IFtdO1xyXG5cdFx0XHRzaXplID0gaW5wdXQubGVuZ3RoO1xyXG5cclxuXHRcdFx0Zm9yIChpbmRleD0wO2luZGV4PHNpemU7KytpbmRleClcclxuXHJcblx0XHRcdFx0b3V0cHV0W2luZGV4XSA9IFB1YmxpYy5jbG9uZShpbnB1dFtpbmRleF0pO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpIHtcclxuXHJcblx0XHRcdG91dHB1dCA9IHt9O1xyXG5cclxuXHRcdFx0Zm9yIChpbmRleCBpbiBpbnB1dClcclxuXHJcblx0XHRcdFx0b3V0cHV0W2luZGV4XSA9IFB1YmxpYy5jbG9uZShpbnB1dFtpbmRleF0pO1xyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gb3V0cHV0O1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSB0d28gb2JqZWN0cyByZWN1cnNpdmVseVxyXG5cdCAqIEBwYXJhbSBtaXhlZCBpbnB1dFxyXG5cdCAqIEBwYXJhbSBtaXhlZCBleHRlbmRcclxuXHQgKiBAcmV0dXJuIG1peGVkXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIG1lcmdlX3JlY3Vyc2l2ZShiYXNlLCBleHRlbmQpIHtcclxuXHJcblx0XHRpZiAodHlwZU9mKGJhc2UpICE9PSAnb2JqZWN0JylcclxuXHJcblx0XHRcdHJldHVybiBleHRlbmQ7XHJcblxyXG5cdFx0Zm9yICh2YXIga2V5IGluIGV4dGVuZCkge1xyXG5cclxuXHRcdFx0aWYgKHR5cGVPZihiYXNlW2tleV0pID09PSAnb2JqZWN0JyAmJiB0eXBlT2YoZXh0ZW5kW2tleV0pID09PSAnb2JqZWN0Jykge1xyXG5cclxuXHRcdFx0XHRiYXNlW2tleV0gPSBtZXJnZV9yZWN1cnNpdmUoYmFzZVtrZXldLCBleHRlbmRba2V5XSk7XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRiYXNlW2tleV0gPSBleHRlbmRba2V5XTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGJhc2U7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9yIG1vcmUgb2JqZWN0c1xyXG5cdCAqIEBwYXJhbSBib29sIGNsb25lXHJcblx0ICogQHBhcmFtIGJvb2wgcmVjdXJzaXZlXHJcblx0ICogQHBhcmFtIGFycmF5IGFyZ3ZcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiBtZXJnZShjbG9uZSwgcmVjdXJzaXZlLCBhcmd2KSB7XHJcblxyXG5cdFx0dmFyIHJlc3VsdCA9IGFyZ3ZbMF0sXHJcblx0XHRcdHNpemUgPSBhcmd2Lmxlbmd0aDtcclxuXHJcblx0XHRpZiAoY2xvbmUgfHwgdHlwZU9mKHJlc3VsdCkgIT09ICdvYmplY3QnKVxyXG5cclxuXHRcdFx0cmVzdWx0ID0ge307XHJcblxyXG5cdFx0Zm9yICh2YXIgaW5kZXg9MDtpbmRleDxzaXplOysraW5kZXgpIHtcclxuXHJcblx0XHRcdHZhciBpdGVtID0gYXJndltpbmRleF0sXHJcblxyXG5cdFx0XHRcdHR5cGUgPSB0eXBlT2YoaXRlbSk7XHJcblxyXG5cdFx0XHRpZiAodHlwZSAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIga2V5IGluIGl0ZW0pIHtcclxuXHJcblx0XHRcdFx0dmFyIHNpdGVtID0gY2xvbmUgPyBQdWJsaWMuY2xvbmUoaXRlbVtrZXldKSA6IGl0ZW1ba2V5XTtcclxuXHJcblx0XHRcdFx0aWYgKHJlY3Vyc2l2ZSkge1xyXG5cclxuXHRcdFx0XHRcdHJlc3VsdFtrZXldID0gbWVyZ2VfcmVjdXJzaXZlKHJlc3VsdFtrZXldLCBzaXRlbSk7XHJcblxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdFx0cmVzdWx0W2tleV0gPSBzaXRlbTtcclxuXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCB0eXBlIG9mIHZhcmlhYmxlXHJcblx0ICogQHBhcmFtIG1peGVkIGlucHV0XHJcblx0ICogQHJldHVybiBzdHJpbmdcclxuXHQgKlxyXG5cdCAqIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vdHlwZW9mdmFyXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIHR5cGVPZihpbnB1dCkge1xyXG5cclxuXHRcdHJldHVybiAoe30pLnRvU3RyaW5nLmNhbGwoaW5wdXQpLnNsaWNlKDgsIC0xKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuXHR9XHJcblxyXG5cdGlmIChpc05vZGUpIHtcclxuXHJcblx0XHRtb2R1bGUuZXhwb3J0cyA9IFB1YmxpYztcclxuXHJcblx0fSBlbHNlIHtcclxuXHJcblx0XHR3aW5kb3dbcHVibGljTmFtZV0gPSBQdWJsaWM7XHJcblxyXG5cdH1cclxuXHJcbn0pKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZSAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKTsiLCJ2YXIgZW1pdCA9IHJlcXVpcmUoICdlbWl0LWJpbmRpbmdzJyApLFxuICAgIGF0dHJpYnV0ZXMgPSB7XG4gICAgICAgIG5hbWUgOiAncHJldmlldycsXG4gICAgICAgIGhpZGU6IHRydWVcbiAgICB9O1xuXG5cbmZ1bmN0aW9uIFByZXZpZXcoIGF0dHJzICl7IFxuICAgIHRoaXMuYXR0cmlidXRlcyA9IGF0dHJzO1xufVxuXG5QcmV2aWV3LnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbiggbWV0YSwgc2tvbGwsIGRvbmUgKXtcbiAgICAgICAgdmFyIGZpbGVzID0gbWV0YS5ldmVudC5maWxlcy5maWx0ZXIoIGZpbHRlclVybHMgKSxcbiAgICAgICAgICAgIHNpemUgPSBmaWxlcy5sZW5ndGgsXG4gICAgICAgICAgICBjb3VudCA9IDAsXG4gICAgICAgICAgICByZW5kZXIgPSB0aGlzLnJlbmRlci5iaW5kKCB0aGlzICksXG4gICAgICAgICAgICBfZmlsZXMgPSBbXTtcblxuICAgICAgICBlbWl0Lm9uKCAnc2tvbGwucHJldmlldy5jYW5jZWwnLCBza29sbC5vcGVuLmJpbmQoIHNrb2xsLCB7IG1ldGE6IG1ldGEgfSApICk7XG4gICAgICAgIGVtaXQub24oICdza29sbC5wcmV2aWV3LnVzZScsIHNrb2xsLnVwbG9hZC5iaW5kKCBza29sbCwgbWV0YS5ldmVudCApICk7XG5cbiAgICAgICAgZnVuY3Rpb24gbmV4dCggZXJyLCBVUkkgKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBidG5zO1xuXG4gICAgICAgICAgICBjb3VudCArKztcblxuICAgICAgICAgICAgaWYgKCAhZXJyICYmIFVSSSApIHsgXG4gICAgICAgICAgICAgICAgX2ZpbGVzLnB1c2goIFVSSSApOyBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCBjb3VudCA9PT0gc2l6ZSApIHtcbiAgICAgICAgICAgICAgICByZW5kZXIoIF9maWxlcywgZG9uZSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCAhc2l6ZSApIHtcbiAgICAgICAgICAgIGRvbmUoIG51bGwsICcnICk7IC8vIGNhbGwgZXZlbnRcbiAgICAgICAgICAgIHNrb2xsLnVwbG9hZCggbWV0YS5ldmVudCApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBmaWxlcyBydW4gdGhyb3VnaCBlYWNoXG4gICAgICAgIGZpbGVzLmZvckVhY2goIGZ1bmN0aW9uKCBmaWxlICl7XG4gICAgICAgICAgICAgICAgcmVhZEZpbGUoIGZpbGUsIG5leHQgKTsgXG4gICAgICAgICAgICB9ICk7ICAgIFxuXG4gICAgfSxcbiAgICB0ZWFyZG93bjogZnVuY3Rpb24oKXtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC5wcmV2aWV3LmNhbmNlbCcgKTtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC5wcmV2aWV3LnVzZScgKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24oIGZpbGVzLCBjYWxsYmFjayApIHtcbiAgICAgICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApLFxuICAgICAgICAgICAgdXNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKSxcbiAgICAgICAgICAgIGNhbmNlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICksXG4gICAgICAgICAgICBpbWFnZXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApLFxuICAgICAgICAgICAgYnV0dG9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnIClcblxuICAgICAgICB3cmFwcGVyLmNsYXNzTGlzdC5hZGQoICdza29sbC1wcmV2aWV3LXdyYXBwZXInICk7XG4gICAgICAgIGltYWdlcy5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtcHJldmlldy1pbWFnZXMnICk7XG4gICAgICAgIGJ1dHRvbnMuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXByZXZpZXctYnV0dG9ucycgKTtcblxuICAgICAgICB1c2UuaW5uZXJUZXh0ID0gJ1VzZSc7XG4gICAgICAgIHVzZS5zZXRBdHRyaWJ1dGUoICdkYXRhLWVtaXQnLCAnc2tvbGwucHJldmlldy51c2UnICk7XG4gICAgICAgIHVzZS5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtYnV0dG9uJyApO1xuXG4gICAgICAgIGNhbmNlbC5pbm5lckhUTUwgPSAnQ2FuY2VsJztcbiAgICAgICAgY2FuY2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZW1pdCcsICdza29sbC5wcmV2aWV3LmNhbmNlbCcgKTtcbiAgICAgICAgY2FuY2VsLmNsYXNzTGlzdC5hZGQoICdza29sbC1idXR0b24nICk7XG5cbiAgICAgICAgaWYoIGZpbGVzLmxlbmd0aCA9PT0gMSApIHtcbiAgICAgICAgICAgIC8vIGRpc3BsYXkgYSBsYXJnZSBpbWFnZVxuICAgICAgICAgICAgdmFyIGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdpbWcnICk7XG4gICAgICAgICAgICBpbWcuc3JjID0gZmlsZXNbIDAgXTtcbiAgICAgICAgICAgIGltZy5jbGFzc0xpc3QuYWRkKCAnc2tvbGwtcHJldmlldy1pbWFnZS1sYXJnZScpO1xuICAgICAgICAgICAgaW1hZ2VzLmFwcGVuZENoaWxkKCBpbWcgKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goIGNyZWF0ZUVsZW1lbnRBbmRBcHBlbmQoIGltYWdlcyApICk7XG4gICAgICAgIH1cblxuICAgICAgICB3cmFwcGVyLmFwcGVuZENoaWxkKCBpbWFnZXMgKTtcbiAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZCggYnV0dG9ucyApO1xuICAgICAgICBidXR0b25zLmFwcGVuZENoaWxkKCBjYW5jZWwgKTtcbiAgICAgICAgYnV0dG9ucy5hcHBlbmRDaGlsZCggdXNlICk7XG5cbiAgICAgICAgY2FsbGJhY2soIG51bGwsIHdyYXBwZXIgKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBQcmV2aWV3KCBhdHRyaWJ1dGVzICk7XG5tb2R1bGUuZXhwb3J0cy5QbHVnaW4gPSBQcmV2aWV3OyAvLyBleHBvcnQgb3V0IHBsdWdpbiBmb3IgZXh0ZW5kaW5nXG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnRBbmRBcHBlbmQoIGNvbnRhaW5lciApIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oIGZpbGUgKSB7XG4gICAgICAgIHZhciBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgICAgICBpbWcuY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXByZXZpZXctaW1hZ2UnICk7XG4gICAgICAgIGltZy5zZXRBdHRyaWJ1dGUoICdzdHlsZScsICdiYWNrZ3JvdW5kLWltYWdlOiB1cmwoJyArIGZpbGUgKyAnKTsnICk7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCggaW1nICk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmaWx0ZXJVcmxzKCBmaWxlICkge1xuICAgIHJldHVybiB0eXBlb2YgZmlsZS51cmwgIT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiByZWFkRmlsZSggZmlsZSwgY2FsbGJhY2sgKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cbiAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oICkge1xuICAgICAgICBjYWxsYmFjayggbnVsbCwgcmVhZGVyLnJlc3VsdCApO1xuICAgIH07XG5cbiAgICByZWFkZXIub25lcnJvciA9IGZ1bmN0aW9uKCBlcnIgKSB7XG4gICAgICAgIGNhbGxiYWNrKCBlcnIgKTtcbiAgICB9O1xuXG4gICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoIGZpbGUgKTtcbn0iLCJcbnZhciBlbWl0ID0gcmVxdWlyZSggJ2VtaXQtYmluZGluZ3MnICk7XG5cbmZ1bmN0aW9uIFVwbG9hZCggYXR0cnMgKXsgXG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gYXR0cnM7XG59XG5cblVwbG9hZC5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oIG1ldGEsIHNrb2xsLCBkb25lICkge1xuICAgICAgICB0aGlzLnNrb2xsID0gc2tvbGw7XG4gICAgICAgIGVtaXQub24oICdza29sbC51cGxvYWQuc3VibWl0JywgdGhpcy5vblN1Ym1pdC5iaW5kKCB0aGlzICkgKTtcbiAgICAgICAgZW1pdC5vbiggJ3Nrb2xsLnVwbG9hZC50cmlnZ2VyJywgdGhpcy5vblRyaWdnZXIuYmluZCggdGhpcyApICk7XG4gICAgICAgIHRoaXMucmVuZGVyKCBkb25lICk7XG4gICAgfSxcbiAgICB0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIGNsZWFyIG91dCBzb21lIGNhY2hlXG4gICAgICAgIHRoaXMudXBsb2FkID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbnB1dCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5za29sbCA9IG51bGw7XG4gICAgICAgIGVtaXQucmVtb3ZlQWxsTGlzdGVuZXJzKCAnc2tvbGwudXBsb2FkLnN1Ym1pdCcgKTtcbiAgICAgICAgZW1pdC5yZW1vdmVBbGxMaXN0ZW5lcnMoICdza29sbC51cGxvYWQudHJpZ2dlcicgKTtcbiAgICB9LFxuICAgIG9uU3VibWl0OiBmdW5jdGlvbiggZSApIHtcblxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgdmFyIGlucHV0ID0gdGhpcy5pbnB1dCxcbiAgICAgICAgICAgIHZhbHVlID0gaW5wdXQudmFsdWUsXG4gICAgICAgICAgICBldmVudCA9IHtcbiAgICAgICAgICAgICAgICBmaWxlczogW3tcbiAgICAgICAgICAgICAgICAgICAgdXJsOiB2YWx1ZVxuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuc2tvbGwucHJldmlldyggZXZlbnQgKTtcbiAgICB9LFxuICAgIG9uQ2hhbmdlOiBmdW5jdGlvbiggZSApIHtcbiAgICAgICAgdGhpcy5za29sbC5wcmV2aWV3KCBlLnRhcmdldCApO1xuICAgIH0sXG4gICAgb25UcmlnZ2VyOiBmdW5jdGlvbiggZSApIHtcbiAgICAgICAgdGhpcy51cGxvYWQuZGlzcGF0Y2hFdmVudCggbmV3IE1vdXNlRXZlbnQoICdjbGljaycgKSApOyAvLyBwcm94eSBldmVudCB0byB1cGxvYWRcbiAgICB9LFxuICAgIGF0dGFjaExpc3RlbmVyczogZnVuY3Rpb24oICkge1xuXG4gICAgICAgIHZhciBsZWF2ZUJ1ZmZlcixcbiAgICAgICAgICAgIGNsYXNzTGlzdCA9IHRoaXMuZHJvcHpvbmUuY2xhc3NMaXN0O1xuXG4gICAgICAgIGZ1bmN0aW9uIGRyYWdPdmVyKCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KCBsZWF2ZUJ1ZmZlciApO1xuICAgICAgICAgICAgaWYgKCBjbGFzc0xpc3QuY29udGFpbnMoICdza29sbC11cGxvYWQtZHJhZy1vdmVyJyApICkgcmV0dXJuO1xuICAgICAgICAgICAgY2xhc3NMaXN0LmFkZCggJ3Nrb2xsLXVwbG9hZC1kcmFnLW92ZXInICk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBkcmFnTGVhdmUoKSB7XG4gICAgICAgICAgICBjbGFzc0xpc3QucmVtb3ZlKCAnc2tvbGwtdXBsb2FkLWRyYWctb3ZlcicgKTtcbiAgICAgICAgICAgIGNsYXNzTGlzdC5yZW1vdmUoICdza29sbC11cGxvYWQtc2hvdycgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNob3dPdmVyKCkge1xuICAgICAgICAgICAgaWYgKCBjbGFzc0xpc3QucmVtb3ZlKCAnc2tvbGwtdXBsb2FkLXNob3cnICkgKSByZXR1cm47XG4gICAgICAgICAgICBjbGFzc0xpc3QuYWRkKCAnc2tvbGwtdXBsb2FkLXNob3cnICk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRyb3B6b25lLmFkZEV2ZW50TGlzdGVuZXIoICdkcmFnb3ZlcicsIGRyYWdPdmVyICk7XG4gICAgICAgIHRoaXMuZHJvcHpvbmUuYWRkRXZlbnRMaXN0ZW5lciggJ2RyYWdsZWF2ZScsIGRyYWdMZWF2ZSApO1xuICAgICAgICB0aGlzLmRyb3B6b25lLmFkZEV2ZW50TGlzdGVuZXIoICdkcm9wJywgZHJhZ0xlYXZlICk7XG5cbiAgICAgICAgdGhpcy5za29sbC5lbC5yZW1vdmVFdmVudExpc3RlbmVyKCAnZHJhZ292ZXInLCBzaG93T3ZlciApO1xuICAgICAgICB0aGlzLnNrb2xsLmVsLmFkZEV2ZW50TGlzdGVuZXIoICdkcmFnb3ZlcicsIHNob3dPdmVyICk7XG5cbiAgICAgICAgdGhpcy51cGxvYWQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHRoaXMub25DaGFuZ2UuYmluZCggdGhpcyApICk7XG5cbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24oIGRvbmUgKSB7XG5cbiAgICAgICAgdmFyIGh0bWwgPSBcbiAgICAgICAgJzxkaXYgY2xhc3M9XCJza29sbC11cGxvYWQtdXJsXCI+JyArIFxuICAgICAgICAgICAgJzxidXR0b24gY2xhc3M9XCJza29sbC1idXR0b25cIiBkYXRhLWVtaXQ9XCJza29sbC51cGxvYWQudHJpZ2dlclwiPlVwbG9hZCBBIEZpbGU8L2J1dHRvbj4nICtcbiAgICAgICAgJzwvZGl2PicgK1xuICAgICAgICAnPGhyPicgK1xuICAgICAgICAnPGZvcm0gY2xhc3M9XCJza29sbC11cGxvYWQtZm9ybVwiIGRhdGEtZW1pdD1cInNrb2xsLnVwbG9hZC5zdWJtaXRcIj4nICsgXG4gICAgICAgICAgICAnPHA+VXNlIGFuIFVSTDo8L3A+JyArIFxuICAgICAgICAgICAgJzxpbnB1dCB0eXBlPVwidXJsXCIgLz4nICsgXG4gICAgICAgICAgICAnPGJ1dHRvbiBjbGFzcz1cInNrb2xsLWJ1dHRvblwiPlN1Ym1pdDwvYnV0dG9uPicgK1xuICAgICAgICAnPC9mb3JtPicgK1xuICAgICAgICAnPGRpdiBjbGFzcz1cInNrb2xsLXVwbG9hZC1kcm9wem9uZVwiPicgK1xuICAgICAgICAgICAgJzxwPkRyb3AgeW91IGltYWdlcyBoZXJlITwvcD4nICtcbiAgICAgICAgICAgICc8aW5wdXQgY2xhc3M9XCJza29sbC11cGxvYWQtaW5wdXRcIiB0eXBlPVwiZmlsZVwiIG11bHRpcGxlIC8+JyArXG4gICAgICAgICc8L2Rpdj4nO1xuXG4gICAgICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuICAgICAgICB0aGlzLmVsLmNsYXNzTGlzdC5hZGQoICdza29sbC11cGxvYWQtcGx1Z2luJyApO1xuICAgICAgICB0aGlzLmVsLmlubmVySFRNTCA9IGh0bWw7XG5cbiAgICAgICAgdGhpcy5kcm9wem9uZSA9IHRoaXMuZWwuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSggJ3Nrb2xsLXVwbG9hZC1kcm9wem9uZScgKVsgMCBdO1xuICAgICAgICB0aGlzLnVwbG9hZCA9IHRoaXMuZHJvcHpvbmUuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSggJ3Nrb2xsLXVwbG9hZC1pbnB1dCcgKVsgMCBdO1xuICAgICAgICB0aGlzLmlucHV0ID0gdGhpcy5lbC5xdWVyeVNlbGVjdG9yKCAnLnNrb2xsLXVwbG9hZC1mb3JtIGlucHV0JyApO1xuXG4gICAgICAgIHRoaXMuYXR0YWNoTGlzdGVuZXJzKCApO1xuXG4gICAgICAgIGRvbmUoIG51bGwsIHRoaXMuZWwgKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBVcGxvYWQoIHtcbiAgICBuYW1lOiAndXBsb2FkJ1xufSApOyIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1hZ2VUb0Jsb2IgPSByZXF1aXJlKCAnaW1hZ2UtdG8tYmxvYicgKSxcbiAgICB1dGlscyA9IHJlcXVpcmUoICcuL3V0aWxzJyApO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVVwbG9hZEV2ZW50O1xuXG5mdW5jdGlvbiBjcmVhdGVVcGxvYWRFdmVudCAoIGV2ZW50ZGF0YSwgY2FsbGJhY2sgKSB7XG4gICAgX2dldEJsb2JEYXRhKCBldmVudGRhdGEsIGZ1bmN0aW9uKCBlcnIsIGZpbGVzICkgeyBcbiAgICAgICAgaWYgKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soIGVyciApO1xuICAgICAgICBldmVudGRhdGEuZmlsZXMgPSBmaWxlcztcblxuICAgICAgICBjYWxsYmFjayggbnVsbCwgZXZlbnRkYXRhICk7XG4gICAgfSApOyAgICBcbn1cbiBcbmZ1bmN0aW9uIF9nZXRCbG9iRGF0YSAoIGV2ZW50ZGF0YSwgY2FsbGJhY2sgKSB7XG4gICAgdmFyIGZpbGVzID0gdXRpbHMubWFrZUFycmF5KCBldmVudGRhdGEuZmlsZXMgKSxcbiAgICAgICAgc2l6ZSA9IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgY291bnQgPSAwO1xuXG4gICAgZnVuY3Rpb24gZG9uZSAoICkge1xuICAgICAgICBjb3VudCArKztcbiAgICAgICAgaWYgKCBjb3VudCA9PT0gc2l6ZSApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCBudWxsLCBmaWxlcyApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0QmxvYkRhdGEoIGZpbGUsIGluZGV4ICkge1xuICAgICAgICBpZiAoIGZpbGUgaW5zdGFuY2VvZiBCbG9iICkge1xuICAgICAgICAgICAgZG9uZSgpOyAvLyBpZiBpdHMgYWxyZWFkeSBhIGJsb2Igbm8gbmVlZCB0byBkbyBhbnl0aGluZ1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBmaWxlLnVybCB8fCBmaWxlLmRhdGEgKSB7IC8vIGlmIHRoZSBmaWxlIHVybCBpcyBzZXQgb2YgdGhlIGZpbGUgZGF0YSBtZWFuaW5nIGEgZGF0YXVyaVxuICAgICAgICAgICAgaW1hZ2VUb0Jsb2IoIGZpbGUudXJsIHx8IGZpbGUuZGF0YSwgZnVuY3Rpb24oIGVyciwgYmxvYiApIHtcbiAgICAgICAgICAgICAgICBpZiAoIGVyciApIHJldHVybiBkb25lKCk7IC8vIHVuYWJsZSB0byBjb252ZXJ0IHNvIHNlbmQgaW4gcmF3IGZvcm1cbiAgICAgICAgICAgICAgICBmaWxlc1sgaW5kZXggXSA9IGJsb2I7XG4gICAgICAgICAgICAgICAgZG9uZSggKTtcbiAgICAgICAgICAgIH0gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkb25lKCApO1xuICAgIH1cblxuICAgIGZpbGVzLmZvckVhY2goIGdldEJsb2JEYXRhICk7XG59XG4iLCJcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMubWFrZUFycmF5ID0gZnVuY3Rpb24gKCBhcnIgKSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcnIsIDAgKTtcbn07Il19
