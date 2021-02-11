import React from 'react';
import QrCode from './qr-code.js';

export default class QrImageStyle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
        image: null,
        prevContent: this.props.qrContent
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.content !== state.prevContent) {
      const qr = document.createElement('canvas');
      QrCode.render({
        text: props.content,
        radius: 0.5, // 0.0 to 0.5
        ecLevel: 'Q', // L, M, Q, H
        fill: {
          type: 'radial-gradient', // or 'linear-gradient'
          position: [ 0.5,0.5,0, 0.5,0.5,0.75 ], //xPos,yPos,radius of inner and outer circle where position is 0-1 of full dimension
          colorStops: [
              [ 0, '#376ab4' ], //from 0 to 100% (0-1)
              [ 1, '#000034' ],
          ]
        }, // foreground color
        background: null, // color or null for transparent
        size: props.size // in pixels
      }, qr);

      return {
        prevContent: props.content,
        image: qr.toDataURL('image/png')
      };
    }
    return null;
  }

  render() {
    return <img { ...this.props }src={this.state.image} alt="QR"/>;
  }
}
