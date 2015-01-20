# Sköll
![Skoll Wolf Sun](https://cloud.githubusercontent.com/assets/578259/5482140/a07fb8a0-8610-11e4-9428-dd585593c16c.png)

Skoll is an upload modal that is hella cool. It is super pluggable by nature. You can overide just about anything, even the base functionality ( they are plugins! ). Check out the [example](https://github.com/honeinc/skoll/blob/master/examples/). 

![Uploaded with Skoll](http://honefiles.global.ssl.fastly.net/quizzes/54be0abb160c30bc4f375944/71b0bb2d-406d-4876-8832-28c2a9912bca/skoll.png)

> Skoll does not provide any CSS out of box but there is example CSS in the examples dir. This is because CSS needs to be fully customizable and we don't want you to have to overwrite our styles.

 To read more about Sköll checkout the [spec](https://github.com/honeinc/skoll/blob/master/SPEC.md).

[What does Sköll mean?](http://en.wikipedia.org/wiki/Sk%C3%B6ll)

## Usage

Use with [Browserify](http://browserify.org).

```
var skoll = require( 'skoll' );

skoll.addPlugin( foo );
skoll.useToUpload( function( event ) {
    
} );

skoll.open();
```

## Creating a plugin

coming soon.

## Creating an upload fn

coming soon.
