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
    roundedCornerRadius:10,
    sharpAngleThreshold: 90
}

// apply settings to UI elements. 
for ( setting in config){  
    let rangeSlider = document.querySelector('#'+setting);
    rangeSlider.value = config[setting] 
    rangeSlider.nextElementSibling.value = config[setting] 
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
    
    svgContainer.style.display = "block";

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

    // TODO: create a UI checkbox option to toggle 
    // whether the path will be simplified 


    // if we arrived here we should have a suitable path. 
    // simplify the path by describing it as a set of coordinates
    // we can use the simplified path to construct a "rounded corners" variation.
    let pathAsCoordinates = simplifyPath(path);

    
    // TODO: create a UI checkbox option to toggle 
    // whether the corners will be rounded

    let roundedPathString = createRoundedPathString(pathAsCoordinates, config.roundedCornerRadius);    
    
    
    // TODO: Simplify a path with Ramer–Douglas–Peucker algorithm
    // https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm

    svgElement.querySelector('path').setAttribute('d', roundedPathString);
        
    let roundedPath = svgElement.querySelector('path');

    let segments = pathToSegmentsArray( roundedPath ) ;

    
    console.log('SEGMENTS +++++++++++++++++++++++++++');
    console.log(segments);


    // traverse the rounded path into arc and line segments. 
    for ( segment of segments ){
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

            // MAX here helps us to avoid a zero percent increment. 
        let pixelIncrement = Math.max(config.simplifyIncrement, 1 ) ; // this comes from the UI
        let percentIncrement = 100 * ( pixelIncrement / pathLength );
        // if the given pixel increment is not workable, use a default. 
        if (percentIncrement > 20){ 
            percentIncrement = 1;
            pixelIncrement = 0.01 * pathLength;
        }

        console.log(
            " SIMPLIFY PATH ========================== "+
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
        " CREATE SEGMENTS ======================"+
        " Converting path to array of segments. "+
        " Incrementing by "+pixelIncrement+" pixels. "+
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

        if (Array.isArray(results)){ 
            segments.push(...results)
        }
    }

    
    // return segments to imagemagick as "instructions" for further processing.
    return optimizeSegments(segments.flat(20), path)
  }


// TODO: this is an effor to compare adjacent segments after the fact
// it needs some work to be functional. 
  function optimizeSegments(segments, path){
      let optimized = [];
      for(i in segments){
          console.log("CHECKING SHARP");
          if (i + 1 < (segments.length -1) ){
            let first = segments[i];
            let second = segments[i+1];
            console.log([first,second]);
            // make sure the segments exist.
            if ( typeof first !== "undefined" &&  typeof second !== "undefined"){
                let theAngle = findAngle(first.A, first.C, second.C);
                console.log(theAngle);
                
                if ( theAngle < toRadians(config.sharpAngleThreshold) ) {
                    console.log("SHARP ANGLE PERSISTS. ")
                    console.log(theAngle+" is problematic, it is less than than "+ toRadians(config.sharpAngleThreshold));
                    
                } 
                else{
                    console.log(theAngle+" is fine, it is greater than "+ toRadians(config.sharpAngleThreshold));
                }
            }
            else{
                console.log("One of these two segments does not exist.");
            }
          }
      }
    return segments
  }


   // Given a path element and 
   // Given a percentage position along the path (startLocation) 
   // Find an arc or line to approximate the segment that
   // -begins at startLocation (A) 
   // -passes through startLocation +0.5i (B)
   // -ends at startLocation + 1i (C)
   function findSegment(path, pathLength, startLocation, increment, split = false, level = 1){
        
        if ((startLocation + increment) > 100){
            increment = 99.99 - startLocation
        }
        
        // Find points A, B, and C as percentages of the whole path length
        let positionA = ( startLocation ) / 100 ;
        let positionB = ( startLocation + (increment/2) ) / 100;
        let positionC = ( startLocation + increment ) / 100;
        





        // add an offset so the path goes a touch further than it needs to. 
        let offsetB = (increment  / 100) * 0.05;
        let offsetC = (increment  / 100) * 0.10;
        positionB +=  offsetB;
        positionC += offsetC;

        if (split == false){
            console.log("SEGMENT "+positionA.toFixed(3)+" to "+positionC.toFixed(3)+" =================== ");
        }
        else{
            console.log(
                '>>> L'+level+' SPLIT SEGMENT '+
                positionA.toFixed(3)+' to '+positionC.toFixed(3)+'('+split+' of 2) -------- '+
                'This segment has been split from a larger one. '+
                'It Starts at '+ startLocation.toFixed(3) +'. '+
                'Increment is '+increment.toFixed(3)+' instead of '+(2*increment).toFixed(3)
            );         
            
            if (split == 2 && level == 2){
                console.log(
                    '$$$$ DoubleChecking the input here. '+
                    'I noticed that it might match a previous level 3 segment here. '
                )
            }
        }

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
 

        let angleABC = findAngle(A,B,C);

        console.log("Angle ABC is "+ angleABC+" Radians or "+toDegrees(angleABC) + " degrees");


        // LINEAR Segments
        // A linear segment has 180 degrees or (π radians)
        // If the angle is less an eighth of a degree away from "straight"
        // we will consider it straight. 
        // As a failsafe, if findAngle returns angleABC == NaN
        // Then we will also use a line instead of an arc. 
        // See also: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acos#description
        // NOTE: 0.125 degrees equals π/720 radians
         if ( ( Math.PI  - angleABC ) <  (Math.PI / 720) || isNaN(angleABC) ){
        
            console.log(
                "LINE FOUND --------- Angle" + toDegrees(angleABC) + " is treated as linear "+
                "by proximity to 180 degrees.");
            let theLine = {
                type: 'line',
                level: level,
                A: A,
                B: B,
                C: C
            }
            return [theLine];
        }

        // SHARP CORNERS (Acute Angles)
        // if the angle is less than 90 degrees the arc becomes ambiguous. 
        // in this case we must split the segment in half recursively
        // until the curvature reaches an obtuse angle.
        // NOTE: 90 degrees equals π/2 radians

        // let thresholdAngle = (Math.PI/2);
        // get the sharpAngle threshold from the UI. 

        if (angleABC < toRadians(config.sharpAngleThreshold)){ 

            // if you reach beyond level 3, you've really got a sharp point on your hands. 
            // maybe its better to soften it.
            if (level > 3){

                let midAC = findMidpoint(A.x,A.y, C.x, C.y);
                // mutate B until if falls within range. 
                while (findAngle(A,B,C) < toRadians(config.sharpAngleThreshold) ){
                    let newB = findMidpoint(midAC.x, midAC.y, B.x, B.y);
                    B.x = newB.x;
                    B.y = newB.y; 
                }
                
            }
            // For the first few iterations we can tr to span the gap by splitting the segment.
            else{ 

                console.log(
                    "SHARP ANGLE ------ Angle "+toDegrees(angleABC).toFixed(2) +" is too sharp "+
                    "(less than "+config.sharpAngleThreshold.toFixed(2)+" degrees). "+
                    "Segment will be split in two");

                let angleColor;
                if (level == 1 ) angleColor ='rgb(255,255,0)';
                if (level == 2 ) angleColor ='#ff6600';
                if (level == 3 ) angleColor ='rgb(0,255,255)';

                
                

                //renderAngle(A,B,C, angleColor); 

                // if AB is shorter than BC by some threshold.
                // split the segment unti it is similar. 

                let AB = findDistance(A.x,A.y,B.x,B.y)
                let BC = findDistance(B.x,B.y, C.x, C.y)
                
                // if AB and BC are similar in length
                // create three segments like a sandwich such that 
                // the middle segment (the meat) occupies 1/2 the segment, 
                // while the two edge segments (the bun) are 1/4 each. 
                if  ( Math.abs(1 - (AB/BC) ) < 0.05 ){

                    console.log(
                        '### AB '+AB.toFixed(3)+' and BC '+BC.toFixed(3)+
                        ' are similar. '+
                        'Splitting into 3'); 

                    let startLocationOne = startLocation
                    let incrementOne = increment/10
                    let startLocationTwo = startLocation + incrementOne
                    let incrementTwo = increment*8/10
                    let startLocationThree = startLocation + incrementOne + incrementTwo
                    let incrementThree = increment/10
                    let nextLevel  = level + 1;  
                    return [
                        findSegment(path, pathLength, startLocationOne, incrementOne, 1, nextLevel),
                        findSegment(path, pathLength, startLocationTwo, incrementTwo, 2, nextLevel),
                        findSegment(path, pathLength, startLocationThree, incrementThree, 2, nextLevel)
                    ]
                }

                // if AB and BC are not similar in length 
                // Find the longest of the two 
                // and shorten it into a new 1/4 -length segment. 
                // Find the shortest of the two, 
                // and lengthen it into a new 3/4 -length segment
                // The longer segment ought to now span the sharp corner. 
                // hopefuly this smoothes it out. 
                
                else{

                    
                    console.log('### AB '+AB.toFixed(3)+' and BC '+BC.toFixed(3)+
                    ' are not similar. Splitting into 2'); 

                    let startLocationOne 
                    let incrementOne 
                    let startLocationTwo
                    let incrementTwo

                    if (AB > BC){
                        startLocationOne = startLocation
                        incrementOne = increment / 10
                        startLocationTwo = startLocationOne + incrementOne
                        incrementTwo = increment * 9/10
                    }else{
                        startLocationOne = startLocation
                        incrementOne = increment * 9/10
                        startLocationTwo = startLocationOne + incrementOne
                        incrementTwo = increment / 10
                    }
                    let nextLevel  = level + 1;  
                    return [
                        findSegment(path, pathLength, startLocationOne, incrementOne, 1, nextLevel),
                        findSegment(path, pathLength, startLocationTwo, incrementTwo, 2, nextLevel)
                    ]
                    
                }
           }
             

        }

        // GENTLE CURVES (Obtuse Angles)
        // If we have a gentle curve, the angle is constrained:
        // to be less than 179.5 degrees 
        // to be greater than 90 degrees (or greater than user-supplied value)
        // In this case we can approximate the segment as a circular arc.  

        // TO start, find the circle that passes through points  A, B, and C
        let theCircle = findCircle(A.x, A.y, B.x, B.y, C.x, C.y);  
  
        // Discover which quadrant (I,II,III,IV) each arc point is in
        // relative to the circle. 
        A.quadrant = findQuadrant(A, theCircle);
        B.quadrant = findQuadrant(B, theCircle);
        C.quadrant = findQuadrant(C, theCircle);


        // ==================================================
        // MATH NOTES:
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
        let arcIsClockwise = findIfArcIsClockwise(A,B,C, theCircle)
        let slopeAB= findSlope(A.x,A.y, B.x,B.y);
        let yInterceptAB = -(slopeAB * A.x - A.y);

        let theArc = {
            type: "arc",
            chord: arcChord,
            angle: arcAngle,
            level: level,
            rotateAngle: 0, /* To be calculated */
            endAngle: 0,  /* To be calculated */
            slopeAB:slopeAB,
            yInterceptAB:yInterceptAB,
            length: arcLength,
            targetLength: targetArcLength,
            A: A,
            B: B,
            C: C,
            circle: theCircle,
            isClockwise: arcIsClockwise,
            flowDirection: (arcIsClockwise) ? "Clockwise" : "CounterClockwise"
        } 

        // We now know enough about the arc to position it.
        // relative to its circle. 
        theArc.rotateAngle = findArcStartAngle(theArc);
        theArc.endAngle = theArc.rotateAngle + theArc.angle
         
        // TODO you might need to calculate the top_radius and the bottom_radius as well
        // otherwise imagemagick will default to its own opinions on the matter.
        // you would need to know the vertical dimensions of the input image. 
 
        // return an array because sometimes there's more than one arc.
        // e.g. when we work recursively. 
        // here it just happens to be an array of one.
        return [theArc]; 
   
  }
 

// given an arc with lots detail (e.g. awareness of quardrants and flow direction)
// work out the rotation angle needed to position it properly within its circle. 
function findArcStartAngle(theArc){
 
        // Find the angles of the major and minor arcs whose endpoints are 
        // point A and the point at the top of the circle.
        // This angle corresponds to the amount of rotation applied to the arc of interest
        // HTML Canvas uses the right edge of a circle as a point of reference.
        // ImageMagick uses the top of the circle as a point of reference.         
        // For a clockwise sweep,
        // we rotate the arc so as to begin at A.x, A.y 
        // For a counterclockwise sweep 
        // we rotate the arc so as to begin at C.x, C.y

        // the reference point will either be A or C.
        let referencePoint
        let circleCenter = {x:theArc.circle.x, y:theArc.circle.y}
        let circleRight = {x:theArc.circle.xRight, y:theArc.circle.yRight}
        let foundAngle 
        let rotateAngle
        let useMajorAngle = false;

        if (theArc.isClockwise){
            referencePoint = theArc.A;
            if (theArc.A.quadrant == 'I' || theArc.A.quadrant == 'II'){
                useMajorAngle = true; 
            }
        }
        else{
            referencePoint = theArc.C;
            if (theArc.C.quadrant == 'I' || theArc.C.quadrant == 'II' ){
                useMajorAngle = true; 
            }
        }

        foundAngle = findAngle( referencePoint, circleCenter, circleRight )

        if (useMajorAngle){
            rotateAngle = (2 * Math.PI) - foundAngle
        }
        else{
            rotateAngle = foundAngle
        }

        return rotateAngle;
        
         
}

// given an arc with quadrant-aware points ABC
// determine the direction of flow of the arc 
// e.g. clockwise or counterclockwise.
function findIfArcIsClockwise(A,B,C, circle){
   
    // Using a Set here to remove duplicates. 
    // https://stackoverflow.com/a/9229821
    let quadrants = [...new Set([  A.quadrant, B.quadrant, C.quadrant]) ];

    // this is the number of quadrants directly ocupied by A B and C
    let quadrantCount = quadrants.length

    // We still need to know the quadrantRange, 
    // It's often (but not always) the same as quadrantCount
    let quadrantRange
    if ( A.quadrant == C.quadrant  && quadrantCount == 1 ){
        // if the arc begins and ends in the same quadrant 
        quadrantRange = 1
    }
    if ( quadrantsAreAdjacent( A.quadrant, C.quadrant) && quadrantCount == 2 ){
        // if the quadrant count was 3, it would imply the use of a major arc
        // but presumably we want to avoid this.
        quadrantRange = 2
    }
    if ( quadrantsAreOpposite( A.quadrant, C.quadrant)){
        // The range may differ from the count
        // e.g. if A and B inhabit the same quadrant but C is opposite.
        quadrantRange = 3
    }
    
    console.log('Arc Spans ' + quadrantRange );
    console.log('A,B, and C directly occupy ' + quadrantCount + ' Quadrants (' + quadrants.join(", ")+")" );
    console.log('Start Quadrant is ' +A.quadrant);
    console.log('Middle Quadrant is ' +B.quadrant);
    console.log('End Quadrant is ' +C.quadrant);
 

    if (quadrantRange == 1){
        if ( A.quadrant == 'I' || A.quadrant == 'IV' ){
           return (A.y < B.y) ? true : false;
        }
        if ( A.quadrant == 'II' || A.quadrant == 'III' ){
           return (A.y < B.y) ? false : true;
        }
    }

    if (quadrantRange == 2){
        if ( A.quadrant == 'I' ) {
           return ( C.quadrant == 'II' ) ? false : true;
        }
        if ( A.quadrant == 'II' ) {
           return ( C.quadrant == 'III' ) ? false : true;
        }
        if ( A.quadrant == 'III' ) {
           return ( C.quadrant == 'IV' ) ? false : true;
        }
        if ( A.quadrant == 'IV' ) {
           return ( C.quadrant == 'I' ) ? false : true;
        } 
    }
    
    if (quadrantRange == 3){        
        if ( A.quadrant == 'I' ){
            if (B.x < circle.x) return (B.y < C.y)? false : true;
            else return (B.y < A.y)? false : true;
        }
        if ( A.quadrant == 'II'  ){
            if (B.x < circle.x) return (B.y < A.y)? true : false;
            else return (B.y < C.y)? true : false;
        }
        if ( A.quadrant == 'III'  ){
            if (B.x < circle.x) return (B.y < A.y)? true : false;
            else return (B.y < C.y)? true : false;
        }
        if ( A.quadrant == 'IV'  ){
            if (B.x < circle.x) return (B.y < C.y)? false : true;
            else return (B.y < A.y)? false : true;
        }
    } 

}


// check whether two quadrants are adjacent to each other. 
function quadrantsAreAdjacent(quadrantOne, quadrantTwo){
    let quadrants = [quadrantOne, quadrantTwo];
    if (quadrants.includes('I') && quadrants.includes('II')) return true;
    if (quadrants.includes('I') && quadrants.includes('IV')) return true;
    if (quadrants.includes('II') && quadrants.includes('III')) return true;
    if (quadrants.includes('III') && quadrants.includes('IV')) return true;
    return false;
}

// check whether two quadrants are opposite each other. 
function quadrantsAreOpposite(quadrantOne, quadrantTwo){
    let quadrants = [quadrantOne, quadrantTwo];
    if (quadrants.includes('I') && quadrants.includes('III')) return true;
    if (quadrants.includes('II') && quadrants.includes('IV')) return true;
    return false;
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
    let AB = Math.sqrt(Math.pow(B.x-A.x,2)+ Math.pow(B.y-A.y,2));    
    let BC = Math.sqrt(Math.pow(B.x-C.x,2)+ Math.pow(B.y-C.y,2)); 
    let AC = Math.sqrt(Math.pow(C.x-A.x,2)+ Math.pow(C.y-A.y,2));
    let x = (BC*BC+AB*AB-AC*AC)/(2*BC*AB);
    let angle = Math.acos(x); 
    return angle
}
  
  
// Detwrmine which quadrant (I, II, III, IV)
// Point A is located in
// relative to point B
function findQuadrant(A, B){
    if (A.x > B.x && A.y < B.y) return 'I';
    if (A.x < B.x && A.y < B.y) return 'II';
    if (A.x < B.x && A.y > B.y) return 'III';
    if (A.x > B.x && A.y > B.y) return 'IV';        
}

// render segments recursively. 
// if they have been subdivided, there will be an array
// instead of an object.
function renderSegment(segment, level = 0){

    console.log(" RENDER SEGMENT =============");
    if (segment.type =="line") renderLine(segment)  

    // I assume that a line would never happen at level > 0 
    // however an the case of an arc we pass the level along to differentiate.
    if (segment.type =="arc") renderArc(segment, level) 
        
}

function renderAngle(A,B,C, color = '#000000'){
    // draw a line.
    canvasContext.beginPath();
    canvasContext.moveTo(A.x,A.y);
    canvasContext.lineTo(B.x, B.y);
    canvasContext.lineTo(C.x, C.y);
    canvasContext.fillStyle = color;
    canvasContext.fill();
}

function renderLine(line){

    console.log( "RENDER LINE ============ ");

    // draw a line.
    canvasContext.beginPath();
    canvasContext.moveTo(line.A.x,line.A.y);
    canvasContext.lineTo(line.C.x, line.C.y);
    canvasContext.lineWidth = 50;
    let r = line.A.position * 255;
    let g = 255 - line.A.position * 255;
    let b = randomNumberBetween(1,100)
    canvasContext.strokeStyle = 'rgba('+r+','+g+','+b+', 0.5)';
    canvasContext.stroke();

    // render a dot for context.
    canvasContext.beginPath();
    canvasContext.rect(line.A.x,line.A.y, 5, 5);
    //canvasContext.arc(line.A.x,line.A.y, 4, 0, 2 * Math.PI);
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = 'rgb(255,0,255)'
    canvasContext.stroke();

}

function renderArc(arc, level){ 

    console.log( "RENDER ARC ============ ");

    if (level > 0){
        console.log('Rendering arc subsegment at level '+level);
        console.log(arc);
    }
    console.log( 
        'Position: '+(arc.A.position * 100).toFixed(2) +' percent: '+
        ' Rendering arc using  circle centered at '+ arc.circle.x+','+arc.circle.y+
        ' with radius '+arc.circle.radius+
        ' and rotate angle '+arc.rotateAngle+' ( '+toDegrees(arc.rotateAngle) +' degrees) '+
        ' and end angle '+arc.endAngle+' ( '+toDegrees(arc.endAngle) +' degrees) '
    )

    // render a circle with dot for context.
    renderCircle(arc.circle, level);
    renderDot(arc.circle, 'rgba(0,0,0,0.5)');

    canvasContext.beginPath();
    canvasContext.arc(
        arc.circle.x,
        arc.circle.y,
        arc.circle.radius,
        arc.rotateAngle,
        arc.endAngle
    );     
    canvasContext.lineWidth = 80;
    canvasContext.strokeStyle = colorForPosition(arc.A.position);
    canvasContext.stroke();

    // render points A B ad C for context. 
    renderDot(arc.A, 'rgb(255,0,0)', 2);
    renderDot(arc.B, 'rgb(0,255,0)', 2); 
    renderDot(arc.C, 'rgba(0,0,255,0.5)', 4);

}

function colorForPosition(position){
    let r = position * 255
    let g = 255 - position * 255
    let b = randomNumberBetween(100,200)
    return 'rgba('+r+','+g+','+b+', 0.5)'
}


function renderDot(point, color='rgb(0,0,0)', radius= 2){
    canvasContext.beginPath();
    canvasContext.arc(point.x,point.y, radius, 0, 2 * Math.PI);
    canvasContext.lineWidth = 2;
    canvasContext.fillStyle = color;
    canvasContext.fill();
}

function renderCircle(circle, level){
    // render a circle for context. 
    canvasContext.beginPath();
    canvasContext.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = 'rgba(100,100,100, 0.2)'
    canvasContext.stroke();
}

function toDegrees(radians){
    return radians * (180/Math.PI);
}

function toRadians(degrees){
    return degrees * (Math.PI/180);
}

function randomNumberBetween(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomColor() {
    var o = Math.round, r = Math.random, s = 255;
    return 'rgb(' + o(r()*s) + ',' + o(r()*s) + ',' + o(r()*s)  + ')';
}




function saveCanvasImage(){
    var myCanvas = document.getElementById('canvas');
    var link = document.getElementById('imageLink');
    link.setAttribute('download', 'result.png');
    link.setAttribute('href', myCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
    link.click();
}

  // Calculate the midpoint between two points
function findMidpoint(x1, y1, x2, y2) { 
    return {
        x: ((x1 + x2) / 2), 
        y: ((y1 + y2) / 2)
    };
}


// Calculate the distance between two points
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
        let theValue = parseInt(event.target.value);
        let theSlider 

        if (event.target.classList.contains('rangeValue')){
            theSlider = event.target.previousElementSibling
            theSlider.value = theValue
        }else{
            theSlider = event.target
            event.target.nextElementSibling.value = theValue
        }
        config[theSlider.id] = theValue;
        console.log(config)
        if (uploadedSVG != '') go();
        
    });
});
 

 

