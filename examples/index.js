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