var DEBUG_MODE = false;
var DRAW_PATHS = true;

var utils = {
  average: function(A) {
    return this.sum(A)/A.length;
  },
  clamp: function(x, min, max) {
    return Math.max(min, Math.min(max, x));
  },
  closestPoints: function(p, points, n) {
    var me = this;
    return points.sort(function (p1, p2) {
      return me.distance(p1, p) - utils.distance(p2, p);
    }).slice(0,n);
  },
  distance: function(p1, p2) {
    var dx = p1.x - p2.x;
    var dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  },
  identity: function(x) {return x;},
  sign: function(x) {
    return x < 0 ? -1 : 1;
  },
  sum: function(A) {
    return A.reduce(function(acc, x) {
        return acc + x;
    });
  },
  /**
    * A: array of T
    * weight: function from T -> number, preferably in range [0,1]
    * opt_accessor: function from T -> number
    */
  weightedAverage: function(A, weight, opt_accessor) {
    var accessor = opt_accessor || utils.identity;
    return this.sum(A.map(function (a) {
      return accessor(a) * weight(a);
    }));
  }
}

$(document).ready(function() {
  if (!DEBUG_MODE) {
    $("#debug").css("visibility", "hidden");
  }

  var game = {
    ctx: undefined,
    initField: function(data) {
      var c = document.getElementById("tensorfield");
      this.ctx = c.getContext("2d");
      if (data.image) {
        var img = document.getElementById("img_grid");
        c.width = data.width;
        c.height = data.height;
        this.ctx.drawImage(img,0,0, data.width, data.height);
      } else if (data.points && data.width && data.height) {
        c.width = data.width;
        c.height = data.height;
        var d = this.ctx.createImageData(c.width,c.height);
        for (var i = 0; i < data.width; i++) {
          for (var j = 0; j < data.height; j++) {
            var nPoints = 3; // triangulize
            var point = {x: i, y: j};
            var closest = utils.closestPoints(point, data.points, nPoints);
            var distanceSum = utils.sum(closest.map(function(p) {
              return utils.distance(p, point);
            }));
            var value = Math.floor(utils.weightedAverage(closest, function (p) {
              return 1 - (utils.distance(point, p) / distanceSum);
            }, function (p) { return p.value; }) / (nPoints - 1));

            var dataIndex = 4 * (i + c.width * j);
            d.data[dataIndex] = value; d.data[dataIndex + 1] = value; d.data[dataIndex + 2] = value; d.data[dataIndex + 3] = 255;
          }
        }
        this.ctx.putImageData(d, 0, 0);
      }
      this.field = this.ctx.getImageData(0,0,c.width,c.height);
    },
    field: undefined,
    getFieldValue: function(point) {
      var index = 4 * (point.x + this.field.width * point.y);
      var safeIndex = utils.clamp(index, 0, 4 * this.field.width * this.field.height);
      if (DRAW_PATHS) {
        var d = this.field;
        d.data[safeIndex + 2] = 255;
        this.ctx.putImageData(d, 0, 0);
      }
      return this.field.data[safeIndex];
    },
    /*
     * Quadrangulates the value given its four neighbor pixels based on
     * how close they are, effectively smoothing the discrete pixel data.
    */
    quadrangulatedValue: function(point) {
      var me = this;
      if (Math.floor(point.x) === point.x && Math.floor(point.y) === point.y) {
        return me.getFieldValue(point);
      }
      var neighbors = [
        {x: Math.floor(point.x), y: Math.floor(point.y)},
        {x: Math.ceil(point.x), y: Math.floor(point.y)},
        {x: Math.floor(point.x), y: Math.ceil(point.y)},
        {x: Math.ceil(point.x), y: Math.ceil(point.y)}
      ];
      var deviations = neighbors.map(function(n) {
        return utils.distance(n, point);
      });
      var S = utils.sum(deviations);
      var ratios = deviations.map(function(d) {
        return d/S;
      });
      return utils.sum(
        neighbors.map(function(n, i) {
          return me.getFieldValue(n)*ratios[i];
        })
      );
    },
    currentAngle: undefined,
    currentPosition: undefined,
    state: "selecting_point",
    // Magic parameters. Your mileage may vary.
    velocity: 10,
    stepSize: 1,
    positionMote: function(point) {
      this.mote.css("top", point.y + this.canvas.position().top - this.mote.height()/2 + "px");
      this.mote.css("left", point.x + this.canvas.position().left - this.mote.width()/2 + "px");
    },
    selectStart: function(point) {
      this.currentPosition = point;
      this.positionMote(point);
      this.state = "selecting_angle";
    },
    selectAngle: function(point) {
      var dy = this.currentPosition.y - point.y;
      var dx = point.x - this.currentPosition.x;
      if (dx === 0) {
        this.currentAngle = Math.PI/2;
      } else if (dx < 0) {
        this.currentAngle = Math.tan(dy/dx) + Math.PI * utils.sign(dy/dx);
      } else {
        this.currentAngle = Math.tan(dy/dx)
      }
      this.state = "running";
      this.run();
    },
    recomputeAngle: function() {
      var dTheta = Math.PI * ((this.quadrangulatedValue(this.currentPosition) / 127.5) - 1);
      this.currentAngle += dTheta / this.velocity;
    },
    stepForward: function() {
      var dx = Math.cos(this.currentAngle) * this.stepSize;
      var dy = Math.sin(this.currentAngle) * this.stepSize;
      this.currentPosition = {
        x: this.currentPosition.x + dx,
        y: this.currentPosition.y + dy
      };
    },
    run: function() {
      var me = this;
      $("#debug").html(
        Math.floor(me.currentPosition.x) + ", " +
        Math.floor(me.currentPosition.y) + " - " +
        Math.floor(me.currentAngle * 180 / Math.PI));
      if (this.state === "running") {
        me.recomputeAngle(me.currentPosition);
        me.stepForward();
        me.positionMote(me.currentPosition);
        window.requestAnimationFrame(function(){me.run();});
      }
    },
    reset: function() {
      this.state = "selecting_point";
    },
    mote: $("#mote"),
    canvas: $("#tensorfield"),
  }

  $("#tensorfield").on("mousemove", function(e) {
    var point = {
      x: e.offsetX,
      y: e.offsetY
    };
    $("#debug").html(
      point.x + ", " + point.y + " . . . " +
      game.getFieldValue(point)
    );
  });

  $("#tensorfield").on("mousedown", function(e) {
    var point = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (game.state === "selecting_point") {
      game.selectStart(point);
    } else if (game.state === "selecting_angle") {
      game.selectAngle(point);
    } else if (game.state === "running") {
      game.reset();
    }

  });

  var randomPoints = [1,2,3,4,4,4,4,4,4,4,4].map(function() {
    return {
      x: Math.random()*400,
      y: Math.random()*400,
      value: Math.random()*255
    }
  });
  var radialGradient = [
    {x: 200, y: 200, value: -30},
    {x: 400, y: 400, value: 255},
    {x: 0, y: 400, value: 255},
    {x: 400, y: 0, value: 255},
    {x: 0, y: 0, value: 255}
  ];

  game.initField({
    points: radialGradient,
    width: 400,
    height: 400
  });
});
