
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