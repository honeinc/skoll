
var plugin = module.exports = {
    open: function( meta, fileUploader, done ) {
        done( null, "<h1>Hello World</h1>" );
    },
    teardown: function() { },
    attributes: {
        'name' : 'foo'
    }
}
