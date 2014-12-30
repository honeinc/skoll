
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