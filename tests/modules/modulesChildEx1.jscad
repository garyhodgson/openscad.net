function main(){


return CSG.sphere({center: [0,0,0], radius: 30, resolution: 16}).translate([0,0,0]).union([
CSG.sphere({center: [0,0,0], radius: 30, resolution: 16}).translate([65,0,0])
]);
};
