
'use strict';

module.exports.makeArray = function ( arr ) {
    return Array.prototype.slice.call( arr, 0 );
};