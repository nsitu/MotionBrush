// A kit of tools for working with paths
// some functions operate on SVGs as a whole. 
// some function operate on SVG path strings.
// some functions operate on other representations of path (e.g. arrays)
// =====================
// shapesToPaths: In an SVG, Convert non-<path> elements to their <path> equivalents
// stringToArray: generate array of points from SVG path string
// arrayToString: generate SVG path string from array of points


// PathKit Dependencies:
// - Depends on config module to understand user settings. 
// - Depends on MathKit module for help with Geometry. 
import cfg from './config.js'
import MathKit from './mathkit.js';
import Render from './render.js';

class PathKit{

    // Get SVG dimensions from the viewbox.
    // Account for viewbox delimiter being a comma, space, or both
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox
   
    getViewBox(svgElement){
        // e.g. return [svgMinX,svgMinY,svgWidth,svgHeight]
        // TODO: explore implications of nonzero svgMinX, svgMinY
        // TODO: is it safe to assume all 4 elements here?
        return svgElement
            .getAttribute('viewBox')
            .replace(',', ' ')
            .replace('  ', ' ')
            .split(' ')
    }
    // get SVG width from viewbox.
    getWidth(svgElement){
        const viewBox = this.getViewBox(svgElement)
        return viewBox[2]
    }
    // get SVG height from viewbox.
    getHeight(svgElement){
        const viewBox = this.getViewBox(svgElement)
        return viewBox[3]
    }
   
    // replace <polyline>, <polgon>, and <rectangle> elements
    // with an equivalent <path> element
    // ToDo: add support for <circle> and <ellipse>
    async shapesToPaths(svgElement){
        // Remove CSS from SVG
        let styleTag = svgElement.querySelector('style');
        if (styleTag !== null) styleTag.remove();

        // If there is a polyline instead of a path.
        // Convert it to a path by recontextualizing the points string.
        let polylines = svgElement.querySelectorAll('polyline');
        if (polylines !== null) {
            for (const polyline of polylines){
                console.log('Found polyline.') 
                // https://www.w3.org/TR/SVG/paths.html#PathDataMovetoCommands
                // If a moveto is followed by multiple pairs of coordinates, 
                // the subsequent pairs are treated as implicit lineto commands.
                
                let thePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
                thePath.setAttribute('d', 'M'+polyline.getAttribute('points'));
                //svgElement.appendChild( thePath )             
                polyline.parentElement.appendChild( thePath )
                polyline.remove();
            }
        } 
        // If there is a polygon instead of a path.
        // Convert it to a path by recontextualizing the points string.
        let polygons = svgElement.querySelectorAll('polygon');
        if (polygons !== null) {
            for (const polygon of polygons){
                console.log('Found polygon.') 
                // https://www.w3.org/TR/SVG/paths.html#PathDataClosePathCommand
                // The "closepath" (Z or z) ends the current subpath 
                // by connecting it back to its initial point. 
                // TODO: check: do we need to trim any trailing space(s) from polygonString? 
                // TODO: why should we bother with Z? any artistic considerations here?
                let thePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
                thePath.setAttribute('d', 'M'+polygon.getAttribute('points')+'z');
                //svgElement.appendChild( thePath )
                polygon.parentElement.appendChild( thePath )
                polygon.remove()
            }
        } 
        // If there is a rectangle instead of a path.
        // Convert it to a path by recontextualizing the points string.
        let rectangles = svgElement.querySelectorAll('rect');
        if (rectangles !== null) {
            for (const rect of rectangles){
                console.log('Found rectangle.')      
                // get rectangle coordinates
                let rx = parseFloat(rect.getAttribute('x'));
                let ry = parseFloat(rect.getAttribute('y'));
                // assume 0,0 if rectangle lacks coordinates.
                if ( isNaN(rx) ) rx = 0; 
                if ( isNaN(ry) ) ry = 0;
                // get rectangle dimensions
                let rw = parseFloat(rect.getAttribute('width'));
                let rh = parseFloat(rect.getAttribute('height'));
                // express rectangle as a series of points
                let points = [
                    [rx, ry].join(','),
                    [rx+rw, ry].join(','),
                    [rx+rw, ry+rh].join(','),
                    [rx, ry+rh].join(',')
                ].join(' ');             
                // create a path element from the given points
                let thePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
                thePath.setAttribute('d', 'M'+points+'z');
                rect.parentElement.appendChild( thePath )
                rect.remove()
            }
        }
        // TODO: how can I be confident that this will not return 
        // until all the above work is complete?
        return svgElement;
    }




// Given an SVG path element
// describe it as an array of coordinates.
  stringToArray(path){ 
    
    // TODO: getTotalLength is a feature of the SVG API
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
    let pixelIncrement = Math.max(cfg.simplifyIncrement, 1 ) ; // this comes from the UI
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

    for (let startPosition = 1; startPosition < 100; startPosition += percentIncrement ){ 
        let positionAsPercentageTraversed = startPosition  / 100 ;
        let positionAsPixelsTraversed = pathLength * positionAsPercentageTraversed;
        let positionAsCoordinates = path.getPointAtLength(positionAsPixelsTraversed);
        coordinates.push(positionAsCoordinates)
    }
    // return segments to imagemagick as "instructions" for further processing.
    return coordinates;  
}



