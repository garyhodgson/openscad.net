function main(){


return CSG.sphere({center: [0,0,0], radius: 1, resolution: 16}).translate([0,10,0]).transform(CSG.Matrix4x4.rotation([0,0,0], [1,0,0], 0)).union([
CSG.sphere({center: [0,0,0], radius: 1, resolution: 16}).translate([0,10,0]).transform(CSG.Matrix4x4.rotation([0,0,0], [1,0,0], 60)),CSG.sphere({center: [0,0,0], radius: 1, resolution: 16}).translate([0,10,0]).transform(CSG.Matrix4x4.rotation([0,0,0], [1,0,0], 120)),CSG.sphere({center: [0,0,0], radius: 1, resolution: 16}).translate([0,10,0]).transform(CSG.Matrix4x4.rotation([0,0,0], [1,0,0], 180)),CSG.sphere({center: [0,0,0], radius: 1, resolution: 16}).translate([0,10,0]).transform(CSG.Matrix4x4.rotation([0,0,0], [1,0,0], 240)),CSG.sphere({center: [0,0,0], radius: 1, resolution: 16}).translate([0,10,0]).transform(CSG.Matrix4x4.rotation([0,0,0], [1,0,0], 300))
]);
};
