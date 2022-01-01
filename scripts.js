// TODO if you have a really wide format image you could split it into an array of tiles
// perhaps you can use a Panorama class to do this.
let textureImg = new Image();
textureImg.crossOrigin = 'anonymous';
textureImg.src = 'sloth-wide.jpg';
textureImg.onload = function() {
    // TODO pass the image along to imagemagick?
}; 

// this is a place to reassemble all the warped segments created by imagemagick.
// it should have at minimum the same dimensions as our input SVG
let outputCanvas = document.createElement('canvas');
outputCanvas.id = "outputCanvas";
document.body.appendChild(outputCanvas);
// TODO: set dimensions to match SVG
 

const dragAndDrop = document.getElementById('dragAndDrop'); 
const status = document.getElementById('status');

// Check if browser supports file drag and drop
if (typeof window.FileReader === 'undefined') {
    // notify users that browser does not support file drag and drop 
    dragAndDrop.innerHTML = 'Sorry, drag and drop is not working.';
} else {
    // provide instructions for drag and drop. 
    dragAndDrop.innerHTML = 'Drag and drop an .svg file here.';
}

// hover styling for drag and drop
dragAndDrop.ondragover = function() {
    this.className = 'hover';
    return false;
}
dragAndDrop.ondragend = function() {
    this.className = '';
    return false;
}

dragAndDrop.ondrop = function(e) {
    // TODO: check that file format is SVG
    this.className = '' 
    e.preventDefault()
    // https://developer.mozilla.org/en-US/docs/Web/API/FileReader 
    // FileReader asynchronously reads files (or raw data buffers) using File or Blob objects
    let file = e.dataTransfer.files[0]
    let reader = new FileReader()
    console.log('ok');
    reader.onload = function(event) {
        console.log('start');
        let graphic = Snap.parse( event.target.result );
        let path = graphic.select("path");
        // NOTE: you can also select an array of results instead of just the first: 
        // ie. let paths = graphic.selectAll("path");
        let segments = traversePath( path );
        console.log(segments);
    };
    reader.readAsText(file);
    return false;
};

  // traverse the path 
  // divide the path into segments
  // describe each segment as an arc
  // return an array of arcs to be used by imagemagick for making warps
  function traversePath( path ) {
    console.log('traversePath');
    // Get the bounding box of the SVG; 
    // Resize the output canvas to match provided SVG
    let bbox = Snap.path.getBBox(path);
    outputCanvas.style.height = bbox.height;
    outputCanvas.style.width = bbox.width; 
         
    // http://snapsvg.io/docs/#Element.getTotalLength
    // Get the length of the path in pixels 
    let pathLength = path.getTotalLength(); 
    
    // Let's divide the path into an array of segments
    let segments = [];

    // Each segment will comprises a percentage of the whole length of the path. 
    // we define this percentage as "increment" 
    // a smaller increment will result in smaller segments (e.g. thinner slices)
    let increment = 1; 

    // increment percentage-wise along the path
    // TODO: invesitigate whether you can use for(startLocation=0 here
    for (startLocation = 1; startLocation <100; startLocation += increment ){
        let segment = processSegment(path, pathLength, startLocation, increment);
        segments.push(segment);
    }
    // return segments to imagemagick as "instructions" for further processing.
    return segments; 
  }

   // Given a Snap path (path) and 
   // Given a percentage position along the path (startLocation) 
   // Find an arc to approximate the segment that
   // -begins at startLocation (A) 
   // -passes through startLocation +0.5 (B)
   // -ends at starLocation + 1 (C)
  function processSegment(path, pathLength, startLocation, increment){
      
        console.log('processSegment');
        // Find points A, B, and C as percentages of the whole path length
        let positionA = pathLength * ( startLocation ) / 100 ;
        let positionB = pathLength * ( startLocation + (increment/2) ) / 100;
        let positionC = pathLength * ( startLocation + increment ) / 100;

        // Find the targeted / approximate length of the resulting arc
        let targetArcLength = positionC - positionA;

        // Find points A, B, and C as pixel coordinates
        // http://snapsvg.io/docs/#Element.getPointAtLength
        let A = path.getPointAtLength(positionA);
        let B = path.getPointAtLength(positionB);
        let C = path.getPointAtLength(positionC);

        // ==================================================
        // NOTE: getPointAtLength returns an object like: { x:number, y:number, alpha:number } 
        // For reference, "alpha" is the "angle of derivative", i.e. the "slope of the tangent".
        // ==================================================

        // Store the percentage-based position along the path for future reference. 
        // (e.g. to calculate which pixel-range in the texture image should apply)
        A.position = positionA;
        B.position = positionB;
        C.position = positionC;

        // find the circle that passes through points  A, B, and C
        let theCircle = findCircle(A.x, A.y, B.x, B.y, C.x, C.y);

        // ==================================================
        // MATH NOTES:
        // Some detail about the Math for the section below.
        // The central angle to a chord is:  2 * Math.asin( chord / 2 * radius)
        // https://en.wikipedia.org/wiki/Chord_(geometry)
        // In JavaScript, Math.asin() returns a numeric value between 
        // -π/2 and π/2 radians for x between -1 and 1. 
        // If the value of x is outside this range, it returns NaN.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/asin
        // ==================================================

        // Find the angles of the major and minor arcs whose endpoints are A and C
        let arcChord = findDistance(C.x,C.y, A.x, A.y)
        let minorArcAngle = 2 * Math.asin( arcChord / theCircle.diameter)
        let majorArcAngle = Math.PI - minorArcAngle;
        // Determine whether to use the major or minor arc based on proximity to target/expected arc length.
        let minorArcLength  = (minorArcAngle/ Math.PI) * theCircle.circumference;
        let majorArcLength = (majorArcAngle/ Math.PI) * theCircle.circumference;
        if ( Math.abs(targetArcLength - minorArcLength) < Math.abs(targetArcLength - majorArcLength) ){
            arcAngle = minorAngle;
            arcLength = minorArcLength;
        }
        else{
            arcAngle = majorAngle;
            arcLength = majorArcLength;
        }

        // Find the angles of the major and minor arcs whose endpoints are 
        // point A and the point at the top of the circle.
        // This angle corresponds to the amount of rotation applied to the arc of interest
        let rotateChord = findDistance(theCircle.x,theCircle.yTop, A.x, A.y)
        let minorRotateAngle = 2 * Math.asin( rotateChord / theCircle.diameter)
        let majorRotateAngle = Math.PI - minorRotateAngle
        // determine whether to use the major or minor arc based on the sign of point A.
        if (A.x < 0){
            rotateAngle = minorRotateAngle;
        }
        else{
            rotateAngle = majorRotateAngle;
        }

        // TODO you might need to calculate the top_radius and the bottom_radius as well
        // otherwise imagemagick will default to its own opinions on the matter.
        // you would need to know the vertical dimensions of the input image. 

        let arc = {
            arcAngle: arcAngle,
            rotateAngle: rotateAngle,
            targetArcLength: targetArcLength,
            arcLength: arcLength,
            A: A,
            B: B,
            C: C,
            circle: theCircle
        }
        console.log( arc );
        return arc;
   
  }
 

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
    var c = document.getElementById("canvas");
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
    var myCanvas = document.getElementById('canvas');
    var link = document.getElementById('imageLink');
    link.setAttribute('download', 'MintyPaper.png');
    link.setAttribute('href', myCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
    link.click();
  }


