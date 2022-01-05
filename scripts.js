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
let renderArea = document.getElementById('renderArea'); 
let outputCanvas = document.createElement('canvas');
outputCanvas.id = "outputCanvas";
renderArea.appendChild(outputCanvas); 
let canvasContext = outputCanvas.getContext("2d");

let uploadedSVG = '';

let config = {
    simplifyIncrement: 250,
    segmentIncrement: 10,
    roundedCornerRadius:90
}

// apply settings to UI elements. 
for ( setting in config){  
    document.querySelector('#'+setting).value = config[setting] 
}

 

const svgContainer = document.getElementById('svgContainer'); 
const dragAndDrop = document.getElementById('dragAndDrop'); 

// Check if browser supports file drag and drop
if (typeof window.FileReader === 'undefined') {
    // notify users that browser does not support file drag and drop 
    dragAndDrop.innerHTML = '<p>Sorry, drag and drop is not working.</p>';
} else {
    // provide instructions for drag and drop. 
    dragAndDrop.innerHTML = '<p>Drag and drop an .svg file here.</p>';
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
    //console.log('ok');
    reader.onload = function(event) {

        uploadedSVG = event.target.result;
        go();


    };
    reader.readAsText(file);
    return false;
};


function go(){
    
    svgContainer.innerHTML = uploadedSVG;

    let svgElement = svgContainer.querySelector('svg');
    if (svgElement == null){
        return false; 
    }

    // This stransform only affects appearance.
    // but not the actual dimensions of a path.
    // svgElement.setAttribute('transform', 'scale(20)');
    
    // Get SVG dimensions from the viewbox.
    // Account for viewbox delimiter being a comma, space, or both
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox
    let viewBox = svgElement
            .getAttribute('viewBox')
            .replace(',', ' ')
            .replace('  ', ' ')
            .split(' ');
    // let svgMinX = viewBox[0]
    // let svgMinY = viewBox[1]
    let svgWidth = viewBox[2]
    let svgHeight = viewBox[3] 
        
    // set the dimensions of the output canvas to match the viewbox of the SVG.
    // TODO: explore what happens with nonzero  svgMinX, svgMinY?
    outputCanvas.width = svgWidth;
    outputCanvas.height = svgHeight;

    // if your input is tiny then you do run into trouble. 

    // NOTE: viewBox details may also be available via SnapSVG, but I couldn't find them.
    // Snap's "Bounding Box" applies to a path (not a document). For reference:
    // http://snapsvg.io/docs/#Element.getBBox 
    // let bbox = Snap.path.getBBox(path);

    // Use SNAP to extract the first available path from the SVG 
    // there might also be a "polyline" in which case we should convert it to a path.
        
    
    let path = findPath( svgElement ); 

    // if we arrived here we should have a suitable path. 
    // simplify the path by describing it as a set of coordinates
    // we can use the simplified path to construct a "rounded corners" variation.
    let pathAsCoordinates = simplifyPath(path);

    
    let roundedPathString = createRoundedPathString(pathAsCoordinates, config.roundedCornerRadius);    
    
    
    // TODO: Simplify a path with Ramer–Douglas–Peucker algorithm
    // https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm

    svgElement.querySelector('path').setAttribute('d', roundedPathString);
        
    let roundedPath = svgElement.querySelector('path');

    // traverse the rounded path into arc and line segments. 
    for ( segment of pathToSegmentsArray( roundedPath ) ){
        renderSegment(segment)
    }
}


