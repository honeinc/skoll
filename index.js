
'use strict';

var merge = require( 'merge' ),
    EventEmitter2 = require( 'eventemitter2' ).EventEmitter2,
    emit = require( 'emit-bindings' ),
    UploadEvent = require( './src/upload-event'),
    utils = require( './src/utils' ),
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
        span.textContent = name;
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
