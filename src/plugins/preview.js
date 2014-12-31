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