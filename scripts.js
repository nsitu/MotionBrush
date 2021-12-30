
var textureImg = new Image();
textureImg.crossOrigin = 'anonymous';
textureImg.src = 'sloth-wide.jpg';
var textureCanvas = document.getElementById('canvas');
var textureContext = textureCanvas.getContext('2d');
textureImg.onload = function() {
    textureCanvas.width = textureImg.width;
    textureCanvas.height = textureImg.height;
    textureContext.drawImage(textureImg, 0, 0);
    textureImg.style.display = 'none';
}; 

function pick(x,y) {
  let pixel = textureContext.getImageData(x, y, 1, 1);
  let data = pixel.data;
  return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
}


const holder = document.getElementById('holder'); 
const status = document.getElementById('status');


  if (typeof window.FileReader === 'undefined') {
      holder.innerHTML = 'Sorry, drag and drop is not working.';
  } else {
      holder.innerHTML = 'Drag and drop an .svg file here.';
  }

  holder.ondragover = function() {
      this.className = 'hover';
      return false;
  };
  holder.ondragend = function() {
      this.className = '';
      return false;
  };
  holder.ondrop = function(e) {
      this.className = ''; 
      e.preventDefault();
      var file = e.dataTransfer.files[0],
      // https://developer.mozilla.org/en-US/docs/Web/API/FileReader 
      // FileReader asynchronously reads files (or raw data buffers) using File or Blob objects
      reader = new FileReader();
      reader.onload = function(event) {

            //console.log(event);

        var s = Snap("#svg");
        var graphic = Snap.parse( event.target.result );
        var path = graphic.select("path");

        // NOTE: .selectAll() gives an array of results instead of the first result
        // var paths = graphic.selectAll("path");

        // NOTE: it's possible to run transforms on elements
        // http://snapsvg.io/docs/#Element.transform
        // However such transforms do not seem to affect the actual locations of points. 
        // as such they do not make a difference for 

        // Get the bounding box of the SVG;
        // We use this later to resize the output canvas.
          let bbox = Snap.path.getBBox(path);
          let theWidth = bbox.width;
          let theHeight = bbox.height;

            // I tried scaling down the SVG by halving the bounding box 
            // but it did not seem to affect subsequent Cubics
            // A viewbox has 4 params:  min-x, min-y, width and height
            // let viewBox = bbox.x+' '+bbox.y+' '+(bbox.width/2)+' '+ (bbox.height/2);
            // console.log(viewBox);
            // path.attr({  viewBox: viewBox })
           
            // http://snapsvg.io/docs/#Element.getTotalLength
            // Get the length of the path in pixels 
            let pathLength = path.getTotalLength();

            // console.log(pathLength);
            // can you loop through the points along the path? 

            // Keep track of the slope of the curve from point to point.
            let slope;
            
            // Given that we know the total length of the path.
            // Given that any point on the path can be found by its distance from the start
            // We can traverse the path by incrementing percentage-wise along its length
            // - to divide a path into  100 points,  increment by 1 percent
            // - to divide a path into  1000 points,  increment by 0.1 percent

            for (i = 1; i <100; i+=0.1){
                
                // http://snapsvg.io/docs/#Element.getPointAtLength
                // Find a point at i percent along the path
                // Get position as pixels from start of path
                var position = i * pathLength / 100;
                let p1 = path.getPointAtLength(position);

                // NOTE: getPointAtLength returns an object like this:
                // { x:number, y:number, alpha:number } 
                // "alpha" here is the "angle of derivative". 
                // I take this to mean the "slope of the tangent"

                // Tangent Line: a straight line that "just touches" a curve at a given point
                // Normal Line: a straight line perpendicular to a tangent line at a given point on a curve

                // Find the change in tangent slope between the this point and the previous point.
                var deltaSlope = Math.abs(p1.alpha - slope);
                // Update the "previous slope" in preparation for the next iteration
                slope = p1.alpha;

                // TODO: Perhaps we could keep a history of recent slopes here
                // This could allow us access to a rolling average 
                // This could be useful to smooth out dramatic curves.
                // slopes.push(p1.alpha);
                // if (slopes.length == 5) { slopes.shift(); } 
                // console.log(slopes);
                // var avgSlope = slopes.reduce((a,b) => (a+b)) / slopes.length;

                // Hmm: I think this line helps to deal with sharp corners?
                // I need to study this more in depth.
                if (deltaSlope > 300) deltaSlope = 360 - deltaSlope;
                // if (deltaSlope >  180 && p1.alpha > slope) { deltaSlope = Math.abs(p1.alpha - 360) - slope; } 
                // else{ deltaSlope = Math.abs(slope - 360) - p1.alpha;  }
                //console.log(deltaSlope );

                // http://snapsvg.io/docs/#Paper.circle
                // mark the point with a black circle  (radius 4)
                s.circle(p1.x, p1.y, 4).attr({ fill:"#000000" });  

                // TODO: to simplify the below loop make a new path for the normal line 
                // and traverse it with getPointAtLength as above.
                for(j = 10; j < 100; j+=5){

                    var tX = (textureImg.width * i /100);
                    var tY = (textureImg.height * j /100);
                    
                    var theColor = pick(tX,tY);
                   // console.log(theColor);
                    var ln =  getPoint(p1.x, p1.y, p1.alpha + 90, j + (deltaSlope*2) );
                    

                    
                    // TODO: fix Error: <circle> attribute cx: Expected length, "NaN".
                        try{
                            s.circle(ln.x, ln.y, 2).attr({ fill: theColor });  
                        }
                        catch{
                            console.log(ln);

                        }
                    

                    var rn =  getPoint(p1.x, p1.y, p1.alpha + 90, - j -(deltaSlope*2) );
                    s.circle(rn.x, rn.y, 2).attr({ fill: theColor });  

                    // s.line(p1.x, p1.y, p2.x, p2.y);                    
                    
                }


            }

            // renderPath( Snap.path.toCubic(path) );
            //    console.log(cubic);
            //    path.attr({stroke: "#ffcc00", fill:"transparent", transform: "s.8" , strokeWidth: 20 });           
            //     path.attr({stroke: "#ffcc00", fill:"transparent", strokeWidth: 20 });           
            //var g = s.group().append( path );
      };
      reader.readAsText(file);
      return false;
  };


  // given a starting point {x,y} an angle 0..360 and a pixel distance 0..10000, return a second point. 
  function getPoint(x, y, angle, distance ){
    var radAngle = angle * Math.PI / 180; // angle in radians
    var p2 = {x:0, y:0};
    p2.x = x + distance * Math.cos(radAngle);
    p2.y = y + distance * Math.sin(radAngle);
    return p2;
  }

  // takes a cubic path as per http://snapsvg.io/docs/#Snap.path.toCubic
  // renders the path to HTML5 Canvas
  function renderPath(cubic){
    var c = document.getElementById("myCanvas");
    c.style.width = "300px";
    var ctx = c.getContext("2d");
    ctx.lineWidth = 15;
    ctx.beginPath();
    // loop through all the segments. 
    for(var i = 0; i < cubic.length; i++){
        var seg = cubic[i]; 
        
        //console.log(seg);
        seg = seg.map(i =>{ return (isNaN(i) && i!="M" && i!="C") ? 0 : i});  

      //  console.log(seg);

        if (i != 0){ 
            var prev = cubic[i-1];
            var prev = prev.map(i =>{ return (isNaN(i) && i!="M" && i!="C") ? 0 : i});  
        }
        // sometimes the values are NaN instead of zero so lets fix it.
        
        if (seg[0] == "M"){
            var x = seg[1] || 0;
            var y = seg[2] || 0;

            ctx.moveTo(x, y);
        } 
        else if(seg[0] == "C"){
            //ctx.quadraticCurveTo(20, 100, 200, 20);  
            // See also: https://www.w3schools.com/tags/canvas_beziercurveto.asp

            var p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t;
            if (prev.length == 3){
                p1x = prev[1];
                p1y = prev[2];
            }
            else if(prev.length == 7){
                p1x = prev[5];
                p1y = prev[6];
            }
            c1x = seg[1];
            c1y = seg[2];
            c2x = seg[3];
            c2y = seg[4];
            p2x = seg[5];
            p2y = seg[6];
            t = 0.5;


            var midPointOfSegment = Snap.path.findDotsAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t)
            //console.log(midPointOfSegment);
            
            //console.log( ctx.bezierCurveTo(seg[1], seg[2], seg[3], seg[4], seg[5], seg[6]) ) ;
        }

        //console.log(seg);
        // the first point is usually a regular "Move"
        
        // C stands for Cubic?
        
    }
    ctx.stroke();

  }


  function saveCanvasImage(){
    var myCanvas = document.getElementById('myCanvas');
    var link = document.getElementById('imageLink');
    link.setAttribute('download', 'MintyPaper.png');
    link.setAttribute('href', myCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
    link.click();
  }



// Function to find the circle on which the given three points lie
// https://www.geeksforgeeks.org/equation-of-circle-when-three-points-on-the-circle-are-given/
function findCircle(x1, y1, x2, y2, x3, y3)
{
	var x12 = (x1 - x2);
	var x13 = (x1 - x3);

	var y12 =( y1 - y2);
	var y13 = (y1 - y3);

	var y31 = (y3 - y1);
	var y21 = (y2 - y1);

	var x31 = (x3 - x1);
	var x21 = (x2 - x1);

	//x1^2 - x3^2
	var sx13 = Math.pow(x1, 2) - Math.pow(x3, 2);

	// y1^2 - y3^2
	var sy13 = Math.pow(y1, 2) - Math.pow(y3, 2);

	var sx21 = Math.pow(x2, 2) - Math.pow(x1, 2);
	var sy21 = Math.pow(y2, 2) - Math.pow(y1, 2);

	var f = ((sx13) * (x12)
			+ (sy13) * (x12)
			+ (sx21) * (x13)
			+ (sy21) * (x13))
			/ (2 * ((y31) * (x12) - (y21) * (x13)));
	var g = ((sx13) * (y12)
			+ (sy13) * (y12)
			+ (sx21) * (y13)
			+ (sy21) * (y13))
			/ (2 * ((x31) * (y12) - (x21) * (y13)));

	var c = -(Math.pow(x1, 2)) - Math.pow(y1, 2) - 2 * g * x1 - 2 * f * y1;

	// eqn of circle be
	// x^2 + y^2 + 2*g*x + 2*f*y + c = 0
	// where centre is (h = -g, k = -f) and radius r
	// as r^2 = h^2 + k^2 - c
	var h = -g;
	var k = -f;
	var sqr_of_r = h * h + k * k - c;

	// r is the radius
	var r = Math.sqrt(sqr_of_r);

	document.write("Centre = (" + h + ", "+ k +")" + "<br>");
	document.write( "Radius = " + r.toFixed(5));
}

var x1 = 1, y1 = 1;
var x2 = 2, y2 = 4;
var x3 = 5, y3 = 3;
findCircle(x1, y1, x2, y2, x3, y3);


