// The Render Module
// - Is Called by UI module
// - Assembles visual output
// - Displays results on HTML canvas

// Dependencies:
// - Depends on config module to understand user settings. 
// - Depends on MathKit module for help with Geometry. 
// - Depends on PathKit module for help with SVG operations.
// - Depends on WASM-ImageMagick to create textures. 
import cfg from './config.js'
import PathKit from './pathkit.js';
import MathKit from './mathkit.js';
import * as Magick from '../ImageMagick/magickApi.js';

// NOTE: We are self-hosting WASM ImageMagick
// See also: https://cdn.jsdelivr.net/npm/wasm-imagemagick/dist/bundles/

class Render{

    constructor(){
        this.createWorkspace();
        this.uploadedSVG = null; /* this will be populated later */ 
    }

    // Create a workspace:
    // -setup canvas for rendering
    // -setup HTML container to place SVG upload
    createWorkspace(){
        // the render area should have at minimum 
        // the same dimensions as our input SVG.
        this.renderArea = document.getElementById('renderArea'); 
        this.outputCanvas = document.createElement('canvas');
        this.outputCanvas.id = "outputCanvas";
        this.renderArea.appendChild(this.outputCanvas); 
        this.canvasContext = this.outputCanvas.getContext("2d");
        this.svgContainer = document.getElementById('svgContainer'); 
        this.svgElement = null; /* will be populated later*/ 
    }
   

     
// === GO ====
// called by UI:
// - when a new file is uploaded.    
// - when the user updates configuration.
 async go(uploadedSVG = null){

    if(uploadedSVG != null) this.uploadedSVG = uploadedSVG
    if (this.uploadedSVG == null) return  

    this.svgContainer.style.display = "block"
    this.svgContainer.innerHTML = this.uploadedSVG
    this.svgElement = this.svgContainer.querySelector('svg')
    if (this.svgElement == null) return
    
    // set the dimensions of the output canvas to match the viewbox of the SVG.    
    this.outputCanvas.width = PathKit.getWidth(this.svgElement)
    this.outputCanvas.height = PathKit.getHeight(this.svgElement)

    // Before rendering, we must prepare the SVG
    // Through simplification, flattening.

    // TODO: integrate the SVG Essence API here.
    // It leverages vpype (python) on the server.
    // https://github.com/nsitu/svg-essence-api

    // TODO: scale all input SVGs to a predictable dimension. 
    // this will avoid isues with tiny SVG files (e.g. 16px icons)
    // You'll probably need to do it serverside (e.g. with vpype)

    // TODO: Explore simplifying paths more effectively
    // e.g. via the Ramer–Douglas–Peucker algorithm
    // https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm

    // NOTE: Consider "baking" transforms here using Snap SVG
    // https://stackoverflow.com/a/30472842/17929842
    // This is interesting but Optional, since vpype
    //  already does a great job of this server-side

    PathKit.shapesToPaths(this.svgElement).then((svgElement)=>{
        let paths = svgElement.querySelectorAll('path');
        if (paths != null){
            for (const path of paths){
                        
                // describe the path as a set of points coordinates
                let coordinates = PathKit.stringToArray(path);

                // construct a "rounded corners" variation.
                let roundedPath = PathKit.arrayToString(
                    coordinates, 
                    cfg.roundedCornerRadius
                );

                path.setAttribute('d', roundedPath);
                
                let segments = PathKit.createSegments( path ) ;

                console.log('SEGMENTS +++++++++++++++++++++++++++');
                console.log(segments);

                // traverse the rounded path into arc and line segments. 
                for ( const segment of segments ){
                    this.drawSegment(segment)
                }
            }
        }
    })
}

     
    // Given an image source
    // Create a relevant arc warp using imagemagick.
    async magickCall(src) {
        // wouldn't we want to use a drag and drop file here?
        let fetchedSourceImage = await fetch(src);
        let arrayBuffer = await fetchedSourceImage.arrayBuffer(); 

        const files = [{ 
            'name': 'src.jpg', 
            'content': new Uint8Array(arrayBuffer) 
        }]; 
        // "-crop","300x300+100+100",
        // -crop 300x300+100+100
        /*
            "-virtual-pixel", "transparent", 
            "-distort", "Arc", "60",
            */ 

            // https://stackoverflow.com/a/29738251/


            // given a texture image
            // -scale to fit pathLength and strokeThickness.
            // get strokeThickness (via config)
            // get pathLength (via SVG API)
            // -generate repeating pattern to fill pathLength 
            // -optionally reflect every other repeat.

            // that is mappable across the length of the line.
            // inputs: 
            
            // you might be able ot do this,
            // to resize the texture image to fit a given stroke width. 
            // "-resize","x"+cfg.strokeThickness,

        // the imagemagick Arc warps clockwise.
        // for a counterclockwise arc, 
        // you may have to flip the input image first

        const command = [
            "convert", 
            "src.jpg", 
            "-virtual-pixel", "transparent",
            "-write", "mpr:XY",
            "-respect-parentheses",
            "(", "mpr:XY",
            "-crop", "300x300+1100+0", 
            "+repage",
            "-distort", "Arc", "60",  
            "+write", "pic1.png", ")",
            "(", "mpr:XY", 
            "-crop", "900x300+1400+0", 
            "+repage",
            "-distort", "Arc", "270",  
            "+write", "pic2.png", ")",
            "null:"
            ];

            /*
            "-virtual-pixel", "transparent",
            "-crop","300x300+1100+0",
            "+repage",
            "-distort", "Arc", "-60",
            "out.png"
            */ 
        let processedFiles = await Magick.Call(files, command);

        for (const outputImage of processedFiles){
            let img = document.createElement('img');
            img.src = URL.createObjectURL(outputImage['blob'])
            document.getElementById('imageMagick').appendChild(img);
            console.log("Created image " + outputImage['name'])
        }
    }

