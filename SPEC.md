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

# Plugin Spec v0

Plugin is a small specification for what a plugin should consist of to qualify as a viable plugin for `FileUploader`. Plugins are _Objects_ that can easily intergrate info the `FileUploader` but also work as a standalond module.

## Plugin Lifecycle

The plugin has a simple lifecycle. There is three primary states. The initial state is a _rest_ state that means the plugin is not viewable or interact able. Then once there is a intent from the user of application consuming the `FileUploader` to open this plugin then the plugins state is a _init_ or _render_ state that should get the view ready to be viewed. Onces the view is render and _calls back_ to the `FileUploader` the Plugin is then in an _active_ state. This is the part of the cycle that a user can iteract with the plugin and the plugins ui. Once the users intent is to close the Plugin or the entire `FileUploader` then the Plugin is in a temporary state of _teardown_ that once done is put back into a _rest_ state.

```
 ┌─  REST  ─┐
 │          │ 
INIT     TEARDOWN
 │          │
 └─ ACTIVE ─┘
```

### Triggers

- Init State -> Plugin::open
- Teardown -> Plugin::teardown 

## Required properties

### Plugin::attributes

This should be an `Object` that has some pieces of information about the plugin inside of it. The least of which is name to identify the plugin when registering the plugin with the `FileUploader`. Also another good not required property is version.

## Required Methods

### Plugin::open

This is a method that is called when the plugin is opened up into the view of the modal and the user can interact with the plugin. There is a some data that is passed to the open method.

First is some meta data that is the meta data about the page state that it is currently being viewed on there is no guarenttee what info is inside of this Object and is a way to get information to you plugin from the init `FileUploader::open` call.

Second is the actual `FileUploader` to be able to communicate back to the `FileUploader` or store some type of data on the `FileUploader` object for future use inside of other plugins. 

Third is a done method that expects an error and either a DOM Node or a String of HTML to indicate that the plugin has loaded. If nothing is given in the second param or and Error is given in the first param. The default plugin is rendered and an Error is emitted from the `FileUploader` Object.

Here is an example of a simple Plugin::open method

```javascript

plugin.open = function( meta, fileUploader, done ) {
    var name = meta.name,
        el = document.createElement( 'H1' );
    el.innerText = 'Hi ' + name + '!';
    done( null, el );
}; // this should render an H1 with a greeting inthe the modal content area.
```

### Plugin::teardown

This is a method that is called when there is an intent by the user to close the plugin or the entire `FileUploader`. The intent of this method is to give the plugin a good time to remove any event bindings and cleanup any data cache that is session based. 

# UploadEvent Spec v0

Upload Event is an Object that is passed to the uploader function that can be a custom function so a spec is needed to clearify what this object contains to be able to optimizate uploader funtions.

## Key Properties

### Upload::url

This is a url that points towards a url where the asset exsist. This will usually be an external asset which is not an image and something that should be embedded.

### Upload::files

This is an Array of Object that contain some meta data about the file similiar to the File Objects given back with an file input change event. Except that there is one distinct field that is blob if blob data is supported by the browser.

* Notes * So this spec was going to be longer to include hooks to tie into the `FileUploader` to diplay so effing awesome animations for loading the images but it was decided that this module should not be required to do that.
