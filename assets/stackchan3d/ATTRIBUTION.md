# Stack-chan 3D preview assets

- `assembled.glb`: assembled K151 Stack-chan model from [stackchan-color-simulator](https://github.com/kaburimen3/stackchan-color-simulator), based on the [M5Stack K151 StackChan Structures](https://github.com/m5stack/M5_Hardware/tree/master/Products/K151_StackChan/Structures). The simulator and M5Stack repositories use the MIT license; see `LICENSE-simulator.txt` and `LICENSE-m5stack.txt`.
- `coreS3_face.glb`: CoreS3 face case model from the same [simulator](https://github.com/kaburimen3/stackchan-color-simulator), derived from the [M5Stack CoreS3-Lite case](https://github.com/m5stack/M5_Hardware). License copies are alongside the models.
- `vendor/three.module.js`, `vendor/loaders/GLTFLoader.js`, `vendor/controls/OrbitControls.js`, `vendor/utils/BufferGeometryUtils.js`: [Three.js r160](https://github.com/mrdoob/three.js/tree/r160), MIT license. See `LICENSE-three.txt`.

The white materials, fox ears, tail, screen face texture, scene and animation rig are local INARI preview additions in `src/stackchanScene.js`. The ear and tail meshes are visual proposals, not printable CAD files.
