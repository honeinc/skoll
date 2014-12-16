# File Uploader Spec v0

File uploader is to be used as a commonjs module. eg `var fileUploader = require( 'file-uploader')` but also export a variable out to the window ` window.fileUploader `. Naming for module is not frozen and may change for a number of reasons

## Structure

File uploader is a should be built as a constructor but export out a singleton by default. It should be broken into as many modules that are logical. Eg.

```text
Entry Point
├── View Handling
├── Utilities
├── Pluggable Interface
├── Networking
├── Drag Drop Handling
└── Basic File Handling
```

## API

### FileUploader - Constructor

This is a basic Constructor that will just initialize some basic data structures needed to change the state of the fileUpload this should not due much due to the fact that this will happen initially inside of the module for the singleton. This should also be accessable via an export.

```javascript
var FileUploader = require( 'file-uploader' ).FileUploader,
    fileUploader = new FileUploader();
```

### FileUploader::el

This is just a getter and will be a DOM node that then you can use to attach to the DOM.

```javascript
var fileUploader = require( 'file-uploader' );

document.body.appendChild( fileUploader.el ); // apppend to page
```
### FileUploader::state

This is just a getter and will be a Object that a bunch of state data can be store into.

```javascript
var fileUploader = require( 'file-uploader' );

if ( typeof fileUploader.state === 'object' ) {
    conosle.log( 'file uploader state is an object' );
}

```

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

### FileUploader::close

This will remove the `show` from the uploader modal container. This will also trigger `Plugin::teardown` to the currect active plugin.

__params__

- preserveState { Boolean } - this will preserve the state of the current view so when opened again the state of the last time the uploader was opened is still preserved. This also avoids the `Plugin::teardown` trigger as well as the `Plugin::open` trigger when the `FileUploader` is opened back up.

```javascript
var fileUploader = require( 'file-uploader' );

fileUploader.open();
fileUplader.close();

if ( !fileUploader.state.view ) {
    console.log( 'fileUploader is closed' );
}

```

### FileUploader::addPlugin

This will add a plugin to the list of available plugins. Meaning that it will also add the plugin name to the list of _tabable_ plugins, and targets to open when opening the `FileUploader`.

__params__

- plugin { Object } - A `Plugin` object that has a number of differnt attributes on the plugin to allow the `FileUploader` to read and interact with the plugin. If some required methods are not provided the plugin will not be added and an `error` event will be emitted from the FileUploader.

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

### FileUploader::useToUpload

This is a way to extend the file uploader to allow for custom ways to upload files to your server. 

__params__

- uploadFn { Function } - a function that will be called when ever an asset is attempted to be uploaded. Due to the pluggablity of this modal this can be a number of things depending on the nature of the plugin. This can also be used to save information to you database about the data being uploaded.

uploadFn is passed an UploadEvent object that has a number of hooks that you can tie your uploader into to allow for an interactive experience while uploading photos. See `UploadEvent` object specification to see how to hook into this functionality

```javascript
var fileUploader = require( 'file-uploader' );

```javascript
fileUploader.useToUpload( function( <UploadEvent> ) {
    var files = event.files; // this is commiting from a input file event
    // blah blah upload
    feedbackFns.done({
        files[{ url: 'http://foo.bar/baz.png' }]
    })
} );