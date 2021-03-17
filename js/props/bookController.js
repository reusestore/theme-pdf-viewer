const mouseButtons = {
  Left: 0,
  Middle: 1,
  Right: 2
};

export function props() {
  return {
    eps: 1e-4,
    scale: {
      default: 0.9,
      min: 0.9,
      max: 2.5,
      levels: 7
    },
    lighting: {
      default: 0.7,
      min: 0,
      max: 1,
      levels: 7
    },
    pan: {
      speed: 50
    },
    loadingAnimation: {
      skin: false,
      book: true
    },
    autoResolution: {
      enabled: true,
      coefficient: 1.5
    },
    narrowView: {
      width: 500
    },
    actions: {
      cmdZoomIn: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdZoomOut: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdDefaultZoom: {
        enabled: true,
        enabledInNarrow: false,
        type: 'dblclick',
        code: 0
      },
      cmdToc: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdFastBackward: {
        enabled: false,
        enabledInNarrow: false
      },
      cmdBackward: {
        enabled: true,
        enabledInNarrow: false
      },
      cmdBigBackward: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdForward: {
        enabled: true,
        enabledInNarrow: false
      },
      cmdBigForward: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdFastForward: {
        enabled: false,
        enabledInNarrow: false
      },
      cmdSave: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdPrint: {
        enabled: true,
        enabledInNarrow: false
      },
      cmdFullScreen: {
        enabled: true,
        enabledInNarrow: true
      },
      widSettings: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdSmartPan: {
        enabled: true,
        enabledInNarrow: true,
        active: true,
      },
      cmdSinglePage: {
        enabled: true,
        enabledInNarrow: true,
        active: false,
        activeForMobile: false
      },
      cmdSounds: {
        enabled: true,
        enabledInNarrow: true,
        active: true
      },
      cmdStats: {
        enabled: true,
        enabledInNarrow: true,
        active: false
      },
      cmdLightingUp: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdLightingDown: {
        enabled: true,
        enabledInNarrow: true
      },
      cmdPanLeft: {
        enabled: false
      },
      cmdPanRight: {
        enabled: false
      },
      cmdPanUp: {
        enabled: false
      },
      cmdPanDown: {
        enabled: false
      },
      mouseCmdRotate: {
        enabled: true,
        type: 'mousedrag',
        code: mouseButtons.Right
      },
      mouseCmdDragZoom: {
        enabled: true,
        type: 'mousedrag',
        code: mouseButtons.Middle
      },
      mouseCmdPan: {
        enabled: true,
        type: 'mousedrag',
        code: mouseButtons.Left
      },
      mouseCmdWheelZoom: {
        enabled: true,
        type: 'mousewheel',
        code: 0
      },
      touchCmdRotate: {
        enabled: true,
        type: 'touchdrag',
        code: 3
      },
      touchCmdZoom: {
        enabled: true,
        type: 'touchdrag',
        code: 2
      },
      touchCmdPan: {
        enabled: true,
        type: 'touchdrag',
        code: 1
      },
      touchCmdSwipe: {
        enabled: true,
        type: 'touchdrag',
        code: 1
      }
    }
  };
};
