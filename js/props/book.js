
export function props(style = 'volume') {
  // const props = {
  //   height,
  //   width,
  //   gravity,
  //   injector,
  //   cachedPages,
  //   renderInactivePages,
  //   renderWhileFlipping,
  //   pagesForPredicting,
  //   preloadPages,
  //   sheet: {
  //     startVelocity,
  //     cornerDeviation,
  //     flexibility,
  //     flexibleCorner,
  //     bending,
  //     wave,
  //     shape,
  //     widthTexels,
  //     heightTexels,
  //     color,
  //     sideTexture
  //   },
  //   cover: {
  //     ...sheet,
  //     padding,
  //     binderTexture,
  //     depth,
  //     mass
  //   },
  //   page: {
  //     ...sheet,
  //     depth,
  //     mass
  //   }
  // };

  const def = {
    height: 0.297,
    width: 0.21,
    gravity: 1,
    cachedPages: 50,
    renderInactivePages: true,
    renderInactivePagesOnMobile: true,
    renderWhileFlipping: false,
    pagesForPredicting: 5,
    preloadPages: 5,
    rtl: false,
    sheet: {
      startVelocity: 1.1,
      cornerDeviation: 0.25,
      flexibility: 10,
      flexibleCorner: 0.5,
      bending: 11,
      wave: 0.5,
      shape: 0,
      widthTexels: 5*210,
      heightTexels: 5*297,
      color: 0xFFFFFF,
      side: 'color'
    },
    cover: {
      binderTexture: '',
      depth: 0.0003,
      padding: 0,
      mass: 0.001
    },
    page: {
      depth: 0.0001,
      mass: 0.001
    },
    cssLayerProps: {
      width: 1024
    }
  },
  styles = {
    volume: def,
    flat: {
      ...def,
      sheet: {
        ...def.sheet,
        wave: 0.05,
        side: 'transparent'
      },
      cover: {
        ...def.cover,
        depth: 0.00002
      },
      page: {
        ...def.page,
        depth: 0.00001
      }
    },
    'volume-paddings': {
      ...def,
      cover: {
        ...def.cover,
        padding: 0.0025
      }
    }
  };
  return styles[style] || def;
};