function findPath(svgElement){
 
    // The simple case is when a path element already exists
    //let path = Snap(svgElement).select('path');
    let path = svgElement.querySelector('path');
    //console.log(path);
    if (path !== null) return path;
    
    // If there is a polyline instead of a path.
    // Convert it to a path by recontextualizing the points string.
    let polyline = svgElement.querySelector('polyline');
    if (polyline !== null) {
        console.log('Found polyline.') 
        // https://www.w3.org/TR/SVG/paths.html#PathDataMovetoCommands
        // If a moveto is followed by multiple pairs of coordinates, 
        // the subsequent pairs are treated as implicit lineto commands.
        svgElement.innerHTML = 
            '<path d="M'+ polyline.getAttribute('points') +'">';
        //return Snap(svgElement).select('path');
        return svgElement.querySelector('path');
    }
    
    // If there is a polygon instead of a path.
    // Convert it to a path by recontextualizing the points string.
    let polygon = svgElement.querySelector('polygon');
    if (polygon !== null)    {
        console.log('Found polygon.') 
        // https://www.w3.org/TR/SVG/paths.html#PathDataClosePathCommand
        // The "closepath" (Z or z) ends the current subpath 
        // by connecting it back to its initial point. 
        // TODO: check: do we need to trim any trailing space(s) from polygonString? 
        // TODO: is the Z really a good idea? what does it mean?
         
        svgElement.innerHTML = 
            '<path d="M'+ polygon.getAttribute('points')+'z">'
            
        //return Snap(svgElement).select('path');
        return svgElement.querySelector('path');
    }
 
    
}



  
    // Given a Snap SVG path,
    // describe it as an array of coordinates.
    function simplifyPath(path){
        // http://snapsvg.io/docs/#Element.getTotalLength
        // Get the total length of the path in pixels 
        console.log('ok');
        // TODO: actually you probably dont even need snap to do this. 
        // it is a native feature of the SVG API
        // https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getTotalLength
        //console.log(path);
        let pathLength = path.getTotalLength(); 
        
        console.log(pathLength);
        // prepare an array to hold many coordinates along the path. 
        let coordinates = [];
        
        // Find coordinates incrementally along the path.
        // According to "increment", a percentage value /100
        // decrease this for more precision. 
        // TODO: calculate a level of precision 
        // appropriate for the path's actual pixel length.

        // TODO: understand better the implications of this.
        // do you want more points in cuvy areas?
        // Or do you want all points to be a similar distance apart?
        // https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm

        let pixelIncrement = config.simplifyIncrement; // this comes from the UI
        let percentIncrement = 100 * ( pixelIncrement / pathLength );
        // if the given pixel increment is not workable, use a default. 
        if (percentIncrement > 20){ 
            percentIncrement = 1;
            pixelIncrement = 0.01 * pathLength;
        }

        console.log(
            " Increment by "+pixelIncrement+" pixels. "+
            " This is (roughly) a "+percentIncrement.toFixed(2)+" percent increment "+
            " Given that the path is "+pathLength+" pixels long" 
            );

        for (startPosition = 1; startPosition < 100; startPosition += percentIncrement ){ 
            let positionAsPercentageTraversed = startPosition  / 100 ;
            let positionAsPixelsTraversed = pathLength * positionAsPercentageTraversed;
            let positionAsCoordinates = path.getPointAtLength(positionAsPixelsTraversed);
            coordinates.push(positionAsCoordinates)
        }
        // return segments to imagemagick as "instructions" for further processing.
        return coordinates;  
    }

  // Traverse the path, and divide the path into segments
  // Describe each segment as an arc or a line.
  // (ImageMagick will know how to texture both arcs and lines)
  function pathToSegmentsArray( path ) {
         
    // http://snapsvg.io/docs/#Element.getTotalLength
    // Get the total length of the path in pixels 
    let pathLength = path.getTotalLength(); 
    
    // prepare an array to hold many segments of the path. 
    let segments = [];

    // Each segment will comprise a percentage of the whole length of the path. 
    // we define this percentage as "increment" 
    // a smaller increment will result in smaller segments (e.g. thinner slices)

    let pixelIncrement = config.segmentIncrement; // this comes from the UI
    let percentIncrement = 100 * ( pixelIncrement / pathLength );
    // if the given pixel increment is not workable, use a default. 
    if (percentIncrement > 20){ 
        percentIncrement = 1;
        pixelIncrement = 0.01 * pathLength;
    }

    console.log(
        " Increment by "+pixelIncrement+" pixels. "+
        " This is (roughly) a "+percentIncrement.toFixed(2)+" percent increment "+
        " Given that the path is "+pathLength+" pixels long" 
        );


    // increment percentage-wise along the path
    // TODO: invesitigate whether you can use for(startLocation=0 here
    for (startLocation = 1; startLocation <100; startLocation += percentIncrement ){
        let results = findSegment(path, pathLength, startLocation, percentIncrement);
        // the spread operator ... lets us iteratively push 
        // in case the segment has been split. 
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax

        if (results != false){
            segments.push(...results)
        }
    }
    // return segments to imagemagick as "instructions" for further processing.
    return segments; 
  }

   // Given a Snap path (path) and 
   // Given a percentage position along the path (startLocation) 
   // Find an arc or line to approximate the segment that
   // -begins at startLocation (A) 
   // -passes through startLocation +0.5 (B)
   // -ends at starLocation + 1 (C)
  function findSegment(path, pathLength, startLocation, increment, splitMode = false){
        
        if ((startLocation + increment) > 100) return false;
        if (splitMode){
            console.log('Splitting: increment is now '+increment+' instead of '+(2*increment));            
        }
        // Find points A, B, and C as percentages of the whole path length
        let positionA = ( startLocation ) / 100 ;
        let positionB = ( startLocation + (increment/2) ) / 100;
        let positionC = ( startLocation + increment ) / 100;

        // Find points A, B, and C as pixel position along the path 
        let pixelPositionA = pathLength * positionA;
        let pixelPositionB = pathLength * positionB;
        let pixelPositionC = pathLength * positionC;

        // Find the targeted / approximate pixel length of the resulting arc
        let targetArcLength = pixelPositionC - pixelPositionA;

        // Find points A, B, and C as pixel coordinates
        // http://snapsvg.io/docs/#Element.getPointAtLength
        let A = path.getPointAtLength(pixelPositionA);
        let B = path.getPointAtLength(pixelPositionB);
        let C = path.getPointAtLength(pixelPositionC);

        // ==================================================
        // NOTE: getPointAtLength returns an object like: { x:number, y:number, alpha:number } 
        // For reference, "alpha" is the "angle of derivative", i.e. the "slope of the tangent".
        // ==================================================

        // Store the percentage-based position along the path for future reference. 
        // (e.g. to calculate which pixel-range in the texture image should apply)
        A.position = positionA;
        B.position = positionB;
        C.position = positionC;

        // TODO: find a straight line connecting A and C
        // if B is on (or very near) this line, 
        // it may better approximate the segment than any circle
        // One could compare the slopes of AB and BC 
        // If the slopes are sufficiently similar, 
        // Use a straight line AC instead of a circle.



        // it may be useful to know 
        // if the slopes of the tangents are all within a similar range.
        // keeping in mind that they are cumulative

        let angleABC = findAngle(A,B,C);
        console.log("Angle ABC is "+ angleABC+" Radians or "+toDegrees(angleABC) + " degrees");


        // LINEAR Segments
        // A linear segment has 180 degrees or (π radians)
        // If the angle is less a degree away from "straight"
        // we will consider it straight. 
        // NOTE: 0.5 degrees equals π/360 radians
        if ( ( Math.PI  - angleABC ) <  (Math.PI / 720) ){
            console.log(
                "Angle" + toDegrees(angleABC) + " is treated as linear "+
                "by proximity to 180 degree.");
            let segment = {
                type: 'line',
                start:A,
                end:C,
                A: A,
                B: B,
                C: C
            }
            return [segment];
        }

        // SHARP CORNERS (Acute Angles)
        // if the angle is less than 90 degrees the arc becomes ambiguous. 
        // in this case we must split the segment in half recursively
        // until the curvature reaches an obtuse angle.
        // NOTE: 90 degrees equals π/2 radians

//        if (angleABC < (Math.PI/2) ){

        let thresholdAngle = (Math.PI/2);
        if (angleABC < thresholdAngle ){
            console.log(
                "Angle "+toDegrees(angleABC).toFixed(2) +" is too sharp "+
                "(less than "+toDegrees(thresholdAngle).toFixed(2)+" degrees). "+
                "Segment will be split in two");
            halfIncrement = increment/2;
            firstHalf = findSegment(path, pathLength, startLocation, halfIncrement, true)
            secondHalf = findSegment(path, pathLength, startLocation+halfIncrement, halfIncrement, true)
            return [firstHalf, secondHalf];
        }

        // GENTLE CURVES (Obtuse Angles)
        // If we have a gentle curve, 
        // the angle will be less than 179.5 degrees and greater than 90 degrees. 
        // In this case we can approximate the segment as a circular arc.  

        // TO start, find the circle that passes through points  A, B, and C
        let theCircle = findCircle(A.x, A.y, B.x, B.y, C.x, C.y);  
  
        // ==================================================
        // MATH NOTES:
        // Some detail about the Math for the section below.
        // The central angle to a chord is: 2 * Math.asin( chord / 2 * radius)
        // https://en.wikipedia.org/wiki/Chord_(geometry)
        // In JavaScript, Math.asin() returns a numeric value between 
        // -π/2 and π/2 radians for x between -1 and 1. 
        // If the value of x is outside this range, it returns NaN.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/asin
        // ==================================================

        // Find the angle of the arc whose endpoints are A and C
        let arcChord = findDistance(C.x,C.y, A.x, A.y)
        let arcAngle = 2 * Math.asin( arcChord / theCircle.diameter)
        let arcLength  = (arcAngle / (2*Math.PI) ) * theCircle.circumference;

        //let majorArcAngle = (2*Math.PI) - arcAngle;
        

        // Find the angles of the major and minor arcs whose endpoints are 
        // point A and the point at the top of the circle.
        // This angle corresponds to the amount of rotation applied to the arc of interest
        // HTML Canvas uses the right edge of a circle as a point of reference.
        // ImageMagick uses the top of the circle as a point of reference.


        // there are times when thhis angle with point A doesn't behave well.
        /* {x:A.x, y:A.y},  */
        // while  the angle with point C behaves well.
        /*{x:C.x, y:C.y}, */
        // i dont understand why this is.         
        

        let rotateAngle = findAngle(
                {x:A.x, y:A.y}, 
                {x:theCircle.x, y:theCircle.y}, 
                {x:theCircle.xRight, y:theCircle.yRight}
            )
        console.log(
                "Rotate angle found. Start of arc is: "+rotateAngle+" radians "+
                "or "+toDegrees(rotateAngle)+" degrees from a point on the right edge of the Circle." )
        
        // NOTE: the origin (0,0) of an SVG is at the top left 
        // The y value increases as you move down.
        if (A.y < theCircle.y){
            rotateAngle =  (2 * Math.PI) - rotateAngle


            console.log("Using angle "+rotateAngle+" instead because "+
            "A.y "+A.y+" is less than circle.y "+theCircle.y)
        }
         
        // TODO you might need to calculate the top_radius and the bottom_radius as well
        // otherwise imagemagick will default to its own opinions on the matter.
        // you would need to know the vertical dimensions of the input image. 

        let segment = {
            type: "arc",
            arcAngle: arcAngle, 
            rotateAngle: rotateAngle,
            endAngle: arcAngle + rotateAngle,
            targetArcLength: targetArcLength,
            arcLength: arcLength,
            A: A,
            B: B,
            C: C,
            circle: theCircle
        }
        //console.log( segment );
        // return an array because sometimes there's more than one arc.
        // e.g. when we work recursively. 
        // here it just happens to be an array of one.
        return [segment]; 
   
  }
 