// Calculatedist the distance between two points
function findDistance(x1, y1, x2, y2) { 
	let xDiff = x1 - x2; 
	let yDiff= y1 - y2; 
	return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}


// Find the center and radius for a circle that passes through 3 given points.
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

	var sx13 = Math.pow(x1, 2) - Math.pow(x3, 2); //x1^2 - x3^2
	var sy13 = Math.pow(y1, 2) - Math.pow(y3, 2); // y1^2 - y3^2
	var sx21 = Math.pow(x2, 2) - Math.pow(x1, 2);
	var sy21 = Math.pow(y2, 2) - Math.pow(y1, 2);

	var f = ((sx13) * (x12) + (sy13) * (x12) + (sx21) * (x13) + (sy21) * (x13)) / (2 * ((y31) * (x12) - (y21) * (x13)));
	var g = ((sx13) * (y12) + (sy13) * (y12) + (sx21) * (y13) + (sy21) * (y13)) / (2 * ((x31) * (y12) - (x21) * (y13)));
	var c = -(Math.pow(x1, 2)) - Math.pow(y1, 2) - 2 * g * x1 - 2 * f * y1;

	// Equation of circle is: x^2 + y^2 + 2*g*x + 2*f*y + c = 0
	// Where centre is (h = -g, k = -f) and radius r as r^2 = h^2 + k^2 - c
	var h = -g;
	var k = -f;
	var sqr_of_r = h * h + k * k - c;

	var r = Math.sqrt(sqr_of_r); // r is the radius

    // find the y-coordinate of the top of the circle
    let yTop = k + r;

    console.log("Centre = (" + h + ", "+ k +")");
    // number.toFixed(digits) represents a number as a string with a given precision (i.e. the number of digits after the decimal)
	console.log( "Radius = " + r.toFixed(5)); 

    // return a decription of the circle
    // x - x-coordinate of center
    // y - y-coordinate of center
    // r - radius of circle
    // t - y coordinate of top of circle
    return {
        x: h,
        y: k,
        radius: r,
        diameter: 2 * r,
        circumference: 2 * Math.PI * r,
        yTop: yTop
    }
	
}


