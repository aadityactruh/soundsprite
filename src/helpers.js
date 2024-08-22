import * as THREE from "three";

export const computeNormals = (positions, indices) => {
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < indices.length; i += 3) {
    // Get the indices of the triangle vertices
    const i1 = indices[i];
    const i2 = indices[i + 1];
    const i3 = indices[i + 2];

    // Get the vertices of the triangle
    const v1 = new THREE.Vector3(
      positions[i1 * 3],
      positions[i1 * 3 + 1],
      positions[i1 * 3 + 2]
    );
    const v2 = new THREE.Vector3(
      positions[i2 * 3],
      positions[i2 * 3 + 1],
      positions[i2 * 3 + 2]
    );
    const v3 = new THREE.Vector3(
      positions[i3 * 3],
      positions[i3 * 3 + 1],
      positions[i3 * 3 + 2]
    );

    // Compute the edges of the triangle
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);

    // Compute the cross product of the edges to get the normal
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    // Accumulate the normal into each vertex's normal
    normals[i1 * 3] += normal.x;
    normals[i1 * 3 + 1] += normal.y;
    normals[i1 * 3 + 2] += normal.z;

    normals[i2 * 3] += normal.x;
    normals[i2 * 3 + 1] += normal.y;
    normals[i2 * 3 + 2] += normal.z;

    normals[i3 * 3] += normal.x;
    normals[i3 * 3 + 1] += normal.y;
    normals[i3 * 3 + 2] += normal.z;
  }

  // Normalize the accumulated normals
  for (let i = 0; i < normals.length; i += 3) {
    const normal = new THREE.Vector3(
      normals[i],
      normals[i + 1],
      normals[i + 2]
    );
    normal.normalize();

    normals[i] = normal.x;
    normals[i + 1] = normal.y;
    normals[i + 2] = normal.z;
  }

  return normals;
};

export const getPointsCenter = (points) => {
  let minx = Math.min(...points.map((pt) => pt.x));
  let maxx = Math.max(...points.map((pt) => pt.x));
  let miny = Math.min(...points.map((pt) => pt.y));
  let maxy = Math.max(...points.map((pt) => pt.y));
  let minz = Math.min(...points.map((pt) => pt.z));
  let maxz = Math.max(...points.map((pt) => pt.z));

  return new THREE.Vector3(
    minx + (maxx - minx) / 2,
    miny + (maxy - miny) / 2,
    minz + (maxz - minz) / 2
  );
};