/*
* Thanks to janispritzkau https://stackoverflow.com/a/65186378
* and Mvin https://stackoverflow.com/a/52819132
* Given an array of coordinates [{x:x, y:y}, {x:x, y:y}, ...]
* Generate an SVG path string with rounded corners 
*/

function createRoundedPathString(coords, radius=10, close=false) {
    console.log(coords);
    let path = ""
    const length = coords.length + (close ? 1 : -1)
    for (let i = 0; i < length; i++) {
        const a = coords[i % coords.length]
        const b = coords[(i + 1) % coords.length]
        const t = Math.min(radius / Math.hypot(b.x - a.x, b.y - a.y), 0.5)
        if (i > 0) path += `Q${a.x},${a.y} ${a.x * (1 - t) + b.x * t},${a.y * (1 - t) + b.y * t}`
        if (!close && i == 0) path += `M${a.x},${a.y}`
        else if (i == 0) path += `M${a.x * (1 - t) + b.x * t},${a.y * (1 - t) + b.y * t}`
        if (!close && i == length - 1) path += `L${b.x},${b.y}`
        else if (i < length - 1) path += `L${a.x * t + b.x * (1 - t)},${a.y * t + b.y * (1 - t)}`
    }
    if (close) path += "Z"
    return path
}

    
  // given a starting point {x,y} 
  // and an angle 0..360 and a pixel distance 0..10000,
  // return a second point located nearby
  function findNearbyPoint(x, y, angle, distance ){
    var radAngle = angle * Math.PI / 180; // angle in radians
    var p2 = {x:0, y:0};
    p2.x = x + distance * Math.cos(radAngle);
    p2.y = y + distance * Math.sin(radAngle);
    return p2;
  }

  // Given points A, B, C 
  // Find angle ABC in Radians 
  // Thanks to Walter Stabosz: https://stackoverflow.com/questions/17763392/
  function findAngle(A,B,C) {
    var AB = Math.sqrt(Math.pow(B.x-A.x,2)+ Math.pow(B.y-A.y,2));    
    var BC = Math.sqrt(Math.pow(B.x-C.x,2)+ Math.pow(B.y-C.y,2)); 
    var AC = Math.sqrt(Math.pow(C.x-A.x,2)+ Math.pow(C.y-A.y,2));
    return Math.acos((BC*BC+AB*AB-AC*AC)/(2*BC*AB));
  }
  

  // render segments recursively. 
  // if they have been subdivided, there will be an array
  // instead of an object.
