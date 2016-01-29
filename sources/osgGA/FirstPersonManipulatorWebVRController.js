'use strict';

var FirstPersonManipulatorWebVRController = function ( manipulator ) {
    this._manipulator = manipulator;
    this.init();
};

FirstPersonManipulatorWebVRController.prototype = {
    init: function () {},

    update: function ( positionState ) {

        if ( positionState.hasOrientation )
            this._manipulator.setRotationBaseFromQuat( positionState.orientation );

    }
};

module.exports = FirstPersonManipulatorWebVRController;
