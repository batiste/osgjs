'use strict';
var Quat = require( 'osg/Quat' );

var degtorad = Math.PI / 180.0; // Degree-to-Radian conversion


var FirstPersonManipulatorDeviceOrientationController = function ( manipulator ) {
    this._manipulator = manipulator;
    this.init();
};

FirstPersonManipulatorDeviceOrientationController.computeQuaternion = ( function () {

    var screenTransform = Quat.create();
    var worldTransform = Quat.createAndSet( -Math.sqrt( 0.5 ), 0.0, 0.0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

    // but on ios alpha is relative to the first question:
    //
    // http://www.html5rocks.com/en/tutorials/device/orientation/
    // For most browsers, alpha returns the compass heading, so when the device is pointed
    // north, alpha is zero. With Mobile Safari, alpha is based on the direction the
    // device was pointing when device orientation was first requested. The compass
    // heading is available in the webkitCompassHeading parameter.

    return function ( quat, deviceOrientation, screenOrientation ) {

        var alpha = deviceOrientation.alpha * degtorad;
        var beta = deviceOrientation.beta * degtorad;
        var gamma = deviceOrientation.gamma * degtorad;

        // If the user goes in landscape mode, he rotates his device with a certain angle
        // around the Z axis counterclockwise and the DeviceOrientation contains this
        // rotation To compensate this, we apply a rotation of the same angle in the
        // opposite way

        var screenAngle = screenOrientation * degtorad;

        // alpha is heading -> X
        // beta             -> Z Up
        // Gamma            -> Y view direction
        Quat.makeRotateFromEuler( beta, alpha, -gamma, 'YXZ', quat );
        // equivalent to
        // var rotateX = Matrix.makeRotate( beta, 1,0,0, Matrix.create() );
        // var rotateY = Matrix.makeRotate( alpha, 0,1,0, Matrix.create() );
        // var rotateZ = Matrix.makeRotate( -gamma, 0,0,1, Matrix.create() );
        // var result = Matrix.create();
        // Matrix.mult( rotateY, rotateX, result );
        // Matrix.mult( result, rotateZ, result );
        // Matrix.getRotate( result, quat );

        var minusHalfAngle = -screenAngle / 2.0;
        screenTransform[ 1 ] = Math.sin( minusHalfAngle );
        screenTransform[ 3 ] = Math.cos( minusHalfAngle );

        Quat.mult( quat, screenTransform, quat );
        Quat.mult( quat, worldTransform, quat );

        var yTemp = quat[ 1 ];
        quat[ 1 ] = -quat[ 2 ];
        quat[ 2 ] = yTemp;

        return quat;
    };

} )();

FirstPersonManipulatorDeviceOrientationController.prototype = {

    init: function () {
        this._stepFactor = 1.0; // meaning radius*stepFactor to move
        this._quat = Quat.create();
    },

    update: function ( deviceOrientation, screenOrientation ) {

        FirstPersonManipulatorDeviceOrientationController.computeQuaternion( this._quat, deviceOrientation, screenOrientation );
        this._manipulator.setRotationBaseFromQuat( this._quat );
    }

};

module.exports = FirstPersonManipulatorDeviceOrientationController;