    drawDot(point, color='rgb(0,0,0)', radius= 2){
        this.canvasContext.beginPath();
        this.canvasContext.arc(point.x,point.y, radius, 0, 2 * Math.PI);
        this.canvasContext.lineWidth = 2;
        this.canvasContext.fillStyle = color;
        this.canvasContext.fill();
    }

    drawCircle(circle, color='rgba(100,100,100, 0.2)'){
        // render a circle for context. 
        this.canvasContext.beginPath();
        this.canvasContext.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
        this.canvasContext.lineWidth = 2;
        this.canvasContext.strokeStyle = color
        this.canvasContext.stroke();
    }

    saveCanvasImage(){
        var myCanvas = document.getElementById('canvas');
        var link = document.getElementById('imageLink');
        link.setAttribute('download', 'result.png');
        link.setAttribute('href', myCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
        link.click();
    } 

    // render segments recursively. 
    // if they have been subdivided, there will be an array
    // instead of an object.
    drawSegment(segment, level = 0){

        console.log(" RENDER SEGMENT =============");
        if (segment.type =="line") this.drawLine(segment)  

        // I assume that a line would never happen at level > 0 
        // however an the case of an arc we pass the level along to differentiate.
        if (segment.type =="arc") this.drawArc(segment, level) 
            
    }

    drawAngle(A,B,C, color = '#000000'){
        // draw a line.
        this.canvasContext.beginPath();
        this.canvasContext.moveTo(A.x,A.y);
        this.canvasContext.lineTo(B.x, B.y);
        this.canvasContext.lineTo(C.x, C.y);
        this.canvasContext.fillStyle = color;
        this.canvasContext.fill();
    }

    drawLine(line){

        console.log( "RENDER LINE ============ ");

        // draw a line.
        this.canvasContext.beginPath();
        this.canvasContext.moveTo(line.A.x,line.A.y);
        this.canvasContext.lineTo(line.C.x, line.C.y);

        this.canvasContext.lineWidth = cfg.strokeThickness;
        //this.canvasContext.lineWidth = 50;
        let r = line.A.position * 255;
        let g = 255 - line.A.position * 255;
        let b = MathKit.randomNumberBetween(1,100)
        this.canvasContext.strokeStyle = 'rgba('+r+','+g+','+b+', 0.5)';
        this.canvasContext.stroke();
 
        this.canvasContext.beginPath();
        this.canvasContext.rect(line.A.x,line.A.y, 5, 5);
        //this.canvasContext.arc(line.A.x,line.A.y, 4, 0, 2 * Math.PI);
        this.canvasContext.lineWidth = 2;
        this.canvasContext.strokeStyle = 'rgb(255,0,255)'
        this.canvasContext.stroke();

    }

    drawArc(arc, level){ 

        console.log( "RENDER ARC ============ ");

        if (level > 0){
            console.log('Rendering arc subsegment at level '+level);
            console.log(arc);
        }
        console.log( 
            'Position: '+(arc.A.position * 100).toFixed(2) +' percent: '+
            ' Rendering arc using  circle centered at '+ arc.circle.x+','+arc.circle.y+
            ' with radius '+arc.circle.radius+
            ' and rotate angle '+arc.rotateAngle+' ( '+MathKit.toDegrees(arc.rotateAngle) +' degrees) '+
            ' and end angle '+arc.endAngle+' ( '+MathKit.toDegrees(arc.endAngle) +' degrees) '
        )

        // render a circle with dot for context.
        this.drawCircle(arc.circle, level);
        this.drawDot(arc.circle, 'rgba(0,0,0,0.5)');

        this.canvasContext.beginPath();
        this.canvasContext.arc(
            arc.circle.x,
            arc.circle.y,
            arc.circle.radius,
            arc.rotateAngle,
            arc.endAngle
        );     

        /* texture image will be scaled to fit given stroke width. */
        let imCommand = [
            "-crop", "300x300+1100+0", 
            "+repage",
            "-distort", "Arc", "60"
        ]

        //this.canvasContext.lineWidth = 80;
        this.canvasContext.lineWidth = cfg.strokeThickness;
        this.canvasContext.strokeStyle = this.colorForPosition(arc.A.position);
        this.canvasContext.stroke();

        // render points A B ad C for context. 
        this.drawDot(arc.A, 'rgb(255,0,0)', 2);
        this.drawDot(arc.B, 'rgb(0,255,0)', 2); 
        this.drawDot(arc.C, 'rgba(0,0,255,0.5)', 4);

    }

    randomColor() {
        var o = Math.round, r = Math.random, s = 255;
        return 'rgb(' + o(r()*s) + ',' + o(r()*s) + ',' + o(r()*s)  + ')';
    }

    colorForPosition(position){
        let r = position * 255
        let g = 255 - position * 255
        let b = MathKit.randomNumberBetween(100,200)
        return 'rgba('+r+','+g+','+b+', 0.5)'
    }


}


export default new Render();


