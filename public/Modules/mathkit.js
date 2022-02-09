// The MathKit module 
// - calculates geometry for circles and arcs
// - calculates which quadrants of a circle are occupied by an arc
// - calculates the direction of rotation of an arc (clockwise/counterclockwise)
// - calculates how to position an arc within a circle (start angle)
// - calculates disctances, slopes, midpoints, angles etc.
// - converts between radians and degrees
// - generates random numbers within given range.
// - etc.

class MathKit{
    
// Find the center and radius for a circle that passes through 3 given points.
// https://www.geeksforgeeks.org/equation-of-circle-when-three-points-on-the-circle-are-given/
findCircle(x1, y1, x2, y2, x3, y3)
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


// Determine which quadrant (I, II, III, IV)
// Point A is located in
// relative to point B
findQuadrant(A, B){
    if (A.x > B.x && A.y < B.y) return 'I';
    if (A.x < B.x && A.y < B.y) return 'II';
    if (A.x < B.x && A.y > B.y) return 'III';
    if (A.x > B.x && A.y > B.y) return 'IV';        
}


// Calculate the distance between two points
findDistance(x1, y1, x2, y2) { 
	let xDiff = x1 - x2; 
	let yDiff= y1 - y2; 
	return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}

// given two points, find the slope of the line between them.
findSlope(x1, y1, x2, y2) {
    return (y2 - y1) / (x2 - x1);
}

  // Calculate the midpoint between two points
findMidpoint(x1, y1, x2, y2) { 
    return {
        x: ((x1 + x2) / 2), 
        y: ((y1 + y2) / 2)
    };
}
// Given points A, B, C 
// Find angle ABC in Radians 
// Thanks to Walter Stabosz: https://stackoverflow.com/questions/17763392/
findAngle(A,B,C) {
    let AB = Math.sqrt(Math.pow(B.x-A.x,2)+ Math.pow(B.y-A.y,2));    
    let BC = Math.sqrt(Math.pow(B.x-C.x,2)+ Math.pow(B.y-C.y,2)); 
    let AC = Math.sqrt(Math.pow(C.x-A.x,2)+ Math.pow(C.y-A.y,2));
    let x = (BC*BC+AB*AB-AC*AC)/(2*BC*AB);
    let angle = Math.acos(x); 
    return angle
}

toDegrees(radians){
    return radians * (180/Math.PI);
}

toRadians(degrees){
    return degrees * (Math.PI/180);
}

// check whether two quadrants are adjacent to each other. 
quadrantsAreAdjacent(quadrantOne, quadrantTwo){
    let quadrants = [quadrantOne, quadrantTwo];
    if (quadrants.includes('I') && quadrants.includes('II')) return true;
    if (quadrants.includes('I') && quadrants.includes('IV')) return true;
    if (quadrants.includes('II') && quadrants.includes('III')) return true;
    if (quadrants.includes('III') && quadrants.includes('IV')) return true;
    return false;
}

// check whether two quadrants are opposite each other. 
quadrantsAreOpposite(quadrantOne, quadrantTwo){
    let quadrants = [quadrantOne, quadrantTwo];
    if (quadrants.includes('I') && quadrants.includes('III')) return true;
    if (quadrants.includes('II') && quadrants.includes('IV')) return true;
    return false;
}


// given an arc with quadrant-aware points ABC
// determine the direction of flow of the arc 
// e.g. clockwise or counterclockwise.
findIfArcIsClockwise(A,B,C, circle){
   
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
    if ( this.quadrantsAreAdjacent( A.quadrant, C.quadrant) && quadrantCount == 2 ){
        // if the quadrant count was 3, it would imply the use of a major arc
        // but presumably we want to avoid this.
        quadrantRange = 2
    }
    if ( this.quadrantsAreOpposite( A.quadrant, C.quadrant)){
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



// given an arc with lots detail 
// (e.g. awareness of quardrants and flow direction)
// work out the rotation angle needed to position it properly within its circle. 
findArcStartAngle(theArc){

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

    foundAngle = this.findAngle( referencePoint, circleCenter, circleRight )

    if (useMajorAngle){
        rotateAngle = (2 * Math.PI) - foundAngle
    }
    else{
        rotateAngle = foundAngle
    }
    return rotateAngle;
}

// compare two slopes for similarity.
// use a lower difference threshold for greater sensitivity.
slopesAreSimilar(slopeOne, slopeTwo){
    let threshold = 0.5
    if ( Math.abs(slopeOne - slopeTwo) < threshold ){ 
        console.log('Slopes '+slopeOne+' and '+slopeTwo+' are similar')
        return true
    }
    return false
}


randomNumberBetween(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

    
// given a starting point {x,y} 
// and an angle 0..360 and a pixel distance 0..10000,
// return a second point located nearby
findNearbyPoint(x, y, angle, distance ){
    var radAngle = angle * Math.PI / 180; // angle in radians
    var p2 = {x:0, y:0};
    p2.x = x + distance * Math.cos(radAngle);
    p2.y = y + distance * Math.sin(radAngle);
    return p2;
}

}


export default new MathKit();