import "./style.css";

// imports for scene!
import * as THREE from "three";
import { _canonical_face_model } from "./faceModelData";
import OneEuroFilter from "./OneEuroFilter";
import { computeNormals, getPointsCenter } from "./helpers";

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

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.container });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    //Setup Camera & Resize
    this.setupCamera();
    this.setupResize();

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
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.camera.position.set(0, 0, 20);
  };

  setupResize = () => {
    window.addEventListener("resize", this.resize);
  };

  resize = () => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    // this.updateViewScaling( this.inputFrameTexture);

    this.renderer.setSize(this.width, this.height);
  };

  start = () => {
    // if already initalized then leave it be
    if (!this.frameId) {
      this.frameId = requestAnimationFrame(this.update);
    }
  };

  stop = () => {
    this.faceCamera.stop();
    this.faceMesh.close();
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
    this.inputFrameTexture = new THREE.VideoTexture(videoinput);
    this.inputFrameTexture.colorSpace = THREE.SRGBColorSpace;
    this.inputFrameTexture.wrapS = this.inputFrameTexture.wrapT =
      THREE.WrapAroundEnding;
    this.inputFrameTexture.offset.set(0, 0);
    this.inputFrameTexture.repeat.set(-1, 1);

    this.scene.background = this.inputFrameTexture;

    videoinput.addEventListener("loadedmetadata", () => {
      vWidth = videoinput.videoWidth;
      vHeight = videoinput.videoHeight;
    });

    // main things!
    fm.onload = function () {
      const promise = scope.loadSceneContent();
      /* promise.finally(() => {
        scope.trackingSequence();
      }); */
    };
  };

  loadSceneContent = async () => {
    // console.log("INSIDE loadSceneContent");
    const mpCameraUtils = window;
    const mpFaceMesh = window;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const deviceId = devices.find((d) => d.kind === "videoinput")?.deviceId;

    const deviceConstrains = {
      video: {
        deviceId,
        width: {
          min: 640,
          max: 1920,
        },
        height: {
          min: 480,
          max: 1080,
        },
        facingMode: "user",
      },
    };
    // console.log("Device Id", deviceId);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          deviceConstrains
        );
        if (stream) {
          videoinput.srcObject = stream;
          videoinput.play();
        } else {
          console.log("failed ot acquire stream!");
        }
      } catch (e) {
        console.error("Unable to access the camera/webcam.", e);
      }
      /* const stream = await navigator.mediaDevices
        .getUserMedia(deviceConstrains)
        .then(function (stream) {
          // apply the stream to the video element used in the texture
          videoinput.srcObject = stream;
          videoinput.play();
        })
        .catch(function (error) {
          console.error("Unable to access the camera/webcam.", error);
        }); */
    } else {
      console.log("media devices input not available!");
    }

    this.faceMesh = new mpFaceMesh.FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });
    this.faceMesh.setOptions({
      // cameraVerticalFovDegrees: 43.3,
      enableFaceGeometry: true,
      maxNumFaces: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65,
      selfieMode: true,
    });

    this.faceCamera = new mpCameraUtils.Camera(videoinput, {
      onFrame: async () => {
        await this.faceMesh.send({ image: videoinput });
      },
    });

    const fmsettings = {
      aspect: videoinput.width / videoinput.height,
      debug: true,
      filter: true,
      initialized: false,
    };

    const freq = 120;

    // setup face tracking mesh
    const faceMeshGeometry = new THREE.BufferGeometry();

    const positions = new Float32Array(_canonical_face_model.face_positions);
    faceMeshGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    const indices = new Uint16Array(_canonical_face_model.face_tris);
    faceMeshGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const normals = computeNormals(
      _canonical_face_model.face_positions,
      _canonical_face_model.face_tris
    );
    faceMeshGeometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(normals, 3)
    );

    const uvs = new Float32Array(_canonical_face_model.face_uvs);
    faceMeshGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    this.threeFaceMesh = new THREE.Mesh(
      faceMeshGeometry,
      new THREE.MeshStandardMaterial({ color: "red", wireframe: true })
    );
    this.scene.add(this.threeFaceMesh);

    console.log("TRACKING MESH CREATED", this.threeFaceMesh);

    // pupils
    this.debugMeshes = {
      leftPupil: {},
      rightPupil: {},
    };
    const noseIdx = 4;
    const noseNormal = new THREE.Vector3(
      normals[noseIdx * 3],
      normals[noseIdx * 3 + 1],
      -normals[noseIdx * 3 + 2]
    );

    const pupils = {
      left: {
        faceidx: [386, 374],
        filters: [
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
        ],
        trkobj: this.createPupilGeometry(
          noseNormal,
          "Left",
          this.debugMeshes.leftPupil,
          fmsettings.debug
        ),
      },
      right: {
        faceidx: [159, 145],
        filters: [
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
          new OneEuroFilter(freq, 0.685, 0, 1),
        ],
        trkobj: this.createPupilGeometry(
          noseNormal,
          "Right",
          this.debugMeshes.rightPupil,
          fmsettings.debug
        ),
      },
    };

    this.faceMesh.onResults((results) => {
      // console.log("On Update", this.camera.aspect);
      this.updateMesh(this.threeFaceMesh, results, fmsettings, [
        pupils.left,
        pupils.right,
      ]);
    });

    this.faceCamera.start();

    //! UPDATE NEEDS TO BE CHECKED
    // this.updateViewScaling( this.inputFrameTexture);
  };

  // trackingSequence = () => {};

  createPupilGeometry = (normal, name = "Left", debugMeshes, debug = false) => {
    const xform = new THREE.Group();
    xform.name = `iris_${name}`;

    const irisMat = new THREE.MeshBasicMaterial({
      color: "blue",
      side: THREE.DoubleSide,
    });

    const irisMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.17 * 0.5, 32, 32),
      irisMat
    );
    irisMesh.visible = debug;
    xform.add(irisMesh);
    debugMeshes.dbg_iris = irisMesh;

    this.scene.add(xform);

    return xform;
  };

  updateMesh = (mesh, results, settings, trackers = []) => {
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
    // const matrix = mesh.matrixWorld.clone();

    let uv_idx = 0;
    let vert_idx = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const gx = gverts[i * 5];
      const gy = gverts[i * 5 + 1];
      const gz = gverts[i * 5 + 2];
      const gvec = new THREE.Vector3(gx, gy, gz).applyMatrix4(matrix);

      verts[vert_idx + 0] = gvec.x * this.camera.aspect;
      verts[vert_idx + 1] = gvec.y;
      verts[vert_idx + 2] = gvec.z;

      vert_idx += 3;

      uvs[uv_idx] = gverts[i * 5 + 3];
      uvs[uv_idx] = gverts[i * 5 + 4];

      uv_idx += 2;
    }

    //update tracking
    trackers.forEach((track) => {
      const mRot = new THREE.Quaternion().setFromRotationMatrix(matrix);

      if (track.trkobj) {
        const vpos = Array.isArray(track.faceidx)
          ? getPointsCenter(
              track.faceidx.map(
                (idx) =>
                  new THREE.Vector3(
                    verts[idx * 3],
                    verts[idx * 3 + 1],
                    verts[idx * 3 + 2]
                  )
              )
            )
          : new THREE.Vector3(
              verts[track.faceidx * 3],
              verts[track.faceidx * 3 + 1],
              verts[track.faceidx * 3 + 2]
            );

        const fx = track.filters[0]
          ? track.filters[0].filter(vpos.x, (1 / 120) * Date.now())
          : vpos.x;
        const fy = track.filters[1]
          ? track.filters[1].filter(vpos.y, (1 / 120) * Date.now())
          : vpos.y;
        const fz = track.filters[2]
          ? track.filters[2].filter(vpos.z, (1 / 120) * Date.now())
          : vpos.z;

        const transformedVertex = settings.filter
          ? new THREE.Vector3(fx, fy, fz).applyMatrix4(mesh.matrixWorld)
          : vpos.applyMatrix4(mesh.matrixWorld);
        track.trkobj.position.copy(transformedVertex);
        track.trkobj.parent &&
          track.trkobj.position.applyMatrix4(
            track.trkobj.parent.matrixWorld.clone().invert()
          );
        track.trkobj.quaternion.copy(mRot);
      }
    });

    const meshGeo = mesh.geometry;
    const uvAttribute = meshGeo.getAttribute("uv");
    uvAttribute.array.set(uvs);
    uvAttribute.needsUpdate = true;
    const positionAttribute = meshGeo.getAttribute("position");
    positionAttribute.array.set(verts);
    positionAttribute.needsUpdate = true;
    mesh.updateWorldMatrix();

    if (settings.initialized === false) {
      const avg_iris = 11.7;
      const minX = Math.min(
        ...[160, 158, 153, 144].map(
          (lm) => landmarks[lm].x * results.image.width
        )
      );
      const maxX = Math.max(
        ...[160, 158, 153, 144].map(
          (lm) => landmarks[lm].x * results.image.width
        )
      );

      const iris_screen = maxX - minX; //

      const dx = iris_screen;
      const dX = avg_iris;
      const normalizedFocaleX = 1.40625;
      const fx =
        Math.min(results.image.width, results.image.height) * normalizedFocaleX;
      const dZ = (fx * (dX / dx)) / 10.0;

      const r =
        trackers[1].trkobj.getWorldPosition(new THREE.Vector3()) ||
        new THREE.Vector3(0, 0, 0);
      const l =
        trackers[0].trkobj.getWorldPosition(new THREE.Vector3()) ||
        new THREE.Vector3(0, 0, 0);
      const center = r.add(
        new THREE.Vector3().subVectors(l, r).multiplyScalar(0.5)
      );

      if (this.camera) {
        this.camera.position.z =
          center.z +
          dZ +
          (1 - this.renderer.domElement.width / results.image.width) * 4;
        settings.initialized = true;
      }
    }
  };

  updateViewScaling = (vTexture) => {
    const canvas = this.renderer.domElement;
    const cAspectRatio = canvas.width / canvas.height;
    const vAspectRatio = vWidth / vHeight;

    console.log("Width, height", vWidth, vHeight, vAspectRatio, cAspectRatio);

    if (!vAspectRatio || !cAspectRatio) return;

    if (cAspectRatio > vAspectRatio) {
      const scaleY = cAspectRatio / vAspectRatio;

      vTexture.repeat.set(-1, 1 / scaleY);
      vTexture.offset.set(0, (1 - vTexture.offset.y) * 0.5);
      vTexture.needsUpdate = true;
    } else {
      const scaleX = vAspectRatio / cAspectRatio;

      vTexture.repeat.set(-(1 / scaleX), 1);
      vTexture.offset.set((1 - vTexture.offset.x) * 0.5, 0);
      vTexture.needsUpdate = true;
    }
  };

  update = () => {
    this.render();
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
