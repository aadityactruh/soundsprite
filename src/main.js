import "./style.css";

// imports for scene!
import * as THREE from "three";
import { _canonical_face_model } from "./faceModelData";
import OneEuroFilter from "./OneEuroFilter";
import { computeNormals } from "./helpers";

//dependencies for face tracking
var cu = document.createElement("script");
cu.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
cu.crossOrigin = "anonymous";
document.head.appendChild(cu);

var fm = document.createElement("script");
fm.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
fm.crossOrigin = "anonymous";
document.head.appendChild(fm);

const videoinput = document.getElementById("video_input");
let vWidth, vHeight;
const ftime = { s: 0, c: 0 };

// setup threejs scene!
class Sketch {
  constructor(container) {
    // Three Vars
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.frameId = null;
    this.container = container;

    this.height = 0;
    this.width = 0;

    this.initialize();
  }

  initialize = () => {
    this.scene = new THREE.Scene();

    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    //Setup Camera & Resize
    this.setupCamera();
    this.setupResize();

    this.clock = new THREE.Clock();

    // warmup calls
    this.resize();
    this.render();

    //Setuup world
    this.addContents();

    //Start ANimation Loop
    this.start();
  };

  setupCamera = () => {
    this.camera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.camera.position.set(0, 0, 5);
  };

  setupResize = () => {
    window.addEventListener("resize", this.resize);
  };

  resize = () => {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  };

  start = () => {
    // if already initalized then leave it be
    if (!this.frameId) {
      this.frameId = requestAnimationFrame(this.update);
    }
  };

  stop = () => {
    cancelAnimationFrame(this.frameId);
  };

  addContents = () => {
    const scope = this;

    // Set up the basic lighting for the scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
    directionalLight.position.set(0, 1, 0);
    this.scene.add(directionalLight);

    // add video in the background
    const inputFrameTexture = new THREE.VideoTexture(videoinput);
    const inputFramesDepth = 500;
    const inputFramesPlane = this.createCameraPlaneMesh(
      this.camera,
      inputFramesDepth,
      new THREE.MeshBasicMaterial({ map: inputFrameTexture, side: THREE.DoubleSide })
    );

    /* this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.17 * 0.5, 32, 32),
      new THREE.MeshBasicMaterial({color: "blue", side: THREE.DoubleSide})
    )
    this.scene.add(this.sphere) */


    videoinput.addEventListener('loadedmetadata', () => {
      vWidth = videoinput.videoWidth;
      vHeight = videoinput.videoHeight;
    })
    this.scene.add(inputFramesPlane);


    // main things!
    fm.onload = function () {
      const promise = scope.loadSceneContent(inputFramesPlane, inputFrameTexture);
      promise.finally(() => {
        scope.trackingSequence();
      })
    };
  };

  loadSceneContent = async (plane, texture) => {
    const mpCameraUtils = window;
    const mpFaceMesh = window;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const deviceConstrains = {
        video: { width: 1280, height: 720, facingMode: "user" },
      };
      navigator.mediaDevices
        .getUserMedia(deviceConstrains)
        .then(function (stream) {
          // apply the stream to the video element used in the texture
          videoinput.srcObject = stream;
          videoinput.play();
        })
        .catch(function (error) {
          console.error("Unable to access the camera/webcam.", error);
        });
    } else {
      console.log("media devices input not available!");
    }

