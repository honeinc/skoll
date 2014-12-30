
var test = require( 'tape' ),   
    FileUploader = require( '../' );


test( 'testing the FileUploader object is exported to window', function( t ) {
    t.equals( typeof FileUploader, 'object', 'metrics is an object' );
    t.end();
} );