function renderSegment(segment, level = 0){
    if (Array.isArray(segment) ){
        for (subSegment of segment){
            renderSegment(subSegment, level++);
        }
    }
    else{
        if (segment.type =="line") renderLine(segment)  
        // I assume that a line would never happen at level > 0 
        // however an the case of an arc we pass the level along to differentiate.
        if (segment.type =="arc") renderArc(segment, level) 
    }
}

  function renderLine(line){

    // draw a line.
    canvasContext.beginPath();
    canvasContext.moveTo(line.start.x,line.start.y);
    canvasContext.lineTo(line.end.x, line.end.y);
    canvasContext.lineWidth = 50;
    let r = line.A.position * 255;
    let g = 255 - line.A.position * 255;
    let b = randomNumberBetween(1,100)
    canvasContext.strokeStyle = 'rgb('+r+','+g+','+b+', 0.9)';
    canvasContext.stroke();

     // render a dot for context.
     canvasContext.beginPath();
     canvasContext.arc(line.start.x,line.start.y, 2, 0, 2 * Math.PI);
     canvasContext.lineWidth = 2;
     canvasContext.strokeStyle = 'rgb(0,0,0)'
     canvasContext.stroke();

  }

  function renderArc(arc, level){ 
  
    
    if (level > 0){
        console.log('Rendering arc subsegment at level '+level);
        console.log(arc);
    }

    // render a circle for context. 
    canvasContext.beginPath();
    canvasContext.arc(arc.circle.x, arc.circle.y, arc.circle.radius, 0, 2 * Math.PI);
    canvasContext.lineWidth = 2;
    if (level == 1){
        canvasContext.strokeStyle = 'rgb(255,255,0, 1)'
    }
    else if (level > 1){
        canvasContext.strokeStyle = 'rgb(255,150,0, 1)'
    }
    else{
        canvasContext.strokeStyle = 'rgb(100,100,100, 0.5)'
    }
    
    canvasContext.stroke();

    canvasContext.beginPath();
    canvasContext.arc(
        arc.circle.x,
        arc.circle.y,
        arc.circle.radius,
        arc.rotateAngle,
        arc.endAngle
    );    

    console.log( 'drawing an arc starting at point A '+(arc.A.position * 100)+' percent along path.'+
        ' using  circle centered at '+ arc.circle.x+','+arc.circle.y+
        ' with radius '+arc.circle.radius+
        ' and rotate angle '+arc.rotateAngle+' ( '+toDegrees(arc.rotateAngle) +' degrees) '+
        ' and end angle '+arc.endAngle+' ( '+toDegrees(arc.endAngle) +' degrees) '
        )

    canvasContext.lineWidth = 80;
    let r = arc.A.position * 255;
    let g = 255 - arc.A.position * 255;
    let b = randomNumberBetween(100,200)
    canvasContext.strokeStyle = 'rgba('+r+','+g+','+b+', 0.8)';
    canvasContext.stroke();

    // render a dot for context.
    canvasContext.beginPath();
    canvasContext.arc(arc.A.x,arc.A.y, 2, 0, 2 * Math.PI);
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = 'rgb(255,0,0)'
    canvasContext.stroke();

    // render a dot for context.
    canvasContext.beginPath();
    canvasContext.arc(arc.B.x,arc.B.y, 2, 0, 2 * Math.PI);
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = 'rgb(0,255,0)'
    canvasContext.stroke();


  }

    function toDegrees(radians){
        return radians * (180/Math.PI);
    }

