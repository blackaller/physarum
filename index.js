import 'file-loader?name=[name].[ext]!./src/html/index.html';
import {
    Scene,
    OrthographicCamera,
    WebGLRenderer,
    Mesh,
    DataTexture,
    RGBAFormat,
    FloatType,
    PlaneBufferGeometry,
    ShaderMaterial,
    Vector2,
} from 'three';
import PingpongRenderTarget from "./src/PingpongRenderTarget"
import RenderTarget from "./src/RenderTarget"
import dat from "dat.gui";
import Controls from "./src/Controls";




let w = window.innerWidth
let h = window.innerHeight

const renderer = new WebGLRenderer({
    alpha: true
});
document.body.appendChild(renderer.domElement);
renderer.setSize(w, h);
const scene = new Scene();
let camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 100);
camera.position.z = 1

// 1 init buffers 
//////////////////////////////////////

let size = 256 // particles amount = ( size ^ 2 )

let count = size * size;
let pos = new Float32Array(count * 3)
let uvs = new Float32Array(count * 2)
let ptexdata = new Float32Array(count * 4)
let infodata = new Float32Array(count * 4)
let id = 0, x,y, u,v;
for (let i = 0; i < count; i++) {

    //point cloud vertex 
    id = i * 3
    pos[id++] = pos[id++] = pos[id++] = 0;

    //computes the uvs
    u = (i % size) / size;
    v = ~~(i / size) / size;
    id = i * 2
    uvs[id++] = u
    uvs[id] = v

    //particle texture values (agents)
    x = Math.random()
    y = Math.random()
    id = i * 4
    ptexdata[id++] = x//u//
    ptexdata[id++] = y//v//
    ptexdata[id++] = Math.random() //angle
    ptexdata[id++] = 1
    
    //extra data for particles
    id = i * 4
    infodata[id++] = 0
    infodata[id++] = 0
    infodata[id++] = 0
    infodata[id++] = 0

}

// 2 data & trails 
//////////////////////////////////////

//performs the diffusion and decay 
let diffuse_decay = new ShaderMaterial({
    uniforms: {
        points: { value: null },
        decay: {value: .8 }        
    },
    vertexShader: require('./src/glsl/quad_vs.glsl'),
    fragmentShader: require('./src/glsl/diffuse_decay_fs.glsl')
})
let trails = new PingpongRenderTarget(w, h, diffuse_decay)


// 3 agents 
//////////////////////////////////////

//moves agents around 
let update_agents = new ShaderMaterial({
    uniforms: {
        data: { value: null },
        info: { value: null },
        sa: { value: 22.5 },
        ra: { value: 21 },
        so: { value: 9 },
        ss: { value: 2.5 }
    },
    vertexShader: require('./src/glsl/quad_vs.glsl'),
    fragmentShader: require('./src/glsl/update_agents_fs.glsl')
})
let agents = new PingpongRenderTarget(size, size, update_agents, ptexdata)
//extra data for agents ( per agent variables)
let info = new DataTexture(infodata, size, size, RGBAFormat, FloatType)
info.needsUpdate = true;


// 4 point cloud
//////////////////////////////////////

//renders the updated agents as red dots 
let render_agents = new ShaderMaterial({
    uniforms: {
        tex: { value: null }, 
        col: { value: 0 },
        pointSize: { value: 1 }
    },
    vertexShader: require('./src/glsl/render_agents_vs.glsl'),
    fragmentShader: require('./src/glsl/render_agents_fs.glsl')
})
let render = new RenderTarget(w,h,render_agents, pos, uvs)


// 5 post process
//////////////////////////////////////

//post process the result of the trails 
let postprocess = new ShaderMaterial({
    uniforms: {
        data: {
            value: null
        }
    },
    vertexShader: require('./src/glsl/quad_vs.glsl'),
    fragmentShader: require('./src/glsl/postprocess_fs.glsl')
})
let postprocess_mesh = new Mesh(new PlaneBufferGeometry(), postprocess)
postprocess_mesh.scale.set(w, h, 1)
scene.add(postprocess_mesh)


// 6 interactive controls 
//////////////////////////////////////
let controls = new Controls( renderer, agents )


// animation loop 
//////////////////////////////////////

function raf(){
    
    requestAnimationFrame(raf)

    time = (Date.now() - start) * 0.001
    
    trails.material.uniforms.points.value = render.texture
    trails.render( renderer, time )
    
    agents.material.uniforms.data.value = trails.texture
    agents.material.uniforms.info.value = info
    agents.render(renderer, time)

    render.render( renderer, time )
    

    renderer.setSize(w,h)
    renderer.clear()
    postprocess_mesh.material.uniforms.data.value = trails.texture
    renderer.render(scene, camera)
}

//////////////////////////////////////////////////

let materials = [
    diffuse_decay, update_agents, render_agents
]
let resolution = new Vector2(w,h);
materials.forEach( (mat)=>{mat.uniforms.resolution.value = resolution})

let start = Date.now();
let time = 0;

raf()


// settings
//////////////////////////////////////////////////

let gui = new dat.GUI()
gui.add(diffuse_decay.uniforms.decay, "value", 0.01, .99, .01).name("decay")
gui.add(update_agents.uniforms.sa, "value", 1, 90, .1).name("sa")
gui.add(update_agents.uniforms.ra, "value", 1, 90, .1).name("ra")
gui.add(update_agents.uniforms.so, "value", 1, 90, .1).name("so")
gui.add(update_agents.uniforms.ss, "value", 0.1, 10, .1).name("ss")
gui.add(controls, "reset")
gui.add(controls, "radius",.001,.1)

