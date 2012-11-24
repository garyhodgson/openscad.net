function main(){


return CSG.cylinder({start: [0,0,-50], end: [0,0,50],radiusStart: 10, radiusEnd: 10, resolution: 16}).translate([0,0,0]).transform(CSG.Matrix4x4.rotation([0,0,0], [1,0,0], 90));
};
