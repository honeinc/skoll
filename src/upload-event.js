
var merge = require( 'merge' );
module.exports = UploadEvent;

function UploadEvent ( eventdata ) {




    return new Event( 'uploadevent', eventdata );
}

UploadEvent.prototype._getBlobData = function() { };