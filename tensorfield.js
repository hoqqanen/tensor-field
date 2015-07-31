var utils = {
  average: function(A) {
    return this.sum(A)/A.length;
  },
  clamp: function(x, min, max) {
    return Math.max(min, Math.min(max, x));
  },
  distance: function(p1, p2) {
    var dx = p1.x - p2.x;
    var dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  },
  sign: function(x) {
    return x < 0 ? -1 : 1;
  },
  sum: function(A) {
    return A.reduce(function(acc, x) {
        return acc + x;
    });
  }
}

$(document).ready(function() {
  var DEBUG_MODE = false;

  if (!DEBUG_MODE) {
    $("#debug").css("visibility", "hidden");
  }

  var c = document.getElementById("tensorfield");
  var ctx = c.getContext("2d");
  // TODO: Allow selection of images/progression of levels.
  // Possibly allow uploading?
  var img = document.getElementById("img_grid");
  c.width = img.width;
  c.height = img.height;
  ctx.drawImage(img,0,0);

  var game = {
    field: ctx.getImageData(0,0,600,800),
    getFieldValue: function(point) {
      var index = 4 * (point.x + this.field.width * point.y);
      var safeIndex = utils.clamp(index, 0, 4 * this.field.width * this.field.height);
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
      })
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
});
