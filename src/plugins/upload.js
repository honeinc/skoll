
var plugin = module.exports = {
    open: function( meta, fileUploader, done ) {
        var button = document.createElement( 'button' );
        
        plugin.container = document.createElement( 'form' ),

        plugin.upload = document.createElement( 'input' );
        plugin.upload.type = 'file';
        plugin.upload.multiple = true;

        plugin.input = document.createElement( 'input' );
        plugin.input.type = 'url';

        button.innerHTML = 'Submit';

        plugin.container.appendChild( plugin.upload );
        plugin.container.appendChild( plugin.input );
        plugin.container.appendChild( button );

        plugin.container.addEventListener( 'submit', onEventSubmit.bind( null, fileUploader ) );
        plugin.upload.addEventListener( 'change', onEventChange.bind( null, fileUploader ) );
        done( null, plugin.container );
    },
    teardown: function() {
        plugin.upload = null;
        plugin.input = null;
        plugin.container = null;
    },
    attributes: {
        name : 'upload'
    }
}


function onEventChange( fileUploader, event ) {
    fileUploader.preview( event.target );
}

function onEventSubmit( fileUploader, e ) {

    e.preventDefault();

    var input = plugin.input,
        value = input.value,
        event = {
            files: [{
                url: value
            }]
        };

    fileUploader.preview( event );
}