    this.faceMesh = new mpFaceMesh.FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });
    this.faceMesh.setOptions({
      cameraVerticalFovDegrees: 43.3,
      enableFaceGeometry: true,
      maxNumFaces: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65,
      selfieMode: true,
    });

    this.faceCamera = new mpCameraUtils.Camera(videoinput, {
      onFrame: async () => {
        // console.log("ON FRAME");
        await this.faceMesh.send({ image: videoinput });
      },
    });

    const fmsettings = {
      aspect: videoinput.width / videoinput.height,
      debug: true,
      filter: false,
      initialized: false,
    };

    const freq = 120;

    // setup face tracking mesh
    const faceMeshGeometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(_canonical_face_model.face_positions);
    faceMeshGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const indices = new Uint16Array(_canonical_face_model.face_tris);
    faceMeshGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const normals = computeNormals(_canonical_face_model.face_positions, _canonical_face_model.face_tris);
    faceMeshGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

    const uvs = new Float32Array(_canonical_face_model.face_uvs);
    faceMeshGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    // faceMeshGeometry.computeVertexNormals(); 

    this.threeFaceMesh = new THREE.Mesh(
      faceMeshGeometry, 
      new THREE.MeshStandardMaterial({color: "red", wireframe: true})
    );
    this.scene.add(this.threeFaceMesh);

    // pupils
    this.debugMeshes = {
      leftPupil: {},
      rightPupil: {}
    }
    const noseIdx = 4;
    const noseNormal = new THREE.Vector3(normals[noseIdx * 3], normals[noseIdx * 3 + 1], -normals[noseIdx * 3 + 2])
    
    const pupils = {
      left: {
        faceidx: [386, 374],
        filters: [
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
        ],
        trkobj: this.createPupilGeometry(noseNormal, "Left", this.debugMeshes.leftPupil, fmsettings.debug)
      },
      right: {
        faceidx: [159, 145],
        filters: [
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
        ],
        trkobj: this.createPupilGeometry(noseNormal, "Right", this.debugMeshes.rightPupil, fmsettings.debug)
      }
    }

    this.faceMesh.onResults(results => {
      this.updateMesh(this.threeFaceMesh, results, fmsettings,  [pupils.left, pupils.right], ftime)
    });

    this.faceCamera.start().then(() => {
      ftime.s = Date.now();
		  ftime.c = ftime.s;
    })

    console.log(this.scene.children)

    //! UPDATE NEEDS TO BE CHECKED
    /* this.updateViewScaling(plane, texture);
    plane.onBeforeRender = () => {
      this.updateViewScaling(plane, texture);
    } */

  }

  trackingSequence = () => {

  }

  createPupilGeometry = (normal, name = "Left", debugMeshes, debug = false) => {
    const xform = new THREE.Group();
    xform.name = `iris_${name}`;

    const irisMat = new THREE.MeshBasicMaterial({color: "blue", side: THREE.DoubleSide});

    const irisMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.17 * 0.5, 32, 32),
      irisMat
    )
    irisMesh.visible = debug;
    irisMesh.parent = xform;
    debugMeshes.dbg_iris = irisMesh;

    this.scene.add(xform)

    return xform;
  }

  updateMesh = (mesh, results, settings, trackers = [], ftime) => {
    const geometry = results.multiFaceGeometry[0];
    if (!geometry) return;

    const landmarks = results.multiFaceLandmarks[0];
    if (!landmarks) return;

    const verts = [];
    const uvs = [];

    // console.log("GEOMETRY", geometry);
    const gverts = geometry.getMesh().getVertexBufferList();
    const pmdata = geometry.getPoseTransformMatrix().getPackedDataList();
    const matrix = new THREE.Matrix4().fromArray(pmdata);

    let uv_idx = 0;
    let vert_idx = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const gx = gverts[i * 5];
      const gy = gverts[i * 5 + 1];
      const gz = gverts[i * 5 + 2];
      const gvec = new THREE.Vector3(gx, gy, gz).applyMatrix4(matrix);
  
      verts[vert_idx++] = gvec.x;
      verts[vert_idx++] = gvec.y;
      verts[vert_idx++] = gvec.z;
  
      uvs[uv_idx++] = gverts[i * 5 + 3];
      uvs[uv_idx++] = gverts[i * 5 + 4];
    }

    //update tracking
    trackers.forEach(track => {
      const mRot = new THREE.Quaternion().setFromRotationMatrix(matrix);

      if(track.trkobj) {
        const vpos = Array.isArray(track.faceidx)
          ? this.get_points_center(
            track.faceidx.map(idx => new THREE.Vector3(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]))
          )
          : new THREE.Vector3(verts[track.faceidx * 3], verts[track.faceidx * 3 + 1], verts[track.faceidx * 3 + 2]);

          const fx = track.filters[0]
          ? track.filters[0].filter(vpos.x, (1 / 120) * ftime.c)
          : vpos.x;
        const fy = track.filters[1]
          ? track.filters[1].filter(vpos.y, (1 / 120) * ftime.c)
          : vpos.y;
        const fz = track.filters[2]
          ? track.filters[2].filter(vpos.z, (1 / 120) * ftime.c)
          : vpos.z;
  
          const transformedVertex = settings.filter ? new THREE.Vector3(fx, fy, fz).applyMatrix4(mesh.matrixWorld) : vpos.applyMatrix4(mesh.matrixWorld);
          track.trkobj.position.copy(transformedVertex);
          track.trkobj.parent && track.trkobj.position.applyMatrix4(track.trkobj.parent.matrixWorld.clone().invert());
          track.trkobj.quaternion.copy(mRot);   
          
          // track.trkobj.name === "iris_Left" && this.sphere.position.copy(track.trkobj.position)
        }
    });

    const meshGeo = mesh.geometry;
    const uvAttribute = meshGeo.getAttribute("uv");
    uvAttribute.array.set(uvs);
    uvAttribute.needsUpdate = true;
    const positionAttribute = meshGeo.getAttribute("position");
    positionAttribute.array.set(verts);
    positionAttribute.needsUpdate = true;

    if(settings.initialized === false) {
      const avg_iris = 11.7;
      const minX = Math.min(...[160, 158, 153, 144].map(lm => landmarks[lm].x * results.image.width));
      const maxX = Math.max(...[160, 158, 153, 144].map(lm => landmarks[lm].x * results.image.width));
      
      const iris_screen = maxX - minX; //

      const dx = iris_screen;
      const dX = avg_iris; 
      const normalizedFocaleX = 1.40625;
      const fx = Math.min(results.image.width, results.image.height) * normalizedFocaleX;
		  const dZ = (fx * (dX / dx)) / 10.0;

      const r = trackers[1].trkobj.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(0, 0, 0);
		  const l = trackers[0].trkobj.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(0, 0, 0);
      const center = r.add(new THREE.Vector3().subVectors(l, r).multiplyScalar(0.5));

      if(this.camera) {
        this.camera.position.z = center.z + dZ + (1 - this.renderer.domElement.width / results.image.width) * 4;
        settings.initialized = true;
      }

    }
  }

  updateViewScaling = (plane, vTexture) => {
    const canvas = this.renderer.domElement;
    const cAspectRatio = canvas.width / canvas.height;
    const vAspectRatio = vWidth / vHeight;  

    console.log("Width, height", vWidth, vHeight, vAspectRatio, cAspectRatio)

    if(!vAspectRatio || !cAspectRatio) return;

    if(cAspectRatio > vAspectRatio) {
      const scaleY = cAspectRatio / vAspectRatio;

      plane.scale.x = 1;
      plane.scale.y = scaleY;

      vTexture.repeat.set(-1, 1/scaleY);
      vTexture.offset.set(0, (1 - vTexture.offset.y) * 0.5)
    } else {
      const scaleX = vAspectRatio / cAspectRatio;

      plane.scale.x = scaleX;
      plane.scale.y = 1;

      vTexture.repeat.set(-(1/scaleX), 1);
      vTexture.offset.set((1 - vTexture.offset.x) * 0.5, 0);
    }
  }

  get_points_center = (points) => {
    let minx = Math.min(...points.map(pt => pt.x));
    let maxx = Math.max(...points.map(pt => pt.x));
    let miny = Math.min(...points.map(pt => pt.y));
    let maxy = Math.max(...points.map(pt => pt.y));
    let minz = Math.min(...points.map(pt => pt.z));
    let maxz = Math.max(...points.map(pt => pt.z));
  
    return new THREE.Vector3(minx + (maxx - minx) / 2, miny + (maxy - miny) / 2, minz + (maxz - minz) / 2);
  };

  getViewportSizeAtDepth(camera, depth) {
    const viewportHeightAtDepth =
      2 * depth * Math.tan(THREE.MathUtils.degToRad(0.5 * camera.fov));
    const viewportWidthAtDepth = viewportHeightAtDepth * camera.aspect;
    return new THREE.Vector2(viewportWidthAtDepth, viewportHeightAtDepth);
  }

  createCameraPlaneMesh = (camera, depth, material) => {
    if (camera.near > depth || depth > camera.far) {
      console.warn(
        "Camera plane geometry will be clipped by the plane `Camera`!"
      );
    }

    const viewportSize = this.getViewportSizeAtDepth(camera, depth);
    const cameraPlaneGeometry = new THREE.PlaneGeometry(
      viewportSize.width,
      viewportSize.height
    );
    cameraPlaneGeometry.translate(0, 0, depth);
    cameraPlaneGeometry.rotateY(THREE.MathUtils.degToRad(180))
    return new THREE.Mesh(cameraPlaneGeometry, material);
  };

  update = () => {
    this.render();
    ftime.c += this.clock.getDelta();
    this.frameId = window.requestAnimationFrame(this.update);
  };

  render = () => {
    let { renderer, scene, camera } = this;
    if (renderer) {
      renderer.render(scene, camera);
    }
  };
}

new Sketch(document.getElementById("webgl-canvas"));
