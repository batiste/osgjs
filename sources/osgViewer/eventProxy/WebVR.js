'use strict';
var Notify = require( 'osg/Notify' );
var Quat = require( 'osg/Quat' );
var Vec4 = require( 'osg/Vec4' );


var PositionState = function () {
    this.hasPosition = false;
    this.position = Vec4.create();
    this.linearVelocity = Vec4.create();
    this.linearAcceleration = Vec4.create();

    this.hasOrientation = false;
    this.orientation = Quat.create();
    this.angularVelocity = Quat.create();
    this.angularAcceleration = Quat.create();
};


var WebVR = function ( viewer ) {
    this._viewer = viewer;
    this._type = 'WebVR';
    this._enable = false;
    this._hmd = undefined;
    this._sensor = undefined;
    this._quat = Quat.create();

    this._positionState = new PositionState();
};

WebVR.prototype = {

    setEnable: function ( bool ) {
        this._enable = bool;
    },

    getEnable: function () {
        return this._enable;
    },

    init: function () {

        var self = this;

        var vrDeviceCallback = function ( vrDevices ) {

            var i;

            // First, find a HMD -- just use the first one we find
            for ( i = 0; i < vrDevices.length; ++i ) {
                if ( vrDevices[ i ] instanceof window.HMDVRDevice ) {
                    self._hmd = vrDevices[ i ];
                    break;
                }
            }

            // Then, find a sensor corresponding to the same hardwareUnitId
            for ( i = 0; i < vrDevices.length; ++i ) {
                if ( vrDevices[ i ] instanceof window.PositionSensorVRDevice && vrDevices[ i ].hardwareUnitId === self._hmd.hardwareUnitId ) {
                    self._sensor = vrDevices[ i ];
                    break;
                }
            }

            if ( self._hmd && self._sensor )
                Notify.log( 'Found a HMD and Sensor' );
        };

        if ( navigator.getVRDevices ) {
            navigator.getVRDevices().then( vrDeviceCallback );
        } else if ( navigator.mozGetVRDevices ) {
            navigator.mozGetVRDevices( vrDeviceCallback );
        }

    },

    getManipulatorController: function () {
        return this._viewer.getManipulator().getControllerList()[ this._type ];
    },

    isValid: function () {
        if ( !this._enable )
            return false;

        var manipulator = this._viewer.getManipulator();
        if ( !manipulator )
            return false;

        if ( !manipulator.getControllerList()[ this._type ] )
            return false;

        if ( !this._hmd || !this._sensor )
            return false;

        return true;
    },

    update: function () {

        if ( !this.isValid() )
            return;

        var manipulatorAdapter = this.getManipulatorController();

        // update the manipulator with the rotation of the device
        if ( manipulatorAdapter.update ) {

            var state = this._sensor.getState();

            this._positionState.hasPosition = state.hasPosition;
            this._positionState.hasOrientation = state.hasOrientation;

            if ( state.hasPosition ) {
                this._positionState.position[ 0 ] = state.position.x;
                this._positionState.position[ 1 ] = state.position.y;
                this._positionState.position[ 2 ] = state.position.z;

                // should copy linearVelocity linearAcceleration
            }


            var quat = this._sensor.getState().orientation;

            // If no real oculus is detected, navigators (vr builds of FF and Chrome) simulate a fake oculus
            // On firefox, this fake oculus returns a wrong quaternion: [0, 0, 0, 0]
            // So we detect and set this quaternion to a neutral value: [0, 0, 0, 1]
            // UPDATE : it looks like that sometimes no quaternion is returned
            if ( !quat ) {
                Quat.init( this._quat );
            } else {
                if ( quat.x === 0.0 && quat.y === 0.0 && quat.y === 0.0 && quat.w === 0.0 )
                    quat.w = 1.0;
                // On oculus the up vector is [0,1,0]
                // On osgjs the up vector is [0,0,1]
                this._quat[ 0 ] = quat.x;
                this._quat[ 1 ] = -quat.z;
                this._quat[ 2 ] = quat.y;
                this._quat[ 3 ] = quat.w;
            }

            if ( state.hasOrientation ) {
                Quat.copy( this._quat, this._positionState.orientation );
            }

            manipulatorAdapter.update( this._positionState );
        }
    },

    getHmd: function () {
        return this._hmd;
    }
};
module.exports = WebVR;