    /*
    * Thanks to janispritzkau https://stackoverflow.com/a/65186378
    * and Mvin https://stackoverflow.com/a/52819132
    * Given an array of coordinates [{x:x, y:y}, {x:x, y:y}, ...]
    * Generate an SVG path string with rounded corners 
    */
    arrayToString(coords, radius=10, close=false) {
        let path = ""
        const length = coords.length + (close ? 1 : -1)
        for (let i = 0; i < length; i++) {
            const a = coords[i % coords.length]
            const b = coords[(i + 1) % coords.length]
            /*I'm not totally sure what the radius is doing here. */
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

    
  // Traverse an svg path, and divide it into segments
  // Describe each segment as an arc or a line.
  // (ImageMagick can generate rectangles as well as arcs)
  createSegments( path ) {
         
    // Get the total length of the path in pixels 
    let pathLength = path.getTotalLength(); 
    
    // prepare an array to hold many segments of the path. 
    let segments = [];

    // Each segment will comprise a percentage of the whole length of the path. 
    // we define this percentage as "increment" 
    // a smaller increment will result in smaller segments (e.g. thinner slices)

    let pixelIncrement = cfg.segmentIncrement; // this comes from the UI
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
    for (let startLocation = 1; startLocation <100; startLocation += percentIncrement ){
        let results = this.findSegment(path, pathLength, startLocation, percentIncrement);
        // the spread operator ... lets us iteratively push 
        // in case the segment has been split. 
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax

        if (Array.isArray(results)){ 
            segments.push(...results)
        }
    }

    // return segments to imagemagick as "instructions" for further processing.
    return this.optimizeSegments(segments.flat(20), path)
  }


  
// TODO: this is an effort to compare adjacent segments after the fact
// it needs some more work to be really useful. 
 optimizeSegments(segments, path){
    let optimized = [];
    for(const i in segments){
        console.log("CHECKING SHARP");
        if (i + 1 < (segments.length -1) ){
          let first = segments[i];
          let second = segments[i+1];
          console.log([first,second]);
          // make sure the segments exist.
          if ( typeof first !== "undefined" &&  typeof second !== "undefined"){
              let theAngle = MathKit.findAngle(first.A, first.C, second.C);
              console.log(theAngle);
              
              if ( theAngle < MathKit.toRadians(cfg.sharpAngleThreshold) ) {
                  console.log("SHARP ANGLE PERSISTS. ")
                  console.log(theAngle+" problematic; less than than "+ MathKit.toRadians(cfg.sharpAngleThreshold));
                  console.log({x:first.C.x, y:first.C.y, radius:150});
                  Render.drawCircle({x:first.C.x, y:first.C.y, radius:150}, 'rgb(255,0,0)')
                  
              } 
              else{
                  console.log(theAngle+" OK; greater than "+ MathKit.toRadians(cfg.sharpAngleThreshold));
              }
          }
          else{
              console.log("One of these two segments does not exist.");
          }
        }
    }
  return segments
}


   // ===== findSegment() =======
   // -- relies heavily on MathKit!
   // Given a path element and 
   // Given a percentage position along the path (startLocation) 
   // Find an arc or line to approximate the segment that
   // -begins at startLocation (A) 
   // -passes through startLocation +0.5i (B)
   // -ends at startLocation + 1i (C)
   
   findSegment(path, pathLength, startLocation, increment, split = false, level = 1){
         
    if ((startLocation + increment) > 100){
        increment = 99.99 - startLocation 
    }
    
    // Find points A, B, and C as percentages of the whole path length
    let positionA = ( startLocation ) / 100 ;
    let positionB = ( startLocation + (increment/2) ) / 100;
    let positionC = ( startLocation + increment ) / 100;
    

    // Segment overlap
    // Extend the path by a configureable percentage 
    // so the path goes further than it otherwise would
    // so as to overlap the subsequent path.
    // Except if this would exceed the path length.
    let offsetB = (increment  / 100) * (cfg.segmentOverlap / 100) / 2;
    let offsetC = (increment  / 100) * (cfg.segmentOverlap / 100);
    if (positionC + offsetC < 100){
        positionB +=  offsetB;
        positionC += offsetC;
    }

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


    let angleABC = MathKit.findAngle(A,B,C);

    console.log("Angle ABC is "+ angleABC+" Radians or "+MathKit.toDegrees(angleABC) + " degrees");


    // LINEAR Segments
    // A linear segment has 180 degrees or (π radians)
    // If the angle is less an eighth of a degree away from "straight"
    // we will consider it straight. 
    // As a failsafe, if MathKit.findAngle() returns angleABC == NaN
    // Then we will also use a line instead of an arc. 
    // See also: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acos#description
    // NOTE: 0.125 degrees equals π/720 radians
     if ( ( Math.PI  - angleABC ) <  (Math.PI / 720) || isNaN(angleABC) ){
    
        console.log(
            "LINE FOUND --------- Angle" + MathKit.toDegrees(angleABC) + " is treated as linear "+
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

    if (angleABC < MathKit.toRadians(cfg.sharpAngleThreshold)){ 

        // if you reach beyond level 3, you've really got a sharp point on your hands. 
        // maybe its better to soften it.
        if (level > 3){

            let midAC = MathKit.findMidpoint(A.x,A.y, C.x, C.y);
            // mutate B until if falls within range. 
            while (MathKit.findAngle(A,B,C) < MathKit.toRadians(cfg.sharpAngleThreshold) ){
                let newB = MathKit.findMidpoint(midAC.x, midAC.y, B.x, B.y);
                B.x = newB.x;
                B.y = newB.y; 
            }
            
        }
        // For the first few iterations we can tr to span the gap by splitting the segment.
        else{ 

            console.log(
                "SHARP ANGLE ------ Angle "+MathKit.toDegrees(angleABC).toFixed(2) +" is too sharp "+
                "(less than "+cfg.sharpAngleThreshold.toFixed(2)+" degrees). "+
                "Segment will be split in two");

            let angleColor;
            if (level == 1 ) angleColor ='rgb(255,255,0)';
            if (level == 2 ) angleColor ='#ff6600';
            if (level == 3 ) angleColor ='rgb(0,255,255)';

            
            

            //renderAngle(A,B,C, angleColor); 

            // if AB is shorter than BC by some threshold.
            // split the segment unti it is similar. 

            let AB = MathKit.findDistance(A.x,A.y,B.x,B.y)
            let BC = MathKit.findDistance(B.x,B.y, C.x, C.y)
            
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
                    this.findSegment(path, pathLength, startLocationOne, incrementOne, 1, nextLevel),
                    this.findSegment(path, pathLength, startLocationTwo, incrementTwo, 2, nextLevel),
                    this.findSegment(path, pathLength, startLocationThree, incrementThree, 2, nextLevel)
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
                    this.findSegment(path, pathLength, startLocationOne, incrementOne, 1, nextLevel),
                    this.findSegment(path, pathLength, startLocationTwo, incrementTwo, 2, nextLevel)
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
    let theCircle = MathKit.findCircle(A.x, A.y, B.x, B.y, C.x, C.y);  

    // Discover which quadrant (I,II,III,IV) each arc point is in
    // relative to the circle. 
    A.quadrant = MathKit.findQuadrant(A, theCircle);
    B.quadrant = MathKit.findQuadrant(B, theCircle);
    C.quadrant = MathKit.findQuadrant(C, theCircle);


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
    let arcChord = MathKit.findDistance(C.x,C.y, A.x, A.y)
    let arcAngle = 2 * Math.asin( arcChord / theCircle.diameter)
    let arcLength  = (arcAngle / (2*Math.PI) ) * theCircle.circumference;
    let arcIsClockwise = MathKit.findIfArcIsClockwise(A,B,C, theCircle)
    let slopeAB= MathKit.findSlope(A.x,A.y, B.x,B.y);
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
    theArc.rotateAngle = MathKit.findArcStartAngle(theArc);
    theArc.endAngle = theArc.rotateAngle + theArc.angle
     
    // TODO you might need to calculate the top_radius and the bottom_radius as well
    // otherwise imagemagick will default to its own opinions on the matter.
    // you would need to know the vertical dimensions of the input image. 

    // return an array because sometimes there's more than one arc.
    // e.g. when we work recursively. 
    // here it just happens to be an array of one.
    return [theArc]; 

}




}
 
export default new PathKit();