function randomNumberBetween(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

  function randomColor() {
    var o = Math.round, r = Math.random, s = 255;
    return 'rgb(' + o(r()*s) + ',' + o(r()*s) + ',' + o(r()*s)  + ')';
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

// given two points, find the slope of the line between them.
function findSlope(x1, y1, x2, y2) {
    return (y2 - y1) / (x2 - x1);
}

// compare two slopes for similarity.
// use a lower difference threshold for greater sensitivity.
function slopesAreSimilar(slopeOne, slopeTwo){
    let threshold = 0.5
    if ( Math.abs(slopeOne - slopeTwo) < threshold ){ 
        console.log('Slopes '+slopeOne+' and '+slopeTwo+' are similar')
        return true
    }
    return false
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

    

    //console.log("Centre = (" + h + ", "+ k +")");
    // number.toFixed(digits) represents a number as a string with a given precision (i.e. the number of digits after the decimal)
	//console.log( "Radius = " + r.toFixed(5)); 

    // return a decription of the circle
    // x,y coordinates of center
    // xTop,yTop, coordinates of circle top.
    // xRight,yRight: coordinates of circle right
    
    return {
        x: h,
        y: k,
        xTop: h,
        yTop: k + r,
        xRight: h + r,
        yRight: k,
        radius: r,
        diameter: 2 * r,
        circumference: 2 * Math.PI * r
    }
	
}



document.querySelectorAll('#configArea input').forEach(el => {
    el.addEventListener('change', (event) => {
        console.log(config)
        config[event.target.id] = parseInt(event.target.value);
        console.log(config)
        go();
    });
});
 

 

