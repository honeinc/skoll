
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
