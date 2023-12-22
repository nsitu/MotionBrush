// The UI module creates control interfaces
// - drag and drop file upload
// - sliders for configuration

// Whenever the UI changes 
// - e.g. a new file is uploaded
// - e.g. a slider is adjusted 
// It passes control over to the Render module.

import cfg from './config.js'
import Render from './render.js';

class UI{

    constructor(){ 
        this.dropInit()
        this.sliderInit()  
        Render.magickCall(cfg.textureImage)
    }

    dropInit(){
        
        this.drop = document.getElementById('dragAndDrop'); 
        
        // Check if browser supports file drag and drop
        if (typeof window.FileReader === 'undefined') {
            // notify users that browser does not support file drag and drop 
            this.drop.innerHTML = '<p>Sorry, drag and drop is not working.</p>';
        } else {
            // provide instructions for drag and drop. 
            this.drop.innerHTML = '<p>Drag and drop an .svg file here.</p>';
        }
                
        // hover styling for drag and drop
        this.drop.ondragover = function() {
            this.className = 'hover';
            return false;
        }
        this.drop.ondragend = function() {
            this.className = '';
            return false;
        }
        

        this.drop.ondrop = function(e) {
            // TODO: check that file format is SVG
            this.className = '' 
            e.preventDefault()
            // https://developer.mozilla.org/en-US/docs/Web/API/FileReader 
            // FileReader asynchronously reads files (or raw data buffers) using File or Blob objects
            let file = e.dataTransfer.files[0]
            let reader = new FileReader()
            //console.log('ok');
            reader.onload = function(event) {  
                // pass along the uploaded SVG for rendering.
                Render.go(event.target.result);
            };
            reader.readAsText(file);
            return false;
        };
    }


    // Initialize the User Interface
    // TODO: create a UI checkboxes:
    // 1. toggle whether or not the path will be simplified.
    // 2. toggle whether or not the corners will be rounded.
    
    sliderInit(){
  
        // Setup default values for the sliders using hte config file. 
        for ( const setting in cfg){   
            let rangeSlider = document.querySelector('#'+setting);
            // if a slider exists for this setting 
            if (rangeSlider != null){
                rangeSlider.value = cfg[setting] 
                rangeSlider.nextElementSibling.value = cfg[setting] 
            }
            // TODO: some settings require non-slider UI.
        }

        document.querySelectorAll('#configArea input').forEach(el => {
            el.addEventListener('change', (event) => {
                let theValue = parseInt(event.target.value)
                let theSlider 
                // each slider has a sibling text input.
                // here we make sure they always agree.
                if (event.target.classList.contains('rangeValue')){
                    theSlider = event.target.previousElementSibling
                    theSlider.value = theValue
                }else{
                    theSlider = event.target
                    event.target.nextElementSibling.value = theValue
                }
                cfg[theSlider.id] = theValue
                Render.go() 
            });
        });
    }

 
}

export default UI;
 