function standardDeviation(values) {
  var avg = average(values);
  
  var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });
  
  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);

  var avg = sum / data.length;
  return avg;
}

if (!Array.isArray) {
  Array.isArray = function (arr) {
    return arr instanceof Array || Object.prototype.toString.call(arr) == '[object Array]';
  };
}

var tradechart = {
  CANVAS_MARGIN_X: 55,
  CANVAS_MARGIN_Y: 5,

  SMOOTH_LINES: true,

  Types: {
    PLOT: 'plot',
    LINE: 'line'
  },

  _opts: {},

  /** @type {HTMLCanvasElement} */
  _canvas: null,
  /** @type {CanvasRenderingContext2D} */
  _context: null,

  _xStep: NaN,
  _yStep: NaN,

  _scaleX: 1.0,
  _scaleY: 1.0,

  _xRange: [undefined, undefined],
  _yRange: [undefined, undefined],

  _view: {
    xOffset: 0,
    yOffset: 0
  },

  _isDragging: false,

  init: function (canvas, opts) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('element should be a HTMLCanvasElement');
    }

    this._canvas = canvas;
    this._canvas.style.cursor = 'move';
    this._context = this._canvas.getContext('2d');

    if (typeof opts !== 'undefined') {
      if (typeof opts !== 'object') {
        throw new TypeError('opts should be an object or undefined')
      } else {
        this._opts = opts;
      }
    }

    if (!this._opts.type) {
      this._opts.type = this.Types.PLOT;
    }

    this._addEventListeners();

    this._updateData();
    this.render();
  },

  setData: function (data) {
    this._opts.data = data;
    this._updateData();
  },

  _addEventListeners: function () {
    var self = this;

    var startX;
    var startY;

    this._canvas.addEventListener('mousedown', function (event) {
      self._isDragging = true;
      var rect = self._canvas.getBoundingClientRect();
      startX = event.offsetX - rect.left - self._view.xOffset;
      startY = event.offsetY - rect.top - self._view.yOffset;
    });

    this._canvas.addEventListener('mouseup', function (event) {
      self._isDragging = false;
      var rect = self._canvas.getBoundingClientRect();
      startX = event.offsetX - rect.left - self._view.xOffset;
      startY = event.offsetY - rect.top - self._view.yOffset;
    });

    this._canvas.addEventListener('mouseleave', function (event) {
      self._isDragging = false;
    });

    this._canvas.addEventListener('mousemove', function (event) {
      if (self._isDragging) {
        var rect = self._canvas.getBoundingClientRect();
        var canMouseX = event.offsetX - rect.left - self._view.xOffset;
        var canMouseY = event.offsetY - rect.top - self._view.yOffset;

        self._view.xOffset += canMouseX - startX;
        self._view.yOffset += canMouseY - startY;

        requestAnimationFrame(function () {
          self.render();
        });
      }
    });

    this._canvas.addEventListener('mousewheel', function (event) {
      event.preventDefault();

      self._scaleX += event.deltaY * -0.01;
      self._scaleX = Math.max(self._scaleX, 0.1);

      //self._scaleY += event.deltaY * -0.01;
      //self._scaleY = Math.max(self._scaleY, 0.1);

      requestAnimationFrame(function () {
        self.render();
      });
    });
  },

  _convertData: function () {
    var data = this._opts.data;

    if (Array.isArray(data)) {
      this._opts.data = data.map(function (x, i) {
        if (Array.isArray(x)) {
          return {
            key: x[0],
            value: x[1]
          };
        } else if (typeof x === 'object') {
          return {
            key: x.key,
            value: x.value
          };
        } else {
          return {
            key: i,
            value: x
          };
        }
      });
    } else {
      this._opts.data = Object.keys(data).map(function (key) {
        return {
          key: key,
          value: data[key]
        };
      });
    }

    this._opts.data.sort(function (a, b) {
      return b.key - a.key;
    });
  },

  _updateData: function () {
    this._convertData();

    var data = this._opts.data;

    this._xStep = this._yStep = NaN;
    var xRange = this._xRange = [undefined, undefined];
    var yRange = this._yRange = [undefined, undefined];

    var numKeys = 0;
    var xTotal = 0;
    var yTotal = 0;

    function handleKey(key, value) {
      numKeys++;
      
      var keyNumber = parseFloat(key);
      var keyDate = new Date(key);

      if (!isNaN(keyNumber)) {
        key = keyNumber;
        xTotal += keyNumber;
      } else if (!isNaN(keyDate.getTime())) {
        key = keyDate;
        xTotal += keyDate.getTime();
      } else {
        throw new TypeError('Invalid key: "' + key + '". Must be a number or Date.');
      }

      if (xRange[0] === undefined || key < xRange[0]) {
        xRange[0] = key;
      }

      if (xRange[1] === undefined || key > xRange[1]) {
        xRange[1] = key;
      }

      yTotal += value;

      if (yRange[0] === undefined || value < yRange[0]) {
        yRange[0] = value;
      }

      if (yRange[1] === undefined || value > yRange[1]) {
        yRange[1] = value;
      }
    }


    for (var i = 0; i < this._opts.data.length; i++) {
      handleKey(this._opts.data[i].key, this._opts.data[i].value);
    }

    var xAvg = xTotal / numKeys;
    var yAvg = yTotal / numKeys;

    var xSquareDiffs = this._opts.data.map(function (obj) {
      var diff = Number(obj.key) - xAvg;
      var sqrDiff = diff * diff;
      return sqrDiff;
    });

    var ySquareDiffs = this._opts.data.map(function (obj) {
      var diff = obj.value - yAvg;
      var sqrDiff = diff * diff;
      return sqrDiff;
    });

    this._xStep = Math.sqrt(average(xSquareDiffs));
    this._yStep = Math.sqrt(average(ySquareDiffs));
  },

  _getXMin: function () {
    return this._xRange[0] || 0;
  },

  _getXMax: function () {
    return this._xRange[1] || 0;
  },

  _getXScale: function () {
    return this._getXMax() / this._canvas.width;
  },
  
  _getYMin: function () {
    return this._yRange[0] || 0;
  },

  _getYMax: function () {
    return this._yRange[1] || 0;
  },

  _getYScale: function () {
    return this._getYMax() / (this._canvas.height - this.CANVAS_MARGIN_Y * 2);
  },

  _getScaledWidth: function () {
    return this._canvas.width * this._scaleX;
  },
  
  _getScaledHeight: function () {
    return this._canvas.height * this._scaleY;
  },

  _positionForItem: function (key, value, xScale, yScale) {
    var _xScale = xScale;
    var _yScale = yScale;

    if (_xScale == null) {
      _xScale = 1;
    }
    
    if (_yScale == null) {
      _yScale = 1;
    }

    var xPosition = key.valueOf() / this._getXMax();
    var yPosition = value.valueOf() / this._getYMax();

    return [
      (xPosition * this._getScaledWidth()) + this._view.xOffset,
      (this._canvas.height - (yPosition * this._getScaledHeight())) + this._view.yOffset
    ];
  },

  _renderItem: function (key, value, xScale, yScale) {
    var pos = this._positionForItem(key, value, xScale, yScale);
    this._context.fillRect(pos[0], pos[1], 5, 5);
  },

  _clear: function () {
    this._context.save();
    this._context.setTransform(1, 0, 0, 1, 0, 0);
    this._context.fillStyle = '#1B1C1E';
    this._context.fillRect(0, 0, this._canvas.width, this._canvas.height);
    this._context.restore();
  },

  render: function () {
    var context = this._context;

    this._clear();

    if (typeof this._opts.data !== 'object') {
      throw new TypeError('no data provided');
    }

    var xMin = this._getXMin();
    var xMax = this._getXMax();
    var yMin = this._getYMin();
    var yMax = this._getYMax();

    var xScale = this._getXScale();
    var yScale = this._getYScale();

    for (var y = yMin; y < yMax + yMin; y += this._yStep) {
      var lineY = (y - yMin) / yScale;
      lineY *= this._scaleY;
      lineY += this._view.yOffset;

      context.beginPath();
      context.moveTo(0, lineY);
      context.lineTo(this._canvas.width - this.CANVAS_MARGIN_X, lineY);
      context.lineWidth = 1;
      context.strokeStyle = '#555';
      context.stroke();
      
      context.font = Math.max(12, Math.min(25, 15 * this._scaleY)) + 'px Arial';
      context.fillStyle = '#fff';
      context.textBaseline = 'middle';
      context.textAlign = 'left';
      var text = String(Math.floor(((yMax + yMin) - y) * 100) / 100);
      context.fillText(text, this._canvas.width - this._context.measureText(text).width - 5, lineY);
    }

    for (var x = xMin; x < xMax + xMin; x += this._xStep / 10) {
      var lineX = (x - xMin) / xScale
      lineX *= this._scaleX;
      lineX += this._view.xOffset;

      if (lineX < this._canvas.width - this.CANVAS_MARGIN_X) {

        context.beginPath();
        context.moveTo(lineX, this._canvas.height);
        context.lineTo(lineX, 0);
        context.lineWidth = 1;
        context.strokeStyle = '#555';
        context.stroke();
      }
    }

    for (var x = xMin; x < xMax + xMin; x += this._xStep) {
      var lineX = (x - xMin) / xScale
      lineX *= this._scaleX;
      lineX += this._view.xOffset;

      var lineXBefore = lineX;

      if (lineX < this._canvas.width - this.CANVAS_MARGIN_X) {
        context.beginPath();
        context.moveTo(lineX, this._canvas.height - 20);
        context.lineTo(lineX, 0);
        context.lineWidth = 3;
        context.strokeStyle = '#fff';
        context.stroke();

        context.font = Math.max(12, Math.min(25, 15 * this._scaleX)) + 'px Arial';
        context.fillStyle = '#fff';
        context.textBaseline = 'bottom';
        context.textAlign = 'center';
        context.fillText(Math.floor((x - xMin) * 100) / 100, lineX, this._canvas.height);
      }
    }

    this._renderItems(xScale, yScale);
  },

  _renderItems(xScale, yScale) {
    switch (this._opts.type) {
      case this.Types.PLOT:
        for (var i = 0; i < this._opts.data.length; i++) {
          this._renderItem(this._opts.data[i].key, this._opts.data[i].value, xScale, yScale);
        }
        break;
      case this.Types.LINE:
        for (var i = 0; i < this._opts.data.length; i++) {
          var aPos = this._positionForItem(this._opts.data[i].key, this._opts.data[i].value, xScale, yScale);
          this._context.fillRect(aPos[0], aPos[1], 5, 5);

          if (this.SMOOTH_LINES) {
            if (i + 1 < this._opts.data.length) {
              var bPos = this._positionForItem(this._opts.data[i + 1].key, this._opts.data[i + 1].value, xScale, yScale);
              //var cPos = this._positionForItem(this._opts.data[i + 2].key, this._opts.data[i + 2].value, xScale, yScale);

              var mid = [(aPos[0] + bPos[0]) / 2, (aPos[1] + bPos[1]) / 2];

              var cp1 = [(mid[0] + aPos[0]) / 2, (mid[1] + aPos[1]) / 2];
              var cp2 = [(mid[0] + bPos[0]) / 2, (mid[1] + bPos[1]) / 2];


              this._context.beginPath();
              this._context.moveTo(aPos[0], aPos[1]);
              
              this._context.quadraticCurveTo(cp1[0], aPos[1], mid[0], mid[1]);
              this._context.quadraticCurveTo(cp2[0], bPos[1], bPos[0], bPos[1]);
              this._context.lineWidth = 1;
              this._context.strokeStyle = '#eee';
              this._context.stroke();
            }
          } else {
            if (i + 1 < this._opts.data.length) {
              var bPos = this._positionForItem(this._opts.data[i + 1].key, this._opts.data[i + 1].value, xScale, yScale);
              
              this._context.beginPath();
              this._context.moveTo(aPos[0], aPos[1]);
              this._context.lineTo(bPos[0], bPos[1]);

              this._context.lineWidth = 1;
              this._context.strokeStyle = '#eee';
              this._context.stroke();
            }
          }
        }
        break;
      default: throw Error('Unknown chart type "' + String(this._opts.type) + '"');
    }
  }
};